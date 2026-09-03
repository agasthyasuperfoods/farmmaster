import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/src/database/dbConnection';
import LiveStock from '@/src/models/LiveStock';
import Cattle from '@/src/models/Cattle';
import Tag from '@/src/models/Tag';
import Farm from '@/src/models/Farm';
import Shed from '@/src/models/Shed';
import { CrossingLog } from '@/src/models/Logs';
import MilkCollection from '@/src/models/MilkCollection';
import { withAuth } from '@/src/utils/authGuard';
import { successResponse, errorResponse, createdResponse } from '@/src/utils/responses';
import { createCattleSchema } from '@/src/utils/validation';

// ─── Shared Defensive Deep Sanitization Helper ──────────────────────────────────

export function deepSanitizeCattleInput(body: any, userFarmId?: string | null) {
  if (!body || typeof body !== 'object') return;

  // 1. Defuse strict Mongoose Date casting crash ("-", "dd/mm/yyyy", "")
  const dateFields = ['dateOfBirth', 'purchaseDate', 'date'];
  for (const field of dateFields) {
    const rawVal = body[field];
    if (
      rawVal === '' ||
      rawVal === null ||
      rawVal === undefined ||
      rawVal === '-' ||
      String(rawVal).trim().toLowerCase() === 'dd/mm/yyyy'
    ) {
      body[field] = null;
    } else if (typeof rawVal === 'string') {
      const cleaned = rawVal.trim();
      if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'dd/mm/yyyy') {
        body[field] = null;
      } else {
        const parsed = new Date(cleaned);
        if (isNaN(parsed.getTime())) {
          body[field] = null;
        } else {
          body[field] = parsed;
        }
      }
    }
  }

  // 2. Defuse strict Mongoose Number casting crashes
  const numberFields = ['calvings', 'production', 'milkCollection', 'weight', 'purchasePrice', 'lineNo', 'position'];
  for (const field of numberFields) {
    const rawVal = body[field];
    if (
      rawVal === '' ||
      rawVal === null ||
      rawVal === undefined ||
      rawVal === '-' ||
      String(rawVal).trim() === ''
    ) {
      body[field] = 0;
    } else {
      const parsed = Number(String(rawVal).trim());
      if (isNaN(parsed)) {
        body[field] = 0;
      } else {
        body[field] = parsed;
      }
    }
  }

  // 3. Normalizing relational object references (farmId, shedId)
  const refFields = ['farmId', 'shedId'];
  for (const field of refFields) {
    const rawVal = body[field];
    if (!rawVal || rawVal === 'UNKNOWN_FARM' || rawVal === '-') {
      body[field] = null;
    } else if (typeof rawVal === 'string') {
      const cleaned = rawVal.trim();
      if (mongoose.Types.ObjectId.isValid(cleaned)) {
        body[field] = new mongoose.Types.ObjectId(cleaned);
      } else {
        // Leave it as string (since schema has loose type Mixed) or clean it to null
        body[field] = cleaned;
      }
    }
  }

  // 4. Force default fallback for farmId if empty
  if (!body.farmId && userFarmId && mongoose.Types.ObjectId.isValid(userFarmId)) {
    body.farmId = new mongoose.Types.ObjectId(userFarmId);
  }

  // 5. Unify fields between Cattle & LiveStock models for absolute backwards compatibility
  // Normalize Tag ID
  const tagVal = String(body.tag || body.tag_id || body.tagId || '').trim();
  body.tag = tagVal;
  body.tag_id = tagVal.toUpperCase();

  // Normalize Cattle/Animal Type
  const typeVal = String(body.cattleType || body.animalType || 'COW').trim().toUpperCase();
  body.cattleType = typeVal;
  body.animalType = typeVal;

  // Normalize Shed Number / Shed ID
  let shedVal = String(body.shed || body.shedId || '').trim();
  if (shedVal && shedVal !== '-') {
    const match = shedVal.match(/\d+/);
    if (match) {
      shedVal = match[0];
    }
  } else if (!shedVal) {
    shedVal = '-';
  }
  body.shed = shedVal;
  body.shedId = shedVal;

  // Normalize Status
  const statusVal = String(body.status || 'ACTIVE').trim().toUpperCase();
  body.status = ['ACTIVE', 'SOLD', 'DECEASED', 'PREGNANT', 'DRY', 'EMPTY', 'PENDING', 'ONE_TIME_MILKING', 'ONE TIME MILKING'].includes(statusVal) ? statusVal : 'ACTIVE';

  // Force calvings to 0 if gender is Male
  const genderVal = String(body.gender || '').trim().toUpperCase();
  if (genderVal === 'MALE') {
    body.calvings = 0;
  }
}

