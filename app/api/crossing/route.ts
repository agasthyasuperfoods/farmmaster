/**
 * app/api/crossing/route.ts
 *
 * GOATED Crossing Log API — GET | POST
 * ──────────────────────────────────────
 * • POST normalizes the frontend's `tag` field into `tag_id` so every
 *   record is firmly tied to a livestock asset.
 * • Strict payload sanitization via passthrough Zod + manual field mapping.
 * • Fail-safe try/catch on every handler.
 */

import { NextRequest } from 'next/server';
import dbConnect from '@/src/database/dbConnection';
import CrossingLog from '@/src/models/CrossingLog';
import Cattle from '@/src/models/Cattle';
import Farm from '@/src/models/Farm';
import { resolveTagString } from '@/src/models/Logs';
import { withAuth } from '@/src/utils/authGuard';
import { successResponse, errorResponse, createdResponse } from '@/src/utils/responses';
import { z } from 'zod';
import mongoose from 'mongoose';
import SemenStraw from '@/src/models/SemenStraw';

// Validate that the request structure is valid.
// farmId is optional here because we can resolve it dynamically from the referenced animal or user context.
const crossingSchema = z
  .object({
    farmId: z.string().optional().nullable(),
  })
  .passthrough();

export async function GET(req: NextRequest) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'INCHARGE', 'CROSSING_LOG', 'CROSSING'], async () => {
    try {
      await dbConnect();
      const records = await CrossingLog.find({ isDeleted: false }).sort({ createdAt: -1 });
      return successResponse(records, 'CrossingLogs fetched successfully');
    } catch (error: any) {
      console.error('[GET /api/crossing] Unhandled error:', error);
      return errorResponse(error?.message || 'Failed to fetch crossing logs', 500);
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'INCHARGE', 'CROSSING_LOG', 'CROSSING'], async (user) => {
    try {
      let rawBody: any;
      try {
        rawBody = await req.json();
      } catch {
        return errorResponse('Request body is not valid JSON', 400);
      }

      const parsedBody = crossingSchema.safeParse(rawBody);
      if (!parsedBody.success) {
        return errorResponse(
          parsedBody.error.issues[0]?.message || 'Invalid request body',
          400
        );
      }

      const body = parsedBody.data as Record<string, any>;

      // ── Normalize tag → tag_id ─────────────────────────────────────────
      // The frontend sends "tag" (the animal's visible tag number).
      // The schema enforces "tag_id" as the canonical indexed field.
      // We set both so old records and new records are query-compatible.
      if (!body.tag_id && body.tag) {
        body.tag_id = String(body.tag).trim();
      }
      if (!body.tag && body.tag_id) {
        body.tag = String(body.tag_id).trim();
      }

      // Guard: refuse to create a crossing log with no tag reference at all
      if (!body.tag_id) {
        return errorResponse(
          'tag_id (animal tag) is required for crossing logs',
          400
        );
      }

      await dbConnect();

      // Resolve dynamic ObjectId to human-readable tag string if submitted by frontend selector
      body.tag_id = await resolveTagString(body.tag_id);
      body.tag = body.tag_id;

      // ── Validation Interceptor Check ──────────────────────────────────────
      const cleanTag = String(body.tag_id).trim().toUpperCase();
      const LiveStock = mongoose.models.LiveStock || mongoose.model('LiveStock');
      const animalExists = await LiveStock.findOne({ tag_id: cleanTag, isDeleted: false });
      if (!animalExists) {
        return errorResponse(
          'Data Validation Error: Cannot log transaction. The targeted Tag ID does not exist in the Live Stock registry.',
          400
        );
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

      // ── Crossing Attempt Number (use provided from Excel / payload if present, else auto-calculate)
      if (body.crossingAttemptNumber !== undefined && body.crossingAttemptNumber !== null && !isNaN(Number(body.crossingAttemptNumber)) && Number(body.crossingAttemptNumber) > 0) {
        body.crossingAttemptNumber = Number(body.crossingAttemptNumber);
      } else {
        const lastCalving = await CrossingLog.findOne({
          tag_id: cleanTag,
          isDeleted: false,
          actualCalvingDate: { $ne: null }
        }).sort({ actualCalvingDate: -1 });

        const targetCrossingDate = body.crossingDate ? new Date(body.crossingDate) : new Date();

        let attemptsCount = 0;
        if (lastCalving && lastCalving.actualCalvingDate) {
          attemptsCount = await CrossingLog.countDocuments({
            tag_id: cleanTag,
            isDeleted: false,
            crossingDate: { $gt: lastCalving.actualCalvingDate, $lt: targetCrossingDate }
          });
        } else {
          attemptsCount = await CrossingLog.countDocuments({
            tag_id: cleanTag,
            isDeleted: false,
            crossingDate: { $lt: targetCrossingDate }
          });
        }
        body.crossingAttemptNumber = attemptsCount + 1;
      }

      // ── Semen Straw Deduction logic (non-blocking for external/legacy sire batches) ──
      if (body.crossingType === 'Artificial' && body.batchNumber) {
        try {
          const batch = await SemenStraw.findOne({ batchNo: String(body.batchNumber).trim().toUpperCase(), isDeleted: false });
          if (batch && batch.noOfStraws - batch.usedStraws > 0) {
            batch.usedStraws += 1;
            await batch.save();
          }
        } catch (strawErr) {
          console.error('[POST /api/crossing] Semen straw deduction error:', strawErr);
        }
      }

      const record = await CrossingLog.create(body);
      
      // ── Sync born calf to livestock if Calf Tag is present
      if (record.calfTag) {
        await syncCalfRecord(record);
      }

      // If calving occurred, increment calvings for the mother
      if (record.actualCalvingDate) {
        const LiveStockModel = mongoose.models.LiveStock || mongoose.model('LiveStock');
        const CattleModel = mongoose.models.Cattle || mongoose.model('Cattle');
        
        const mother = await LiveStockModel.findOne({ tag_id: cleanTag, isDeleted: false });
        if (mother) {
          const newCalvings = (mother.calvings || 0) + 1;
          const curType = String(mother.animalType || '').toUpperCase().trim();
          let nextType = curType;
          if (curType === 'B.CALF' || curType === 'BCALF' || curType.includes('BUFFALO')) {
            nextType = 'BUFFALO';
          } else if (curType === 'C.CALF' || curType === 'CCALF' || curType.includes('COW') || curType.includes('CALF') || curType.includes('HEIFER') || curType === '' || curType === '-') {
            nextType = 'COW';
          }
          
          await LiveStockModel.findOneAndUpdate(
            { tag_id: cleanTag },
            { calvings: newCalvings, animalType: nextType }
          );
          await CattleModel.findOneAndUpdate(
            { tag: cleanTag },
            { calvings: newCalvings, cattleType: nextType }
          );
          console.log(`[POST /api/crossing] Auto-transitioned and incremented calvings for mother: ${cleanTag}`);
        } else {
          await LiveStockModel.findOneAndUpdate({ tag_id: cleanTag }, { $inc: { calvings: 1 } });
          await CattleModel.findOneAndUpdate({ tag: cleanTag }, { $inc: { calvings: 1 } });
        }
      }

      // Update animal status based on pregnancyStatus/calving
      await updateAnimalStatusFromCrossing(record.tag_id, record.pregnancyStatus, record.actualCalvingDate);

      return createdResponse(record, 'CrossingLog created successfully');
    } catch (error: any) {
      console.error('[POST /api/crossing] Unhandled error:', error);

      if (error?.name === 'ValidationError') {
        const firstMsg = Object.values(error.errors ?? {})[0] as any;
        return errorResponse(firstMsg?.message || error.message || 'Validation failed', 422);
      }

      return errorResponse(error?.message || 'Failed to create crossing log', 500);
    }
  });
}

