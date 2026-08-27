import { NextRequest } from 'next/server';
import dbConnect from '@/src/database/dbConnection';
import DeliverySlot from '@/app/api/customer-app/models/DeliverySlot';
import { withAuth } from '@/src/utils/authGuard';
import { successResponse, errorResponse } from '@/src/utils/responses';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'USERS'], async () => {
    try {
      const { id } = await params;
      let body: any;
      try {
        body = await req.json();
      } catch {
        return errorResponse('Invalid JSON body', 400);
      }

      await dbConnect();
      const { name, startTime, endTime, cutoffTime, description, displayOrder, maxOrdersPerDay, enabled } = body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = String(name).trim();
      if (startTime !== undefined) updateData.startTime = String(startTime).trim();
      if (endTime !== undefined) updateData.endTime = String(endTime).trim();
      if (cutoffTime !== undefined) updateData.cutoffTime = String(cutoffTime).trim();
      if (description !== undefined) updateData.description = String(description).trim();
      if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder);
      if (maxOrdersPerDay !== undefined) updateData.maxOrdersPerDay = Number(maxOrdersPerDay);
      if (enabled !== undefined) updateData.enabled = Boolean(enabled);

      const updatedSlot = await DeliverySlot.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
      );

      if (!updatedSlot) {
        return errorResponse('Delivery slot not found', 404);
      }

      return successResponse(updatedSlot, 'Delivery slot updated successfully');
    } catch (error: any) {
      console.error('[PUT /api/admin/delivery-slots/[id]] error:', error);
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
      await dbConnect();

      const deletedSlot = await DeliverySlot.findByIdAndDelete(id);
      if (!deletedSlot) {
        return errorResponse('Delivery slot not found', 404);
      }

      return successResponse(null, 'Delivery slot deleted successfully');
    } catch (error: any) {
      console.error('[DELETE /api/admin/delivery-slots/[id]] error:', error);
      return errorResponse(error.message || 'Internal server error', 500);
    }
  });
}
