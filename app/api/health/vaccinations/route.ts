import { NextRequest } from 'next/server';
import dbConnect from '@/src/database/dbConnection';
import VaccinationLog from '@/src/models/VaccinationLog';
import Cattle from '@/src/models/Cattle';
import Farm from '@/src/models/Farm';
import { resolveTagString } from '@/src/models/Logs';
import { withAuth } from '@/src/utils/authGuard';
import { successResponse, errorResponse, createdResponse } from '@/src/utils/responses';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'INCHARGE', 'HEALTH'], async () => {
    try {
      await dbConnect();
      const records = await VaccinationLog.find({ isDeleted: false }).sort({ createdAt: -1 });
      return successResponse(records, 'VaccinationLog fetched successfully');
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'INCHARGE', 'HEALTH'], async (user) => {
    try {
      const body = await req.json();
      await dbConnect();

      // Resolve dynamic ObjectId to human-readable tag string if submitted by frontend selector
      // ── Normalize tagId/tag_id ──────────────────────────────────────────
      if (!body.tagId) {
        body.tagId = (body.tag_id || '').trim();
      }
      if (!body.tagId) {
        body.tagId = 'GENERAL';
      }
      body.tag_id = body.tagId;

      // ── Validation Interceptor Check ──────────────────────────────────────
      const targetTag = String(body.tagId).trim().toUpperCase();

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

      // ── Try to get farmId from the referenced animal
      if (!resolvedFarmId && body.tagId) {
        const animal = await Cattle.findOne({ tag: String(body.tagId).trim() });
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

      if (!body.date) {
        body.date = new Date();
      }
      if (!body.shedId) {
        body.shedId = '';
      }

      const record = await VaccinationLog.create(body);
      return createdResponse(record, 'VaccinationLog created successfully');
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  });
}