/**
 * Automatically synchronizes calf registration details from a Calving log event
 * down to a pending record in the LiveStock and legacy Cattle databases.
 */
export async function syncCalfRecord(crossingRecord: any, oldCalfTag?: string) {
  try {
    const calfTag = crossingRecord.calfTag ? String(crossingRecord.calfTag).trim().toUpperCase() : '';
    const oldTagClean = oldCalfTag ? String(oldCalfTag).trim().toUpperCase() : '';
    
    const LiveStock = mongoose.models.LiveStock || mongoose.model('LiveStock');
    const CattleModel = mongoose.models.Cattle || mongoose.model('Cattle');
    
    // If the calf tag is removed or empty but was previously set, soft-delete the pending calf
    if (!calfTag && oldTagClean) {
      await LiveStock.findOneAndUpdate(
        { tag_id: oldTagClean, isPendingDetails: true },
        { isDeleted: true }
      );
      await CattleModel.findOneAndUpdate(
        { tag: oldTagClean, isPendingDetails: true },
        { isDeleted: true }
      );
      return;
    }
    
    if (!calfTag) return;
    
    const motherTag = crossingRecord.tag_id ? String(crossingRecord.tag_id).trim().toUpperCase() : '';
    const sireTag = crossingRecord.maleTag ? String(crossingRecord.maleTag).trim().toUpperCase() : '';
    const dob = crossingRecord.actualCalvingDate || crossingRecord.estimatedCalvingDate || new Date();
    const farmId = crossingRecord.farmId || null;
    
    // Determine mother's animal type for prefilling
    let animalType = 'CATTLE';
    let dameBreed = '';
    let sireBreed = '';

    if (motherTag) {
      const mother = await LiveStock.findOne({ tag_id: motherTag, isDeleted: false });
      if (mother) {
        if (mother.animalType) animalType = mother.animalType;
        if (mother.breed) dameBreed = mother.breed;
      }
    }

    if (sireTag) {
      const father = await LiveStock.findOne({ tag_id: sireTag, isDeleted: false });
      if (father && father.breed) {
        sireBreed = father.breed;
      }
    }
    
    // Try to find if a pending record already exists under the current or old calf tag
    const searchTags = [calfTag];
    if (oldTagClean) searchTags.push(oldTagClean);
    
    const pendingCalf = await LiveStock.findOne({
      tag_id: { $in: searchTags },
      isPendingDetails: true,
      isDeleted: false
    });
    
    if (pendingCalf) {
      // Update existing pending calf record
      pendingCalf.tag_id = calfTag;
      pendingCalf.animalType = animalType;
      pendingCalf.dateOfBirth = dob;
      pendingCalf.dameId = motherTag;
      pendingCalf.dameBreed = dameBreed;
      pendingCalf.sireId = sireTag;
      pendingCalf.sireBreed = sireBreed;
      pendingCalf.farmId = farmId;
      pendingCalf.onboardingType = 'CALVING';
      await pendingCalf.save();
      
      const pendingCattle = await CattleModel.findOne({
        tag: { $in: searchTags },
        isPendingDetails: true,
        isDeleted: false
      });
      
      if (pendingCattle) {
        pendingCattle.tag = calfTag;
        pendingCattle.cattleType = animalType;
        pendingCattle.dateOfBirth = dob;
        pendingCattle.dameId = motherTag;
        pendingCattle.dameBreed = dameBreed;
        pendingCattle.sireId = sireTag;
        pendingCattle.sireBreed = sireBreed;
        pendingCattle.farmId = farmId;
        pendingCattle.onboardingType = 'CALVING';
        await pendingCattle.save();
      }
    } else {
      // Check if an active non-pending animal already exists with the calfTag (to prevent collision)
      const collisionAnimal = await LiveStock.findOne({
        tag_id: calfTag,
        isPendingDetails: { $ne: true },
        isDeleted: false
      });
      
      if (!collisionAnimal) {
        // Create new pending calf in LiveStock
        await LiveStock.create({
          tag_id: calfTag,
          animalType: animalType,
          shedId: null,
          farmId: farmId,
          dateOfBirth: dob,
          dameId: motherTag,
          dameBreed: dameBreed,
          sireId: sireTag,
          sireBreed: sireBreed,
          farmBorn: 'Yes',
          status: 'ACTIVE',
          isPendingDetails: true,
          onboardingType: 'CALVING'
        });
        
        // Create new pending calf in Cattle
        await CattleModel.create({
          tag: calfTag,
          cattleType: animalType,
          shed: '-',
          farmId: farmId,
          dateOfBirth: dob,
          dameId: motherTag,
          dameBreed: dameBreed,
          sireId: sireTag,
          sireBreed: sireBreed,
          farmBorn: 'Yes',
          status: 'ACTIVE',
          isPendingDetails: true,
          onboardingType: 'CALVING'
        });

        // Calvings count is handled separately in the POST/PUT/DELETE handlers to be independent of calfTag registration
      }
    }
  } catch (err) {
    console.error('Non-blocking calf synchronization error:', err);
  }
}

