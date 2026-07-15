import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { app } from '../app';

describe('standalone Express app', () => {
  it('serves health endpoint without Firebase Functions wrapper', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({ status: 'ok' });
  });
});