// ─── GET API Route ─────────────────────────────────────────────────────────────

export function mapLiveStockToCattle(
  r: any,
  farmMap?: Map<string, string>,
  tagToStatus?: Map<string, string>,
  tagToAverageMilk?: Map<string, number>
) {
  if (!r) return r;
  const doc = r.toObject ? r.toObject() : JSON.parse(JSON.stringify(r));
  const tag = String(doc.tag_id || doc.tag || '').trim().toUpperCase();

  // Ensure tag is present for frontend compatibility
  if (!doc.tag) doc.tag = doc.tag_id || '';
  if (!doc.tag_id) doc.tag_id = doc.tag;

  // Ensure cattleType is present for frontend compatibility
  if (!doc.cattleType) {
    doc.cattleType = doc.animalType
      ? String(doc.animalType).charAt(0).toUpperCase() + String(doc.animalType).slice(1).toLowerCase()
      : 'Cow';
  }
  if (!doc.animalType) doc.animalType = doc.cattleType;

  // Ensure shed is present for frontend compatibility
  if (!doc.shed) doc.shed = doc.shedId || '-';
  if (!doc.shedId) doc.shedId = doc.shed;

  // Ensure dob is present for frontend dynamic age calculation
  if (!doc.dob && doc.dateOfBirth) {
    doc.dob = doc.dateOfBirth;
  }
  if (!doc.dateOfBirth && doc.dob) {
    doc.dateOfBirth = doc.dob;
  }

  // Ensure entryDate is present (the first table column in the UI)
  if (!doc.entryDate) {
    const d = doc.date || doc.createdAt;
    if (d) {
      const dateObj = new Date(d);
      if (!isNaN(dateObj.getTime())) {
        doc.entryDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
      }
    }
    if (!doc.entryDate) {
      doc.entryDate = '-';
    }
  }

  // Dynamic status check from CrossingLog (only if not SOLD, DECEASED, DEAD, or DRY)
  const isInactiveOrDry = ['SOLD', 'DECEASED', 'DEAD', 'DRY'].includes(String(doc.status).trim().toUpperCase());
  if (!isInactiveOrDry && tagToStatus && tagToStatus.has(tag)) {
    doc.status = tagToStatus.get(tag);
  } else {
    doc.status = doc.status || 'ACTIVE';
  }

  // Dynamic milk yield check from MilkCollection
  if (tagToAverageMilk && tagToAverageMilk.has(tag)) {
    doc.milk = tagToAverageMilk.get(tag);
  } else {
    doc.milk = 0;
  }

  // Resolve Farm Name & ID
  if (farmMap && doc.farmId) {
    const fId = doc.farmId.toString();
    doc.farmName = farmMap.get(fId) || farmMap.get(fId.toUpperCase()) || fId;
  } else if (farmMap && doc.shed) {
    const shedUpper = String(doc.shed).toUpperCase();
    if (shedUpper.includes('TKP') || shedUpper.includes('TALAKONDAPALLY') || shedUpper.includes('TANAKONDAPALLI')) {
      doc.farmName = farmMap.get('TKP') || 'Tanakondapalli';
      if (farmMap.has('TKP_ID')) doc.farmId = farmMap.get('TKP_ID');
    } else if (shedUpper.includes('TDR') || shedUpper.includes('TANDUR')) {
      doc.farmName = farmMap.get('TDR') || 'Tandur';
      if (farmMap.has('TDR_ID')) doc.farmId = farmMap.get('TDR_ID');
    } else {
      doc.farmName = '-';
    }
  } else {
    doc.farmName = '-';
  }

  return doc;
}

