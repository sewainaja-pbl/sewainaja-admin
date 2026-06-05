import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFirebaseAdmin, mockState } from './mock-firebase';

vi.mock('firebase-admin', () => {
  return {
    default: {
      apps: [{}],
      initializeApp: vi.fn(),
      auth: () => mockFirebaseAdmin.auth,
      firestore: Object.assign(() => mockFirebaseAdmin.firestore(), {
        FieldValue: { serverTimestamp: () => new Date('2025-01-01T00:00:00.000Z') },
      }),
    },
  };
});

import { app } from '../index';

describe('POST /auth/login-google', () => {
  beforeEach(() => {
    mockState.reset();
    // Default mock behavior for testing Firebase error codes
    mockFirebaseAdmin.auth.verifyIdToken = async (token: string) => {
      if (token === 'expired-token') {
        const err = new Error('The Firebase ID token has expired.') as any;
        err.code = 'auth/id-token-expired';
        throw err;
      }
      if (token === 'invalid-token') {
        const err = new Error('The Firebase ID token is invalid.') as any;
        err.code = 'auth/invalid-id-token';
        throw err;
      }
      if (token === 'malformed-token') {
        const err = new Error('Argument error.') as any;
        err.code = 'auth/argument-error';
        throw err;
      }
      if (token === 'unknown-error-token') {
        throw new Error('Some unexpected Firebase error');
      }

      const claims = mockState.tokenClaims.get(token);
      if (!claims) {
        const err = new Error('The Firebase ID token is invalid.') as any;
        err.code = 'auth/invalid-id-token';
        throw err;
      }
      return {
        uid: token,
        email: `${token}@example.com`,
        name: (claims.name as string) ?? 'Google User',
        picture: (claims.picture as string) ?? 'https://example.com/pic.jpg',
        ...claims,
      };
    };
  });

  it('allows auto-registration for a new Google user with 201 status code', async () => {
    mockState.tokenClaims.set('new-google-user', {
      name: 'New Google User',
      picture: 'https://lh3.googleusercontent.com/new-pic',
    });

    const response = await request(app)
      .post('/auth/login-google')
      .set('Authorization', 'Bearer new-google-user');

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('new-google-user');
    expect(response.body.data.name).toBe('New Google User');
    expect(response.body.data.email).toBe('new-google-user@example.com');
    expect(response.body.data.profilePhotoUrl).toBe('https://lh3.googleusercontent.com/new-pic');
    expect(response.body.data.status).toBe('unverified');
    expect(response.body.data.isOwner).toBe(true);
    expect(response.body.data.isRenter).toBe(true);
    expect(response.body.data.isAdmin).toBe(false);
    expect(response.body.data.createdAt).toBeDefined();
    expect(response.body.data.updatedAt).toBeDefined();
    expect(response.body.data.lastLoginAt).toBeDefined();
  });

  it('allows login for an existing Google user with 200 status code', async () => {
    mockState.seedUser({
      id: 'existing-google-user',
      name: 'Existing Google User',
      email: 'existing-google-user@example.com',
      status: 'verified',
      isOwner: true,
      isRenter: false,
      profilePhotoUrl: 'https://example.com/old-pic.jpg',
    });

    mockState.tokenClaims.set('existing-google-user', {
      name: 'Existing Google User',
      picture: 'https://example.com/old-pic.jpg',
    });

    const response = await request(app)
      .post('/auth/login-google')
      .set('Authorization', 'Bearer existing-google-user');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.id).toBe('existing-google-user');
    expect(response.body.data.user.status).toBe('verified');
    expect(response.body.data.user.isOwner).toBe(true);
    expect(response.body.data.user.isRenter).toBe(false);
  });

  it('returns 403 status code when the existing user is suspended', async () => {
    mockState.seedUser({
      id: 'suspended-google-user',
      name: 'Suspended Google User',
      email: 'suspended-google-user@example.com',
      status: 'suspended',
      isOwner: true,
      isRenter: true,
    });

    mockState.tokenClaims.set('suspended-google-user', {
      name: 'Suspended Google User',
    });

    const response = await request(app)
      .post('/auth/login-google')
      .set('Authorization', 'Bearer suspended-google-user');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(response.body.error.message).toBe('Akun kamu telah disuspend');
  });

  it('returns 401 status code when the token is expired', async () => {
    const response = await request(app)
      .post('/auth/login-google')
      .set('Authorization', 'Bearer expired-token');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(response.body.error.message).toBe('Token kadaluarsa, silakan login ulang');
  });

  it('returns 401 status code when the token is invalid or malformed', async () => {
    const response = await request(app)
      .post('/auth/login-google')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(response.body.error.message).toBe('Token tidak valid');
  });

  it('returns 401 status code when Authorization header is missing or malformed', async () => {
    // 1. Missing header
    const responseMissing = await request(app)
      .post('/auth/login-google');

    expect(responseMissing.status).toBe(401);
    expect(responseMissing.body.success).toBe(false);
    expect(responseMissing.body.error.code).toBe('UNAUTHORIZED');
    expect(responseMissing.body.error.message).toBe('Token tidak ditemukan');

    // 2. Malformed header (no Bearer prefix)
    const responseMalformed = await request(app)
      .post('/auth/login-google')
      .set('Authorization', 'just-some-token-without-bearer');

    expect(responseMalformed.status).toBe(401);
    expect(responseMalformed.body.success).toBe(false);
    expect(responseMalformed.body.error.code).toBe('UNAUTHORIZED');
    expect(responseMalformed.body.error.message).toBe('Token tidak ditemukan');
  });

  it('returns 500 status code for unexpected internal Firebase error', async () => {
    const response = await request(app)
      .post('/auth/login-google')
      .set('Authorization', 'Bearer unknown-error-token');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(response.body.error.message).toBe('Some unexpected Firebase error');
  });
});