/**
 * Update parent animal's status in LiveStock and Cattle registries based on PD pregnancy tests and Calving.
 */
export async function updateAnimalStatusFromCrossing(tagId: string, pregnancyStatus?: string, actualCalvingDate?: any) {
  try {
    if (!tagId) return;
    const cleanTag = String(tagId).trim().toUpperCase();
    const LiveStock = mongoose.models.LiveStock || mongoose.model('LiveStock');
    const CattleModel = mongoose.models.Cattle || mongoose.model('Cattle');

    let newStatus: string | null = null;
    if (actualCalvingDate) {
      newStatus = 'ACTIVE';
    } else if (pregnancyStatus === 'Positive') {
      newStatus = 'PREGNANT';
    } else if (pregnancyStatus === 'Negative') {
      newStatus = 'EMPTY';
    } else {
      newStatus = 'PENDING';
    }

    if (newStatus) {
      const updateDoc: any = { status: newStatus };
      
      // Auto-transition Heifer/Calf type to adult COW or BUFFALO after calving
      if (actualCalvingDate) {
        const mother = await LiveStock.findOne({ tag_id: cleanTag, isDeleted: false });
        if (mother) {
          const curType = String(mother.animalType || '').toUpperCase().trim();
          let nextType = curType;
          if (curType === 'B.CALF' || curType === 'BCALF' || curType.includes('BUFFALO')) {
            nextType = 'BUFFALO';
          } else if (curType === 'C.CALF' || curType === 'CCALF' || curType.includes('COW') || curType.includes('CALF') || curType.includes('HEIFER') || curType === '' || curType === '-') {
            nextType = 'COW';
          } else {
            nextType = 'COW';
          }
          
          if (nextType !== curType) {
            updateDoc.animalType = nextType;
            // Also update legacy Cattle
            await CattleModel.findOneAndUpdate({ tag: cleanTag }, { cattleType: nextType, status: newStatus });
            console.log(`[updateAnimalStatusFromCrossing] Auto-transitioned mother ${cleanTag} type from ${curType} to ${nextType} after calving.`);
          }
        }
      }

      await LiveStock.findOneAndUpdate({ tag_id: cleanTag }, updateDoc);
      if (!updateDoc.animalType) {
        await CattleModel.findOneAndUpdate({ tag: cleanTag }, { status: newStatus });
      }
      console.log(`[updateAnimalStatusFromCrossing] Synced status of ${cleanTag} to ${newStatus}`);
    }
  } catch (error) {
    console.error('[updateAnimalStatusFromCrossing] Error updating parent animal status:', error);
  }
}
