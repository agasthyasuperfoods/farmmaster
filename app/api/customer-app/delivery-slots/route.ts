import { NextResponse } from 'next/server';
import dbConnect from '@/src/database/dbConnection';
import DeliverySlot from '@/app/api/customer-app/models/DeliverySlot';

export async function GET() {
  try {
    await dbConnect();
    let slots = await DeliverySlot.find({ enabled: true }).sort({ displayOrder: 1, createdAt: 1 });

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

    return NextResponse.json({
      success: true,
      message: 'Active delivery slots fetched successfully',
      data: slots,
    });
  } catch (error: any) {
    console.error('[GET /api/customer-app/delivery-slots] error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}