export async function GET(req: NextRequest) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'CATTLE'], async () => {
    try {
      await dbConnect();

      // Fetch all farms to map ObjectId & Code & Name -> Farm Name (projection only)
      const farms = await Farm.find({ isDeleted: false }, { _id: 1, name: 1, code: 1 }).lean();
      const farmMap = new Map<string, string>();
      for (const f of farms) {
        const idStr = f._id.toString();
        farmMap.set(idStr, f.name);
        if (f.code) {
          const cUpper = String(f.code).toUpperCase();
          farmMap.set(cUpper, f.name);
          farmMap.set(`${cUpper}_ID`, idStr);
        }
        if (f.name) {
          farmMap.set(String(f.name).toUpperCase(), f.name);
        }
      }

      // Fetch latest CrossingLog for status overrides (lean + projection + limit)
      const crossingLogs = await CrossingLog.find(
        { isDeleted: false },
        { tag_id: 1, tag: 1, actualCalvingDate: 1, pregnancyStatus: 1, createdAt: 1 }
      )
        .sort({ createdAt: -1 })
        .limit(2000)
        .lean();

      const tagToStatus = new Map<string, string>();
      for (const log of crossingLogs) {
        const tag = String(log.tag_id || log.tag || '').trim().toUpperCase();
        if (tag && !tagToStatus.has(tag)) {
          if (log.actualCalvingDate) {
            tagToStatus.set(tag, 'ACTIVE');
          } else if (log.pregnancyStatus === 'Positive') {
            tagToStatus.set(tag, 'PREGNANT');
          } else if (log.pregnancyStatus === 'Pending') {
            tagToStatus.set(tag, 'PENDING');
          } else if (log.pregnancyStatus === 'Negative') {
            tagToStatus.set(tag, 'ACTIVE');
          }
        }
      }

      // Fetch MilkCollection records ONLY for yesterday (not the entire database history)
      const today = new Date();
      today.setHours(0, 0, 0, 0); 
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);

      const milkCollections = await MilkCollection.find(
        { isDeleted: false, date: { $gte: yesterday, $lte: yesterdayEnd } },
        { tag_id: 1, tagId: 1, date: 1, quantity: 1 }
      ).lean();

      const tagToLatestSum = new Map<string, number>();
      for (const col of milkCollections) {
        const tag = String(col.tag_id || col.tagId || '').trim().toUpperCase();
        if (tag) {
          tagToLatestSum.set(tag, (tagToLatestSum.get(tag) || 0) + (col.quantity || 0));
        }
      }

      const tagToAverageMilk = new Map<string, number>();
      for (const tag of tagToLatestSum.keys()) {
        const sum = tagToLatestSum.get(tag) || 0;
        tagToAverageMilk.set(tag, Number((sum / 2).toFixed(2)));
      }

      const records = await LiveStock.find({ isDeleted: false }).sort({ createdAt: -1 }).lean();
      let mappedRecords = records.map(r => mapLiveStockToCattle(r, farmMap, tagToStatus, tagToAverageMilk));

      const { searchParams } = new URL(req.url);
      const queryDate = searchParams.get('date');

      if (queryDate) {
        const targetDate = new Date(queryDate);
        if (!isNaN(targetDate.getTime())) {
          const targetEnd = new Date(targetDate);
          targetEnd.setHours(23, 59, 59, 999);

          const { ShedLog } = await import('@/src/models/Logs');
          const logs = await ShedLog.find({
            isDeleted: false,
            shiftingDate: { $gt: targetEnd }
          }).sort({ shiftingDate: -1, createdAt: -1 }).lean();

          const recordsMap = new Map(mappedRecords.map(r => [String(r.tag_id || r.tag || '').trim().toUpperCase(), r]));

          for (const log of logs) {
            const tag = String(log.tag_id).trim().toUpperCase();
            const doc = recordsMap.get(tag);
            if (doc) {
              const oldShedVal = log.oldShed === '-' ? null : log.oldShed;
              doc.shedId = oldShedVal;
              doc.shed = oldShedVal;
              doc.lineNo = log.oldLineNo || 0;
              doc.position = log.oldPosition || 0;
            }
          }

          // Filter out animals created/added AFTER the target date
          mappedRecords = mappedRecords.filter(r => {
            const addedDate = r.purchaseDate || r.dateOfBirth || r.createdAt;
            if (addedDate) {
              const addedTime = new Date(addedDate).getTime();
              return addedTime <= targetEnd.getTime();
            }
            return true;
          });
        }
      }

      const pageParam = searchParams.get('page');
      const limitParam = searchParams.get('limit');

      if (pageParam || limitParam) {
        const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
        const limit = Math.max(1, parseInt(limitParam || '10', 10) || 10);
        const total = mappedRecords.length;
        const totalPages = Math.ceil(total / limit);
        const skip = (page - 1) * limit;
        const paginatedData = mappedRecords.slice(skip, skip + limit);

        return successResponse({
          data: paginatedData,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }, 'LiveStock fetched successfully');
      }

      return successResponse(mappedRecords, 'LiveStock fetched successfully');
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  });
}

