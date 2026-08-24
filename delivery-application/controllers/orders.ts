import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/src/database/dbConnection';
import Order from '../models/Order';
import DeliveryExecutive from '../models/DeliveryExecutive';
import DeliveryRoute from '@/app/api/customer-app/models/DeliveryRoute';
import { verifyAccessToken } from '@/src/utils/jwt';
import { unauthorizedResponse, errorResponse, successResponse } from '@/src/utils/responses';

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  return verifyAccessToken(token);
}

export async function getOrders(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return unauthorizedResponse('Invalid or expired token');
    }

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date'); // YYYY-MM-DD format

    const query: any = {};
    if (user.role === 'DELIVERY_EXECUTIVE') {
      query.assignedTo = user.userId;
    } else {
      query.customerId = user.userId;
    }

    if (dateParam) {
      // Create date filter logic
      const startOfDay = new Date(dateParam);
      const endOfDay = new Date(dateParam);
      endOfDay.setHours(23, 59, 59, 999);

      query.$or = [
        { deliveryDate: dateParam },
        {
          $and: [
            { $or: [{ deliveryDate: null }, { deliveryDate: '' }] },
            { createdAt: { $gte: startOfDay, $lte: endOfDay } }
          ]
        }
      ];
    }

    let ordersList;
    if (user.role === 'DELIVERY_EXECUTIVE') {
      console.log(`[GetOrders] Executive: ${user.userId}`);
      ordersList = await Order.find(query)
        .sort({ createdAt: -1 })
        .populate('assignedTo', 'name');
      console.log(`[GetOrders] Found ${ordersList.length} orders`);
    } else {
      ordersList = await Order.find(query)
        .sort({ createdAt: -1 })
        .populate('assignedTo', 'name');
    }

    const formattedOrders = ordersList.map((order: any) => {
      const obj = typeof order.toObject === 'function' ? order.toObject() : order;
      
      const computedTotal = (obj.items || []).reduce(
        (sum: number, item: any) => sum + (Number(item.price || 0) * Number(item.quantity || 1)),
        0
      );

      // Structure deliveryAddress to match what Flutter app expects
      const rawAddr = obj.address || {};
      const deliveryAddress = {
        fullName: rawAddr.fullName || rawAddr.name || '',
        mobile: rawAddr.mobile || rawAddr.phone || '',
        addressLine1: rawAddr.addressLine1 || rawAddr.address1 || '',
        addressLine2: rawAddr.addressLine2 || rawAddr.address2 || '',
        city: rawAddr.city || '',
        state: rawAddr.state || '',
        pincode: rawAddr.pincode || '',
      };

      return {
        ...obj,
        totalPrice: obj.totalPrice > 0 ? obj.totalPrice : computedTotal,
        deliveryAddress,
        createdAt: obj.createdAt ? obj.createdAt.toISOString() : new Date().toISOString(),
      };
    });

    return NextResponse.json(formattedOrders);
  } catch (error: any) {
    console.error('[Delivery Get Orders] error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function updateOrderStatus(req: NextRequest, { params }: { params: any }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return unauthorizedResponse('Invalid or expired token');
    }

    const resolvedParams = params instanceof Promise ? await params : await Promise.resolve(params);
    const orderId = resolvedParams?.id;
    if (!orderId) {
      return errorResponse('Order ID is required', 400);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { status, comment, reason } = body;
    if (!status) {
      return errorResponse('Status is required', 400);
    }

    await dbConnect();

    // Verify order exists and is assigned to this executive
    const order = await Order.findOne({ _id: orderId, assignedTo: user.userId });
    if (!order) {
      return errorResponse('Order not found or not assigned to you', 403);
    }

    // Dynamic Rule: Prevent starting deliveries for future or past orders
    if (status === 'out_for_delivery') {
      const orderDate = order.deliveryDate ? new Date(order.deliveryDate) : new Date(order.createdAt);
      
      // Use standard timezone for robust date matching
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
      const todayStr = formatter.format(new Date()); // YYYY-MM-DD
      const orderDateStr = formatter.format(orderDate);

      if (todayStr !== orderDateStr) {
        return errorResponse('You can only start deliveries for today\'s orders', 400);
      }
    }

    // Update status and feedback
    order.status = status;
    if (comment !== undefined) order.comment = comment;
    if (reason !== undefined) order.reason = reason;
    await order.save();

    return successResponse(order, 'Order status updated successfully');
  } catch (error: any) {
    console.error('[Delivery Update Order Status] error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
