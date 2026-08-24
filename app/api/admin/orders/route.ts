import { NextRequest } from 'next/server';
import dbConnect from '@/src/database/dbConnection';
import Order from '@/app/api/customer-app/models/Order';
import Customer from '@/app/api/customer-app/models/Customer';
import { withAuth } from '@/src/utils/authGuard';
import { successResponse, errorResponse } from '@/src/utils/responses';

export async function GET(req: NextRequest) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'USERS'], async () => {
    try {
      await dbConnect();
      // Populate customerId with only name, phone, and email to optimize payload size and security
      const orders = await Order.find({})
        .populate({ path: 'customerId', model: Customer, select: 'name phone email' })
        .sort({ createdAt: -1 });

      return successResponse(orders, 'Orders fetched successfully');
    } catch (error: any) {
      console.error('[GET /api/admin/orders] error:', error);
      return errorResponse(error.message || 'Internal server error', 500);
    }
  });
}
