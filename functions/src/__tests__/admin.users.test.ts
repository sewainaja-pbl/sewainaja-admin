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

describe('Admin users endpoints', () => {
  beforeEach(() => {
    mockState.reset();
  });

  it('forbids non-admin token and allows admin token to list pending users', async () => {
    mockState.seedUser({
      id: 'uid-user-1',
      name: 'User 1',
      email: 'u1@mail.com',
      phone: '+628111111111',
      status: 'pending',
    });

    mockState.tokenClaims.set('token-user', { admin: false });
    mockState.tokenClaims.set('token-admin', { admin: true });

    const nonAdminResponse = await request(app)
      .get('/admin/users/pending')
      .set('Authorization', 'Bearer token-user');

    expect(nonAdminResponse.status).toBe(403);
    expect(nonAdminResponse.body.error.code).toBe('FORBIDDEN');

    const adminResponse = await request(app)
      .get('/admin/users/pending')
      .set('Authorization', 'Bearer token-admin');

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.success).toBe(true);
    expect(adminResponse.body.data.length).toBe(1);
  });

  it('updates user status on approve and reject endpoints', async () => {
    mockState.seedUser({
      id: 'uid-target',
      name: 'Target',
      email: 'target@mail.com',
      phone: '+628222222222',
      status: 'pending',
    });

    mockState.tokenClaims.set('token-admin', { admin: true });

    const approveResponse = await request(app)
      .patch('/admin/users/uid-target/approve')
      .set('Authorization', 'Bearer token-admin');

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.status).toBe('verified');

    const rejectResponse = await request(app)
      .patch('/admin/users/uid-target/reject')
      .set('Authorization', 'Bearer token-admin');

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.data.status).toBe('suspended');
  });
});
