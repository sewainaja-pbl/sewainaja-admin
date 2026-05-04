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

describe('POST /auth/register', () => {
  beforeEach(() => {
    mockState.reset();
  });

  it('returns pending status and persists user profile', async () => {
    const response = await request(app).post('/auth/register').send({
      name: 'Gufron',
      email: 'gufron@mail.com',
      password: 'password123',
      phone: '+6281234567890',
      isOwner: true,
      isRenter: true,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('pending');

    const [storedUser] = [...mockFirebaseAdmin.__state.users.values()];
    expect(storedUser.email).toBe('gufron@mail.com');
    expect(storedUser.isOwner).toBe(true);
    expect(storedUser.isRenter).toBe(true);
  });

  it('returns conflict when email already exists', async () => {
    mockState.seedAuthUser({
      uid: 'uid-existing',
      email: 'exists@mail.com',
      password: 'password123',
    });

    const response = await request(app).post('/auth/register').send({
      name: 'User',
      email: 'exists@mail.com',
      password: 'password123',
      phone: '+6281234567890',
    });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CONFLICT');
  });
});
