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

vi.mock('../lib/identity-toolkit', async () => {
  const real = await vi.importActual<typeof import('../lib/identity-toolkit')>('../lib/identity-toolkit');
  return {
    ...real,
    signInWithPassword: vi.fn(),
  };
});

import { app } from '../index';

describe('POST /auth/register and /auth/complete-register', () => {
  beforeEach(() => {
    mockState.reset();
  });

  it('validates register parameters and completes registration', async () => {
    // 1. Test /auth/register
    const regResponse = await request(app).post('/auth/register').send({
      name: 'Gufron',
      email: 'gufron-unique-reg@mail.com',
      password: 'password123',
      phone: '+6289999999999',
      isOwner: true,
      isRenter: true,
    });

    expect(regResponse.status).toBe(200);
    expect(regResponse.body.success).toBe(true);
    expect(regResponse.body.message).toBe('Nomor HP siap diverifikasi');

    // 2. Test /auth/complete-register
    mockState.tokenClaims.set('token-user-new', { verified: false });

    const completeResponse = await request(app)
      .post('/auth/complete-register')
      .set('Authorization', 'Bearer token-user-new')
      .send({
        name: 'Gufron',
        email: 'gufron-unique-reg@mail.com',
        phone: '+6289999999999',
      });

    expect(completeResponse.status).toBe(201);
    expect(completeResponse.body.success).toBe(true);
    expect(completeResponse.body.data.status).toBe('pending');

    const [storedUser] = [...mockFirebaseAdmin.__state.users.values()];
    expect(storedUser.email).toBe('gufron-unique-reg@mail.com');
    expect(storedUser.status).toBe('pending');
  });

  it('returns email taken conflict when email already exists', async () => {
    mockState.seedAuthUser({
      uid: 'uid-existing',
      email: 'exists-unique@mail.com',
      password: 'password123',
    });

    const response = await request(app).post('/auth/register').send({
      name: 'User',
      email: 'exists-unique@mail.com',
      password: 'password123',
      phone: '+6289999999998',
    });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('EMAIL_TAKEN');
  });
});
