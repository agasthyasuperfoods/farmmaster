import { NextResponse } from 'next/server';
import dbConnect from '@/src/database/dbConnection';
import DeliveryExecutive from '@/delivery-application/models/DeliveryExecutive';
import Customer from '@/app/api/customer-app/models/Customer';
import DeliveryRoute from '@/app/api/customer-app/models/DeliveryRoute';

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
      } else {
        // Make sure password is correct plain-text fallback
        exec.password = rider.password;
        exec.status = 'active';
        await exec.save();
      }

      results.push({ name: rider.name, phone: rider.phone, password: rider.password });
    }

    // Assign route to Default Tester
    const testerExec = await DeliveryExecutive.findOne({ phone: '1234567890' });
    let assignedRouteName = '';
    if (testerExec) {
      let route = await DeliveryRoute.findOne({ routeCode: 'ROUTE-A' });
      if (!route) {
        route = await DeliveryRoute.create({
          routeName: 'Main Route A',
          routeCode: 'ROUTE-A',
          assignedExecutiveId: testerExec._id,
          status: 'active'
        });
      } else {
        route.assignedExecutiveId = testerExec._id;
        route.status = 'active';
        await route.save();
      }
      assignedRouteName = route.routeName;
    }

    return NextResponse.json({
      success: true,
      message: 'Riders and Route initialized successfully in production!',
      assignedRoute: assignedRouteName,
      data: results
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Error occurred'
    }, { status: 500 });
  }
}
