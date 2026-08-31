import { NextRequest } from 'next/server';
import dbConnect from '@/src/database/dbConnection';
import MilkCollection from '@/src/models/MilkCollection';
import { withAuth } from '@/src/utils/authGuard';
import { successResponse, errorResponse, createdResponse } from '@/src/utils/responses';
import { resolveTagString } from '@/src/models/Logs';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'INCHARGE', 'MILK_PRODUCTION'], async () => {
    try {
      await dbConnect();
      const records = await MilkCollection.find({ isDeleted: false }).sort({ createdAt: -1 });
      return successResponse(records, 'MilkCollection fetched successfully');
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'INCHARGE', 'MILK_PRODUCTION'], async () => {
    try {
      const body = await req.json();
      await dbConnect();

      // Normalize fields to tag_id / tagId
      if (!body.tag_id) {
        body.tag_id = String(body.tagId || body.tag || '').trim();
      }
      if (!body.tagId) {
        body.tagId = body.tag_id;
      }

      if (!body.tag_id) {
        return errorResponse('tagId (animal tag) is required for milk collection logs', 400);
      }

      // Resolve dynamic ObjectId to human-readable tag string if submitted by frontend selector
      body.tag_id = await resolveTagString(body.tag_id);
      body.tagId = body.tag_id;

      // Safe date fallback to prevent DB validation crash
      let targetDate: Date;
      if (body.date) {
        const parsedDate = new Date(body.date);
        if (isNaN(parsedDate.getTime())) {
          targetDate = new Date();
        } else {
          targetDate = parsedDate;
        }
      } else {
        targetDate = new Date();
      }
      body.date = targetDate;

      // ── Validation Interceptor Check ──────────────────────────────────────
      const cleanTag = String(body.tag_id).trim().toUpperCase();
      const LiveStock = mongoose.models.LiveStock || mongoose.model('LiveStock');
      const animalExists = await LiveStock.findOne({ tag_id: cleanTag, isDeleted: false });

      body.lineNo = animalExists ? (Number(animalExists.lineNo) || 0) : 0;
      body.position = animalExists ? (Number(animalExists.position) || 0) : 0;

      const record = await MilkCollection.create(body);
      return createdResponse(record, 'MilkCollection created successfully');
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  });
}
