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

describe('Admin smoke routes', () => {
  beforeEach(() => {
    mockState.reset();
  });

  it('exposes health endpoint and returns 404 contract for unknown route', async () => {
    const healthResponse = await request(app).get('/health');
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body.success).toBe(true);
    expect(healthResponse.body.data.status).toBe('ok');

    const notFoundResponse = await request(app).get('/unknown-route');
    expect(notFoundResponse.status).toBe(404);
    expect(notFoundResponse.body.success).toBe(false);
    expect(notFoundResponse.body.error.code).toBe('NOT_FOUND');
  });

  it('enforces auth for protected routes', async () => {
    const profileResponse = await request(app).get('/auth/profile');
    expect(profileResponse.status).toBe(401);
    expect(profileResponse.body.error.code).toBe('UNAUTHORIZED');

    const pendingUsersResponse = await request(app).get('/admin/users/pending');
    expect(pendingUsersResponse.status).toBe(401);
    expect(pendingUsersResponse.body.error.code).toBe('UNAUTHORIZED');

    const disputesResponse = await request(app).get('/admin/disputes');
    expect(disputesResponse.status).toBe(401);
    expect(disputesResponse.body.error.code).toBe('UNAUTHORIZED');
  });

  it('enforces admin role for admin routes', async () => {
    mockState.tokenClaims.set('token-user', { admin: false });

    const pendingUsersResponse = await request(app)
      .get('/admin/users/pending')
      .set('Authorization', 'Bearer token-user');
    expect(pendingUsersResponse.status).toBe(403);
    expect(pendingUsersResponse.body.error.code).toBe('FORBIDDEN');

    const disputesResponse = await request(app)
      .get('/admin/disputes')
      .set('Authorization', 'Bearer token-user');
    expect(disputesResponse.status).toBe(403);
    expect(disputesResponse.body.error.code).toBe('FORBIDDEN');
  });

  it('returns profile payload for authenticated user', async () => {
    mockState.seedUser({
      id: 'token-member',
      name: 'Member',
      email: 'member@mail.com',
      phone: '+628111111111',
      status: 'verified',
      isRenter: true,
    });
    mockState.tokenClaims.set('token-member', { admin: false });

    const response = await request(app)
      .get('/auth/profile')
      .set('Authorization', 'Bearer token-member');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('token-member');
    expect(response.body.data.email).toBe('member@mail.com');
  });

  it('supports core admin pending and approve flow contracts', async () => {
    mockState.seedUser({
      id: 'uid-pending-1',
      name: 'Pending 1',
      email: 'pending1@mail.com',
      phone: '+628222222222',
      status: 'pending',
    });
    mockState.seedUser({
      id: 'uid-pending-2',
      name: 'Pending 2',
      email: 'pending2@mail.com',
      phone: '+628333333333',
      status: 'pending',
    });
    mockState.seedUser({
      id: 'uid-verified',
      name: 'Verified 1',
      email: 'verified@mail.com',
      phone: '+628444444444',
      status: 'verified',
    });
    mockState.tokenClaims.set('token-admin', { admin: true });

    const pendingUsersResponse = await request(app)
      .get('/admin/users/pending?limit=1')
      .set('Authorization', 'Bearer token-admin');

    expect(pendingUsersResponse.status).toBe(200);
    expect(pendingUsersResponse.body.success).toBe(true);
    expect(pendingUsersResponse.body.data).toHaveLength(1);
    expect(pendingUsersResponse.body.data[0].status).toBe('pending');

    const missingApproveResponse = await request(app)
      .patch('/admin/users/uid-not-found/approve')
      .set('Authorization', 'Bearer token-admin');

    expect(missingApproveResponse.status).toBe(404);
    expect(missingApproveResponse.body.success).toBe(false);
    expect(missingApproveResponse.body.error.code).toBe('NOT_FOUND');
  });

  it('supports dispute review and resolve flow contracts', async () => {
    mockState.seedDispute({
      id: 'd-1',
      transactionId: 'trx-1',
      reportedBy: 'uid-reporter',
      description: 'Unit broken',
      status: 'open',
      reporterName: 'Reporter',
      renterName: 'Renter',
      itemNames: ['Camera'],
    });
    mockState.tokenClaims.set('token-admin', { admin: true });

    const listResponse = await request(app)
      .get('/admin/disputes')
      .set('Authorization', 'Bearer token-admin');

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0].status).toBe('open');

    const reviewResponse = await request(app)
      .patch('/admin/disputes/d-1/review')
      .set('Authorization', 'Bearer token-admin');

    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body.data.status).toBe('under_review');

    const missingNoteResponse = await request(app)
      .patch('/admin/disputes/d-1/resolve')
      .set('Authorization', 'Bearer token-admin')
      .send({});

    expect(missingNoteResponse.status).toBe(400);
    expect(missingNoteResponse.body.error.code).toBe('INVALID_INPUT');

    const resolveResponse = await request(app)
      .patch('/admin/disputes/d-1/resolve')
      .set('Authorization', 'Bearer token-admin')
      .send({ resolutionNote: 'Replace unit' });

    expect(resolveResponse.status).toBe(200);
    expect(resolveResponse.body.data.status).toBe('resolved');
    expect(resolveResponse.body.data.resolutionNote).toBe('Replace unit');
  });
});
