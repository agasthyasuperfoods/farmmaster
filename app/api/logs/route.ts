import { NextRequest } from 'next/server';
import dbConnect from '@/src/database/dbConnection';
import { CrossingLog, SaleLog, TreatmentLog, resolveTagString } from '@/src/models/Logs';
import LiveStock from '@/src/models/LiveStock';
import Farm from '@/src/models/Farm';
import { withAuth } from '@/src/utils/authGuard';
import { successResponse, errorResponse, createdResponse } from '@/src/utils/responses';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
  return withAuth(
    req,
    ['SUPER_ADMIN', 'FARM_ADMIN', 'INCHARGE', 'HEALTH'],
    async (user) => {
      let body: any = null;
      try {
        // Parse request JSON body
        try {
          body = await req.json();
        } catch {
          return errorResponse('Request body is not valid JSON', 400);
        }

        // Determine log type from query string OR from the body parameters
        const url = new URL(req.url);
        const typeQuery = url.searchParams.get('type');
        const type = String(typeQuery || body.type || '').trim().toLowerCase();

        if (!type) {
          return errorResponse('Log type is required. Please specify type in query (?type=crossing) or request body.', 400);
        }

        // 1. Determine target log model
        let LogModel: any;
        if (type === 'crossing') {
          LogModel = CrossingLog;
        } else if (type === 'sale') {
          LogModel = SaleLog;
        } else if (type === 'treatment') {
          LogModel = TreatmentLog;
        } else {
          return errorResponse(`Invalid log type: '${type}'. Allowed types are: crossing, sale, treatment.`, 400);
        }

        // 2. Defensive Data Normalization
        // Force uppercase tag_id at the absolute beginning of payload extraction
        const tagInput = body.tag_id || body.tagId || body.tag || '';
        body.tag_id = String(tagInput).trim().toUpperCase();

        if (!body.tag_id) {
          return errorResponse('tag_id is required for child operational logs', 400);
        }

        await dbConnect();

        // Resolve dynamic ObjectId to human-readable tag string if submitted by frontend selector
        body.tag_id = (await resolveTagString(body.tag_id)).toUpperCase();

        // Keep legacy fields populated for backwards compatibility
        body.tagId = body.tag_id;
        body.tag = body.tag_id;

        // ── Validation Interceptor Check ──────────────────────────────────────
        const cleanTag = String(body.tag_id).trim().toUpperCase();
        const LiveStock = mongoose.models.LiveStock || mongoose.model('LiveStock');
        const animalExists = await LiveStock.findOne({ tag_id: cleanTag, isDeleted: false });
        
        body.lineNo = animalExists ? (Number(animalExists.lineNo) || 0) : 0;
        body.position = animalExists ? (Number(animalExists.position) || 0) : 0;

        // 3. Resolve farmId Dynamically
        let resolvedFarmId: string | null = null;
        const rawFarmId = body.farmId ? String(body.farmId).trim() : '';

        if (rawFarmId && /^[0-9a-fA-F]{24}$/.test(rawFarmId)) {
          resolvedFarmId = rawFarmId;
        } else if (rawFarmId && rawFarmId !== 'UNKNOWN_FARM') {
          const farm = await Farm.findOne({ code: rawFarmId });
          if (farm) {
            resolvedFarmId = farm._id.toString();
          }
        }

        // ── Try to get farmId from the referenced master LiveStock registry
        if (!resolvedFarmId) {
          const animal = await LiveStock.findOne({ tag_id: body.tag_id });
          if (animal && animal.farmId) {
            resolvedFarmId = animal.farmId.toString();
          }
        }

        // Fallback 1: Authenticated user's farmId from session token
        if (!resolvedFarmId && user.farmId) {
          resolvedFarmId = user.farmId.toString();
        }

        // Fallback 2: System default (first active farm found)
        if (!resolvedFarmId) {
          const defaultFarm = await Farm.findOne({ isDeleted: false });
          if (defaultFarm) {
            resolvedFarmId = defaultFarm._id.toString();
          }
        }

        if (resolvedFarmId) {
          body.farmId = resolvedFarmId;
        } else {
          delete body.farmId;
        }

        // 4. Create new operational log record (custom validators will trigger automatically)
        const record = await LogModel.create(body);

        return createdResponse(record, `${type.charAt(0).toUpperCase() + type.slice(1)} Log created successfully`);
      } catch (error: any) {
        console.error('[POST /api/logs] Unhandled error:', error);

        // Capture asynchronous validation errors or Mongoose validation failures
        if (error.name === 'ValidationError') {
          const errorMsg = error.errors?.tag_id?.message || Object.values(error.errors)[0]?.toString() || error.message;
          
          // Return clean, user-friendly JSON notification with HTTP 400
          if (errorMsg.includes('does not exist')) {
            const formattedTag = body?.tag_id || 'UNKNOWN';
            return errorResponse(
              `Validation failed: Animal with Tag ID [${formattedTag}] does not exist in active Live Stock.`,
              400
            );
          }
          return errorResponse(errorMsg, 400);
        }

        return errorResponse(error.message || 'Internal server error occurred', 500);
      }
    }
  );
}
