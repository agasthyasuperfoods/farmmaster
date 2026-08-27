import { NextRequest } from 'next/server';
import dbConnect from '@/src/database/dbConnection';
import Customer from '@/app/api/customer-app/models/Customer';
import Address from '@/app/api/customer-app/models/Address';
import { withAuth } from '@/src/utils/authGuard';
import { successResponse, createdResponse, errorResponse } from '@/src/utils/responses';

export async function GET(req: NextRequest) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'USERS'], async () => {
    try {
      await dbConnect();
      // Fetch active customers
      const customers = await Customer.find({ isDeleted: false }).sort({ createdAt: -1 });
      // Fetch all non-deleted addresses
      const addresses = await Address.find({ isDeleted: false });

      // Group addresses by customer ID
      const addressMap: Record<string, any[]> = {};
      addresses.forEach((addr) => {
        const cId = addr.customerId.toString();
        if (!addressMap[cId]) {
          addressMap[cId] = [];
        }
        addressMap[cId].push(addr);
      });

      // Combine customers with their addresses
      const result = customers.map((c) => {
        const plainCustomer = c.toObject();
        return {
          ...plainCustomer,
          addresses: addressMap[c._id.toString()] || [],
        };
      });

      return successResponse(result, 'Customers and their addresses fetched successfully');
    } catch (error: any) {
      console.error('[GET /api/admin/customers] error:', error);
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

      const name = body?.name ? String(body.name).trim() : '';
      const phone = body?.phone ? String(body.phone).trim() : '';
      const email = body?.email ? String(body.email).trim() : '';
      const address = body?.address;

      if (!name || !phone) {
        return errorResponse('Name and Phone number are required', 400);
      }

      // Check for duplicate phone
      const existingCustomer = await Customer.findOne({ phone });
      if (existingCustomer) {
        if (!existingCustomer.isDeleted) {
          return errorResponse('A customer with this phone number already exists', 400);
        } else {
          // Re-activate soft-deleted customer
          existingCustomer.isDeleted = false;
          existingCustomer.name = name;
          existingCustomer.email = email;
          existingCustomer.status = true;
          await existingCustomer.save();

          // If address is provided, add it
          if (address && address.addressLine1 && address.city) {
            await Address.create({
              customerId: existingCustomer._id,
              fullName: address.fullName || name,
              label: address.label || 'Home',
              phone: address.phone || phone,
              addressLine1: address.addressLine1.trim(),
              addressLine2: address.addressLine2 ? address.addressLine2.trim() : '',
              city: address.city.trim(),
              state: address.state ? address.state.trim() : 'Telangana',
              pincode: address.pincode ? address.pincode.trim() : '',
              isDefault: true,
            });
          }

          return successResponse(existingCustomer, 'Customer created successfully');
        }
      }

      // Create new customer
      const newCustomer = await Customer.create({
        name,
        phone,
        email,
        status: true,
        isDeleted: false,
      });

      // Create initial address if supplied
      if (address && address.addressLine1 && address.city) {
        await Address.create({
          customerId: newCustomer._id,
          fullName: address.fullName || name,
          label: address.label || 'Home',
          phone: address.phone || phone,
          addressLine1: address.addressLine1.trim(),
          addressLine2: address.addressLine2 ? address.addressLine2.trim() : '',
          city: address.city.trim(),
          state: address.state ? address.state.trim() : 'Telangana',
          pincode: address.pincode ? address.pincode.trim() : '',
          isDefault: true,
        });
      }

      return createdResponse(newCustomer, 'Customer created successfully');
    } catch (error: any) {
      console.error('[POST /api/admin/customers] error:', error);
      return errorResponse(error.message || 'Internal server error', 500);
    }
  });
}

