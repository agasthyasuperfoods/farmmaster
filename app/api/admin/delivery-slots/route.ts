import { NextRequest } from 'next/server';
import dbConnect from '@/src/database/dbConnection';
import DeliverySlot from '@/app/api/customer-app/models/DeliverySlot';
import { withAuth } from '@/src/utils/authGuard';
import { successResponse, createdResponse, errorResponse } from '@/src/utils/responses';

export async function GET(req: NextRequest) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'USERS'], async () => {
    try {
      await dbConnect();
      let slots = await DeliverySlot.find({}).sort({ displayOrder: 1, createdAt: 1 });

      // If no slots exist yet, seed default ones
      if (slots.length === 0) {
        const defaultSlots = [
          {
            name: 'Morning Slot',
            startTime: '05:30 AM',
            endTime: '07:30 AM',
            cutoffTime: '10:00 PM',
            description: 'Early morning fresh delivery before sunrise',
            displayOrder: 1,
            maxOrdersPerDay: 0,
            enabled: true,
          },
          {
            name: 'Evening Slot',
            startTime: '05:00 PM',
            endTime: '07:30 PM',
            cutoffTime: '03:00 PM',
            description: 'Evening fresh milk & dairy delivery',
            displayOrder: 2,
            maxOrdersPerDay: 0,
            enabled: true,
          },
        ];
        slots = await DeliverySlot.insertMany(defaultSlots);
      }

      return successResponse(slots, 'Delivery slots fetched successfully');
    } catch (error: any) {
      console.error('[GET /api/admin/delivery-slots] error:', error);
      return errorResponse(error.message || 'Internal server error', 500);
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'USERS'], async () => {
    try {
      await dbConnect();
      let body: any;
      try {
        body = await req.json();
      } catch {
        return errorResponse('Invalid JSON body', 400);
      }

      const { name, startTime, endTime, cutoffTime, description, displayOrder, maxOrdersPerDay, enabled } = body;

      if (!name || !startTime || !endTime) {
        return errorResponse('Slot Name, Start Time, and End Time are required', 400);
      }

      const newSlot = await DeliverySlot.create({
        name: String(name).trim(),
        startTime: String(startTime).trim(),
        endTime: String(endTime).trim(),
        cutoffTime: cutoffTime ? String(cutoffTime).trim() : '',
        description: description ? String(description).trim() : '',
        displayOrder: Number(displayOrder) || 0,
        maxOrdersPerDay: Number(maxOrdersPerDay) || 0,
        enabled: enabled !== undefined ? Boolean(enabled) : true,
      });

      return createdResponse(newSlot, 'Delivery slot created successfully');
    } catch (error: any) {
      console.error('[POST /api/admin/delivery-slots] error:', error);
      return errorResponse(error.message || 'Internal server error', 500);
    }
  });
}
