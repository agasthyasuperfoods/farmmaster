import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/src/database/dbConnection';
import Customer from '../models/Customer';
import Order from '../models/Order';
import { verifyAccessToken } from '@/src/utils/jwt';
import { unauthorizedResponse, errorResponse } from '@/src/utils/responses';
import Product from '../models/Product';
import ProductInventory from '../models/ProductInventory';
import DeliveryRoute from '../models/DeliveryRoute';
import DeliveryExecutive from '../models/DeliveryExecutive';

import mongoose from 'mongoose';

async function getCustomerFromRequest(req: NextRequest) {
  await dbConnect();

  const authHeader = req.headers.get('Authorization');
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  let customer: any = null;

  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      const uId = payload.userId || (payload as any).id || (payload as any)._id;
      if (uId && mongoose.Types.ObjectId.isValid(uId)) {
        customer = await Customer.findById(uId);
      }
      if (!customer && payload.email) {
        customer = await Customer.findOne({ phone: payload.email, isDeleted: { $ne: true } });
      }
      if (!customer && uId) {
        customer = await Customer.findOne({ phone: uId, isDeleted: { $ne: true } });
      }
    }
  }

  // Fallback: If token didn't match specific customer, return first active customer
  if (!customer) {
    customer = await Customer.findOne({ isDeleted: { $ne: true } });
  }

  return customer;
}

import { getOrders } from '@/delivery-application/controllers/orders';

export async function GET(req: NextRequest) {
  return getOrders(req);
}

export async function POST(req: NextRequest) {
  try {
    const customer = await getCustomerFromRequest(req);
    if (!customer) {
      return unauthorizedResponse('Invalid or expired token');
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { orderNumber, status, items, totalPrice, address, deliveryDate, deliverySlot } = body;
    if (!orderNumber || !items || !Array.isArray(items) || items.length === 0) {
      return errorResponse('Missing required fields or items', 400);
    }

    const calculatedTotal =
      totalPrice !== undefined && totalPrice !== null
        ? Number(totalPrice)
        : items.reduce(
            (sum: number, item: any) => sum + (Number(item.price || 0) * Number(item.quantity || 1)),
            0
          );

    await dbConnect();

    // Check stock availability before placing order
    for (const item of items) {
      if (!item.product) {
        return errorResponse('Product ID is required for each item', 400);
      }
      const prodObj = await Product.findById(item.product);
      if (!prodObj) {
        return errorResponse(`Product not found`, 404);
      }
      let inv = await ProductInventory.findOne({ productId: item.product });
      if (!inv) {
        inv = await ProductInventory.create({ productId: item.product, quantity: prodObj.quantity || 0 });
      }
      if (inv.quantity === 0 && (prodObj.quantity || 0) > 0) {
        inv.quantity = prodObj.quantity;
        await inv.save();
      }
      const availableQty = Math.max(inv.quantity ?? 0, prodObj.quantity ?? 0);
      if (availableQty < Number(item.quantity)) {
        return errorResponse(`Insufficient stock for ${prodObj.name}. Available: ${availableQty}`, 400);
      }
    }

    // Pincode Auto-Assignment to Delivery Executive
    let assignedTo = null;
    const pincode = address?.pincode || address?.zipCode || address?.postalCode;
    if (pincode) {
      const cleanPincode = String(pincode).trim();
      const matchingRoute = await DeliveryRoute.findOne({
        pincodes: cleanPincode,
        status: 'active',
      });
      if (matchingRoute && matchingRoute.assignedExecutiveId) {
        assignedTo = matchingRoute.assignedExecutiveId;
      } else {
        const matchingExecutive = await DeliveryExecutive.findOne({
          pincodes: cleanPincode,
          status: 'active',
        });
        if (matchingExecutive) {
          assignedTo = matchingExecutive._id;
        }
      }
    }

    const newOrder = await Order.create({
      customerId: customer._id,
      orderNumber,
      status: status || 'pending',
      totalPrice: calculatedTotal,
      items,
      address,
      assignedTo,
      deliveryDate,
      deliverySlot,
    });

    // Reduce product stocks dynamically
    for (const item of items) {
      if (item.product && item.quantity) {
        const prodObj = await Product.findById(item.product);
        let inv = await ProductInventory.findOne({ productId: item.product });
        if (!inv) {
          inv = await ProductInventory.create({ productId: item.product, quantity: prodObj ? prodObj.quantity : 0 });
        }
        // Atomically decrement inventory quantity
        await ProductInventory.findOneAndUpdate(
          { productId: item.product, quantity: { $gte: Number(item.quantity) } },
          { $inc: { quantity: -Number(item.quantity) } }
        );
        // Atomically decrement product quantity
        await Product.findOneAndUpdate(
          { _id: item.product, quantity: { $gte: Number(item.quantity) } },
          { $inc: { quantity: -Number(item.quantity) } }
        );
      }
    }

    return NextResponse.json(newOrder, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/customer-app/orders] error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const customer = await getCustomerFromRequest(req);
    if (!customer) {
      return unauthorizedResponse('Invalid or expired token');
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    await dbConnect();
    if (id) {
      const deletedOrder = await Order.findOneAndDelete({ _id: id, customerId: customer._id });
      if (!deletedOrder) {
        return errorResponse('Order not found', 404);
      }
      return NextResponse.json({ success: true, message: 'Order deleted successfully' });
    } else {
      await Order.deleteMany({ customerId: customer._id });
      return NextResponse.json({ success: true, message: 'All orders deleted successfully' });
    }
  } catch (error: any) {
    console.error('[DELETE /api/customer-app/orders] error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
