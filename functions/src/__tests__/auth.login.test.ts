import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFirebaseAdmin, mockState } from './mock-firebase';
import { mockIdentityToolkit } from './mock-firebase';

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

vi.mock('../lib/identity-toolkit', async () => {
  const real = await vi.importActual<typeof import('../lib/identity-toolkit')>('../lib/identity-toolkit');
  return {
    ...real,
    signInWithPassword: vi.fn(mockIdentityToolkit.signInWithPassword),
    IdentityToolkitError: mockIdentityToolkit.IdentityToolkitError,
  };
});

import { app } from '../index';

describe('POST /auth/login', () => {
  beforeEach(() => {
    mockState.reset();
  });

  it('allows pending user login with 200', async () => {
    mockState.seedAuthUser({
      uid: 'uid-pending',
      email: 'pending@mail.com',
      password: 'password123',
    });

    mockState.seedUser({
      id: 'uid-pending',
      name: 'Pending User',
      email: 'pending@mail.com',
      phone: '+628111111111',
      status: 'pending',
      isOwner: false,
      isRenter: true,
      isAdmin: false,
    });

    const response = await request(app).post('/auth/login').send({
      email: 'pending@mail.com',
      password: 'password123',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.status).toBe('pending');
    expect(response.body.data.tokens.idToken).toBeTruthy();
  });
});
