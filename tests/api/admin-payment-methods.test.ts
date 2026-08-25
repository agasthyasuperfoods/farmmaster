import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/src/database/dbConnection', () => ({
  default: vi.fn(),
}));

vi.mock('@/app/api/customer-app/models/PaymentMethod', () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

vi.mock('@/src/utils/jwt', () => ({
  verifyAccessToken: vi.fn((token: string) => {
    if (token === 'admin-token') {
      return { userId: 'admin-123', email: 'admin@gmail.com', role: 'SUPER_ADMIN' };
    }
    return null;
  }),
}));

vi.mock('@/src/models/User', () => ({
  default: {
    findById: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn().mockResolvedValue({
          _id: 'admin-123',
          role: 'SUPER_ADMIN',
          status: true,
          permissions: ['SUPER_ADMIN'],
        }),
      })),
    })),
  },
}));

vi.mock('@/src/models/Role', () => ({
  default: {
    findOne: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue({
        permissions: ['SUPER_ADMIN'],
      }),
    })),
  },
}));

import { GET, PUT, DELETE } from '@/app/api/admin/payment-methods/[id]/route';

describe('Admin Payment Methods ID Route Validation tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns 404 for invalid ObjectId format', async () => {
    const request = new NextRequest('http://localhost/api/admin/payment-methods/invalid-id-format', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer admin-token' },
    });

    const params = Promise.resolve({ id: 'invalid-id-format' });
    const response = await GET(request, { params });
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Payment method not found');
  });

  it('PUT returns 404 for invalid ObjectId format', async () => {
    const request = new NextRequest('http://localhost/api/admin/payment-methods/invalid-id-format', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer admin-token', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Cash' }),
    });
    const params = Promise.resolve({ id: 'invalid-id-format' });
    const response = await PUT(request, { params });
    expect(response.status).toBe(404);
  });

  it('DELETE returns 404 for invalid ObjectId format', async () => {
    const request = new NextRequest('http://localhost/api/admin/payment-methods/invalid-id-format', {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer admin-token' },
    });
    const params = Promise.resolve({ id: 'invalid-id-format' });
    const response = await DELETE(request, { params });
    expect(response.status).toBe(404);
  });
});
