import { NextResponse } from 'next/server';
import dbConnect from '@/src/database/dbConnection';
import DeliveryExecutive from '@/delivery-application/models/DeliveryExecutive';
import Customer from '@/app/api/customer-app/models/Customer';

export async function GET() {
  try {
    await dbConnect();

    const riders = [
      { name: 'Rider One', phone: '9111111111', password: 'password123' },
      { name: 'Rider Two', phone: '9222222222', password: 'password123' },
      { name: 'Rider Three', phone: '9333333333', password: 'password123' },
      { name: 'Default Tester', phone: '1234567890', password: 'Tester' }
    ];

    const results = [];

    for (const rider of riders) {
      // Create Customer profile first (as required by the system)
      let customer = await Customer.findOne({ phone: rider.phone });
      if (!customer) {
        customer = await Customer.create({
          phone: rider.phone,
          name: rider.name,
          status: true,
          isDeleted: false
        });
      }

      // Create DeliveryExecutive profile
      let exec = await DeliveryExecutive.findOne({ phone: rider.phone });
      if (!exec) {
        exec = await DeliveryExecutive.create({
          name: rider.name,
          phone: rider.phone,
          email: `${rider.phone}@test.com`,
          password: rider.password,
          vehicleType: 'Bike',
          vehicleNumber: 'TEST-123',
          status: 'active'
        });
      }

      results.push({ name: rider.name, phone: rider.phone, password: rider.password });
    }

    return NextResponse.json({
      success: true,
      message: '3 Delivery Executives successfully created in production!',
      data: results
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Error occurred'
    }, { status: 500 });
  }
}
