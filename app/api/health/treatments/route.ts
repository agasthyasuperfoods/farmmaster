/**
 * app/api/health/treatments/route.ts
 *
 * GOATED Treatment Log API — GET | POST
 * ──────────────────────────────────────
 * • POST normalizes legacy `tagId` / `animalId` fields into the canonical
 *   `tag_id` index field.
 * • Structural date validation (startDate <= endDate) is performed here in
 *   the route handler using safeDateParse — no Mongoose hook required.
 * • All date fields in the schema use `set: safeDateParse` automatically.
 * • Fail-safe try/catch on every handler with clean JSON error responses.
 */

import { NextRequest } from 'next/server';
import dbConnect from '@/src/database/dbConnection';
import TreatmentLog from '@/src/models/TreatmentLog';
import Cattle from '@/src/models/Cattle';
import Farm from '@/src/models/Farm';
import { safeDateParse, resolveTagString } from '@/src/models/Logs';
import { withAuth } from '@/src/utils/authGuard';
import { successResponse, errorResponse, createdResponse } from '@/src/utils/responses';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'INCHARGE', 'HEALTH'], async () => {
    try {
      await dbConnect();

      const { searchParams } = new URL(req.url);
      const pageParam = searchParams.get('page');
      const limitParam = searchParams.get('limit');
      const tagParam = searchParams.get('tag') || searchParams.get('tag_id');

      const query: any = { isDeleted: false };
      if (tagParam) {
        query.tag_id = new RegExp(`^${tagParam.trim()}$`, 'i');
      }

      if (pageParam || limitParam) {
        const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
        const limit = Math.max(1, parseInt(limitParam || '10', 10) || 10);
        const skip = (page - 1) * limit;

        const [total, records] = await Promise.all([
          TreatmentLog.countDocuments(query),
          TreatmentLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
        ]);

        const totalPages = Math.ceil(total / limit);

        return successResponse({
          data: records,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }, 'TreatmentLog fetched successfully');
      }

      const records = await TreatmentLog.find(query).sort({ createdAt: -1 });
      return successResponse(records, 'TreatmentLog fetched successfully');
    } catch (error: any) {
      console.error('[GET /api/health/treatments] Unhandled error:', error);
      return errorResponse(error?.message || 'Failed to fetch treatment logs', 500);
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'INCHARGE', 'HEALTH'], async (user) => {
    try {
      let body: Record<string, any>;
      try {
        body = await req.json();
      } catch {
        return errorResponse('Request body is not valid JSON', 400);
      }

      // ── Normalize tag_id from legacy field names ─────────────────────────
      // Frontend (LogForm) may send either `tagId`, `tag`, or `tag_id`.
      // We unify all of them into `tag_id` — the canonical indexed field.
      if (!body.tag_id) {
        body.tag_id = (body.tagId || body.tag || body.animalId || '').trim();
      }

      // Default tag_id to GENERAL if none is provided (not required anymore)
      if (!body.tag_id) {
        body.tag_id = 'GENERAL';
      }

      await dbConnect();

      // Resolve dynamic ObjectId to human-readable tag string if submitted by frontend selector
      body.tag_id = await resolveTagString(body.tag_id);

      // Keep legacy fields populated for backward compatibility
      if (!body.tagId) body.tagId = body.tag_id;

      // ── Validation Interceptor Check ──────────────────────────────────────
      const cleanTag = String(body.tag_id).trim().toUpperCase();

      // ── Structural date validation: startDate must be <= endDate ─────────
      // This check runs safely in the route layer using safeDateParse which
      // never throws — if either date is unparseable we skip the comparison
      // and let Mongoose handle it (it will store null via the schema setter).
      if (body.startDate && body.endDate) {
        const start = safeDateParse(body.startDate);
        const end = safeDateParse(body.endDate);
        if (start && end && start > end) {
          return errorResponse(
            `Treatment date conflict: startDate (${start.toISOString().split('T')[0]}) ` +
            `cannot be after endDate (${end.toISOString().split('T')[0]})`,
            400
          );
        }
      }

      // ── Resolve farmId Dynamically ──────────────────────────────────────
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

      // ── Try to get farmId from the referenced animal (most accurate since log matches asset)
      if (!resolvedFarmId) {
        const animal = await Cattle.findOne({ tag: body.tag_id });
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

      // Schema's `set: safeDateParse` on all Date fields handles all
      // date coercion automatically — no manual parsing needed here.
      const record = await TreatmentLog.create(body);
      return createdResponse(record, 'TreatmentLog created successfully');
    } catch (error: any) {
      console.error('[POST /api/health/treatments] Unhandled error:', error);

      if (error?.name === 'ValidationError') {
        const firstMsg = Object.values(error.errors ?? {})[0] as any;
        return errorResponse(firstMsg?.message || error.message || 'Validation failed', 422);
      }

      return errorResponse(error?.message || 'Failed to create treatment log', 500);
    }
  });
}
