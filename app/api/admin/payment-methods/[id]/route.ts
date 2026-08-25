import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/src/database/dbConnection';
import PaymentMethod from '@/app/api/customer-app/models/PaymentMethod';
import { withAuth } from '@/src/utils/authGuard';
import { successResponse, errorResponse } from '@/src/utils/responses';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'USERS'], async () => {
    try {
      const { id } = await params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse('Payment method not found', 404);
      }
      await dbConnect();
      const paymentMethod = await PaymentMethod.findById(id);
      if (!paymentMethod) {
        return errorResponse('Payment method not found', 404);
      }
      return successResponse(paymentMethod, 'Payment method fetched successfully');
    } catch (error: any) {
      console.error('[GET /api/admin/payment-methods/[id]] error:', error);
      return errorResponse(error.message || 'Internal server error', 500);
    }
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'USERS'], async () => {
    try {
      const { id } = await params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse('Payment method not found', 404);
      }
      let body: any;
      try {
        body = await req.json();
      } catch {
        return errorResponse('Invalid JSON body', 400);
      }

      await dbConnect();

      // Check duplicate code
      if (body.code) {
        const existing = await PaymentMethod.findOne({ code: body.code.toUpperCase(), _id: { $ne: id } });
        if (existing) {
          return errorResponse('Payment method code already exists', 400);
        }
        body.code = body.code.toUpperCase();
      }

      const updated = await PaymentMethod.findByIdAndUpdate(
        id,
        { $set: body },
        { new: true }
      );

      if (!updated) {
        return errorResponse('Payment method not found', 404);
      }

      return successResponse(updated, 'Payment method updated successfully');
    } catch (error: any) {
      console.error('[PUT /api/admin/payment-methods/[id]] error:', error);
      return errorResponse(error.message || 'Internal server error', 500);
    }
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'USERS'], async () => {
    try {
      const { id } = await params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse('Payment method not found', 404);
      }
      await dbConnect();
      const deleted = await PaymentMethod.findByIdAndDelete(id);
      if (!deleted) {
        return errorResponse('Payment method not found', 404);
      }
      return successResponse(null, 'Payment method deleted successfully');
    } catch (error: any) {
      console.error('[DELETE /api/admin/payment-methods/[id]] error:', error);
      return errorResponse(error.message || 'Internal server error', 500);
    }
  });
}