// ─── POST API Route ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'CATTLE'], async (user) => {
    try {
      let body = await req.json();

      // Execute Deep Defensive Sanitization before Mongoose validator processes the query
      deepSanitizeCattleInput(body, user.farmId);

      const parsedBody = createCattleSchema.safeParse(body);
      if (!parsedBody.success) {
        return errorResponse(parsedBody.error.issues[0]?.message || 'Invalid Request Body schema structure', 400);
      }
      body = parsedBody.data;

      await dbConnect();

      // Check if tag already exists in active records in either primary or legacy registry
      const [existingLiveStock, existingCattle] = await Promise.all([
        LiveStock.findOne({ tag_id: body.tag_id, isDeleted: false }),
        Cattle.findOne({ tag: body.tag, isDeleted: false })
      ]);

      if (existingLiveStock || existingCattle) {
        // If animal already exists, just return the existing livestock instead of failing with 400 error
        return successResponse(existingLiveStock || existingCattle, 'Cattle record already exists in registry');
      }

      // Hard-delete any old soft-deleted records with this tag to prevent unique index violation on save
      await Promise.all([
        LiveStock.deleteMany({ tag_id: body.tag_id, isDeleted: true }),
        Cattle.deleteMany({ tag: body.tag, isDeleted: true })
      ]);

      // ── Resolve farmId from short codes / names if it is still a string
      if (body.farmId && !mongoose.Types.ObjectId.isValid(body.farmId.toString())) {
        const farmStr = String(body.farmId).trim();
        const farm = await Farm.findOne({
          $or: [
            { code: { $regex: new RegExp(`^${farmStr}$`, 'i') } },
            { name: { $regex: new RegExp(`^${farmStr}$`, 'i') } },
            { name: { $regex: new RegExp(farmStr, 'i') } },
            { code: { $regex: new RegExp(farmStr, 'i') } },
          ],
          isDeleted: false
        });
        if (farm) {
          body.farmId = farm._id;
        } else if (user.farmId && mongoose.Types.ObjectId.isValid(user.farmId)) {
          body.farmId = new mongoose.Types.ObjectId(user.farmId);
        }
      }

      // If still missing farmId, attempt to resolve from shed name
      if (!body.farmId && body.shed && body.shed !== '-') {
        const shedStr = String(body.shed).trim();
        const matchedShed = await Shed.findOne({
          $or: [
            { name: { $regex: new RegExp(shedStr, 'i') } },
            { code: shedStr }
          ],
          isDeleted: false
        });
        if (matchedShed && matchedShed.farmId) {
          body.farmId = matchedShed.farmId;
        }
      }

      // If still missing farmId, attempt to assign authenticated user's farmId
      if (!body.farmId && user.farmId && mongoose.Types.ObjectId.isValid(user.farmId)) {
        body.farmId = new mongoose.Types.ObjectId(user.farmId);
      }

      // If still missing farmId, pull first farm in system
      if (!body.farmId) {
        const defaultFarm = await Farm.findOne({ isDeleted: false });
        if (defaultFarm) {
          body.farmId = defaultFarm._id;
        }
      }

      // Create entries in BOTH collections simultaneously to ensure database relationships are fully unified
      const liveStockRecord = await LiveStock.create(body);

      try {
        await Cattle.create({
          ...body,
          farmId: body.farmId,
        });
      } catch (err) {
        console.error('Non-blocking legacy Cattle sync failure:', err);
      }

      // Update associated Tag status
      if (body.tag) {
        const tag = await Tag.findOne({ tagId: body.tag });
        if (tag) {
          tag.status = 'ASSIGNED';
          await tag.save();
        }
      }

      return createdResponse(liveStockRecord, 'Cattle record registered successfully in unified registry');
    } catch (error: any) {
      console.error('[POST /api/cattle] Controller crash prevented:', error);
      return errorResponse(error.message || 'Failed to save cattle record due to database validation mismatch.', 500);
    }
  });
}
