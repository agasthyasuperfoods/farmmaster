import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/src/database/dbConnection';
import Product from '@/app/api/customer-app/models/Product';
import ProductInventory from '@/app/api/customer-app/models/ProductInventory';
import { withAuth } from '@/src/utils/authGuard';
import { successResponse, errorResponse } from '@/src/utils/responses';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'USERS'], async () => {
    try {
      const { id } = await params;
      await dbConnect();
      const product = await Product.findById(id);
      if (!product) {
        return errorResponse('Product not found', 404);
      }
      
      const obj = typeof product.toObject === 'function' ? product.toObject() : product;
      let inv = await ProductInventory.findOne({ productId: product._id });
      if (!inv) {
        inv = await ProductInventory.create({ productId: product._id, quantity: product.quantity || 0 });
      }
      obj.quantity = inv.quantity;

      return successResponse(obj, 'Product fetched successfully');
    } catch (error: any) {
      console.error('[GET /api/admin/products/[id]] error:', error);
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
      let body: any;
      try {
        body = await req.json();
      } catch {
        return errorResponse('Invalid JSON body', 400);
      }

      await dbConnect();

      // Check duplicate SKU
      if (body.sku) {
        const existing = await Product.findOne({ sku: body.sku, _id: { $ne: id } });
        if (existing) {
          return errorResponse('Product SKU already exists', 400);
        }
      }

      if (body.quantity !== undefined) {
        body.quantity = Math.max(0, Number(body.quantity));
      }

      const updatedProduct = await Product.findByIdAndUpdate(
        id,
        { $set: body },
        { new: true }
      );

      if (!updatedProduct) {
        return errorResponse('Product not found', 404);
      }

      const productId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;

      if (body.quantity !== undefined) {
        await ProductInventory.findOneAndUpdate(
          { productId },
          { quantity: body.quantity },
          { upsert: true }
        );
      }

      const obj = typeof updatedProduct.toObject === 'function' ? updatedProduct.toObject() : updatedProduct;
      const inv = await ProductInventory.findOne({ productId });
      if (inv) {
        obj.quantity = inv.quantity;
      }

      return successResponse(obj, 'Product updated successfully');
    } catch (error: any) {
      console.error('[PUT /api/admin/products/[id]] error:', error);
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
      const deletedProduct = await Product.findByIdAndDelete(id);
      if (!deletedProduct) {
        return errorResponse('Product not found', 404);
      }

      const productId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
      await ProductInventory.deleteOne({ productId });

      return successResponse(null, 'Product deleted successfully');
    } catch (error: any) {
      console.error('[DELETE /api/admin/products/[id]] error:', error);
      return errorResponse(error.message || 'Internal server error', 500);
    }
  });
}
