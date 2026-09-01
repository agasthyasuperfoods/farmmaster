import { NextRequest } from 'next/server';
import dbConnect from '@/src/database/dbConnection';
import { CrossingLog, SaleLog, TreatmentLog, resolveTagString, ShedLog, PurchaseLog } from '@/src/models/Logs';
import LiveStock from '@/src/models/LiveStock';
import Farm from '@/src/models/Farm';
import { withAuth } from '@/src/utils/authGuard';
import { successResponse, errorResponse, createdResponse } from '@/src/utils/responses';
import mongoose from 'mongoose';

function getRequiredPermissionsForType(type: string): string[] {
  const normalized = String(type).trim().toLowerCase();
  const base = ['SUPER_ADMIN', 'FARM_ADMIN'];
  if (normalized === 'crossing') {
    return [...base, 'CROSSING_LOG', 'CROSSING'];
  }
  if (normalized === 'sale') {
    return [...base, 'SALE_LOG', 'SALE'];
  }
  if (normalized === 'shed') {
    return [...base, 'SHED_LOG', 'SHED'];
  }
  if (normalized === 'purchase') {
    return [...base, 'PURCHASE_LOG', 'PURCHASE'];
  }
  if (normalized === 'treatment') {
    return [...base, 'HEALTH', 'HEALTH_MANAGEMENT'];
  }
  return [...base, 'INCHARGE', 'HEALTH'];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const permissions = getRequiredPermissionsForType(type);
  return withAuth(
    req,
    permissions,
    async (user) => {
      let body: any = null;
      try {
        const normalizedType = String(type).trim().toLowerCase();

        // 1. Determine target log model
        let LogModel: any;
        if (normalizedType === 'crossing') {
          LogModel = CrossingLog;
        } else if (normalizedType === 'sale') {
          LogModel = SaleLog;
        } else if (normalizedType === 'treatment') {
          LogModel = TreatmentLog;
        } else if (normalizedType === 'shed') {
          LogModel = ShedLog;
        } else if (normalizedType === 'purchase') {
          LogModel = PurchaseLog;
        } else {
          return errorResponse(`Invalid log type: '${type}'. Allowed types are: crossing, sale, treatment, shed, purchase.`, 400);
        }

        // 2. Parse request JSON body
        try {
          body = await req.json();
        } catch {
          return errorResponse('Request body is not valid JSON', 400);
        }

        // 3. Defensive Data Normalization
        // Force uppercase tag_id at the absolute beginning of payload extraction
        const tagInput = body.tag_id || body.tagId || body.tag || '';
        body.tag_id = String(tagInput).trim().toUpperCase();

        if (normalizedType === 'purchase') {
          if (!body.sellerName && body.purchaseFrom) {
            body.sellerName = body.purchaseFrom;
          }
          if (!body.price && body.purchasePrice) {
            body.price = body.purchasePrice;
          }
        }

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
        
        if (normalizedType === 'purchase') {
          // Purchase logs can be imported for existing livestock or new purchases
          const existingAnimal = await LiveStock.findOne({ tag_id: cleanTag, isDeleted: false });
          if (existingAnimal && existingAnimal.farmId && !body.farmId) {
            body.farmId = existingAnimal.farmId.toString();
          }
        } else {
          // Standard check for existing animals for operational logs
          const animalExists = await LiveStock.findOne({ tag_id: cleanTag, isDeleted: false });
          if (!animalExists) {
            return errorResponse(
              'Data Validation Error: Cannot log transaction. The targeted Tag ID does not exist in the Live Stock registry.',
              400
            );
          }
        }

        // 4. Resolve farmId Dynamically
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

        // 5. Create new operational log record (custom validators will trigger automatically)
        const record = await LogModel.create(body);

        // ── If this is a Purchase Log, sync with LiveStock & Cattle
        if (normalizedType === 'purchase') {
          try {
            const existingAnimal = await LiveStock.findOne({ tag_id: cleanTag, isDeleted: false });
            if (existingAnimal) {
              await LiveStock.findOneAndUpdate(
                { tag_id: cleanTag, isDeleted: false },
                {
                  ...(body.farmId ? { farmId: body.farmId } : {}),
                  purchaseDate: body.purchaseDate || new Date(),
                  purchasePrice: body.price || 0,
                  purchaseFrom: body.sellerName || '',
                  purchaseRemarks: body.sellerContact ? `Seller Contact: ${body.sellerContact}` : '',
                }
              );
              const CattleModel = mongoose.models.Cattle || mongoose.model('Cattle');
              await CattleModel.findOneAndUpdate(
                { tag: cleanTag, isDeleted: false },
                {
                  ...(body.farmId ? { farmId: body.farmId } : {}),
                  purchaseDate: body.purchaseDate || new Date(),
                  purchasePrice: body.price || 0,
                  purchaseFrom: body.sellerName || '',
                  purchaseRemarks: body.sellerContact ? `Seller Contact: ${body.sellerContact}` : '',
                }
              );
            } else {
              await LiveStock.create({
                tag_id: cleanTag,
                animalType: 'PENDING',
                farmId: body.farmId || null,
                purchaseDate: body.purchaseDate || new Date(),
                purchasePrice: body.price || 0,
                purchaseFrom: body.sellerName || '',
                purchaseRemarks: body.sellerContact ? `Seller Contact: ${body.sellerContact}` : '',
                status: 'ACTIVE',
                isPendingDetails: true,
                onboardingType: 'PURCHASE',
              });

              const CattleModel = mongoose.models.Cattle || mongoose.model('Cattle');
              await CattleModel.create({
                tag: cleanTag,
                cattleType: 'PENDING',
                farmId: body.farmId || null,
                purchaseDate: body.purchaseDate || new Date(),
                purchasePrice: body.price || 0,
                purchaseFrom: body.sellerName || '',
                purchaseRemarks: body.sellerContact ? `Seller Contact: ${body.sellerContact}` : '',
                status: 'ACTIVE',
                isPendingDetails: true,
                onboardingType: 'PURCHASE',
              });
            }
          } catch (syncErr) {
            console.error('Non-blocking livestock sync error during purchase creation:', syncErr);
          }
        }

        // ── If this is a Shed Shifting Log, update the animal's current shed assignment
        if (normalizedType === 'shed' && body.newShed) {
          try {
            await LiveStock.findOneAndUpdate(
              { tag_id: cleanTag, isDeleted: false },
              { shedId: body.newShed }
            );
            const CattleModel = mongoose.models.Cattle || mongoose.model('Cattle');
            await CattleModel.findOneAndUpdate(
              { tag: cleanTag, isDeleted: false },
              { shed: body.newShed }
            );
          } catch (syncErr) {
            console.error('Non-blocking livestock shed sync error during creation:', syncErr);
          }
        }

        // ── If this is a Sale Log, update the animal status to SOLD
        if (normalizedType === 'sale') {
          try {
            await LiveStock.findOneAndUpdate(
              { tag_id: cleanTag, isDeleted: false },
              { status: 'SOLD' }
            );
            const CattleModel = mongoose.models.Cattle || mongoose.model('Cattle');
            await CattleModel.findOneAndUpdate(
              { tag: cleanTag, isDeleted: false },
              { status: 'SOLD' }
            );
          } catch (syncErr) {
            console.error('Non-blocking livestock sale sync error during creation:', syncErr);
          }
        }

        return createdResponse(record, `${type.charAt(0).toUpperCase() + type.slice(1)} Log created successfully`);
      } catch (error: any) {
        console.error('[POST /api/logs/[type]] Unhandled error:', error);

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const permissions = getRequiredPermissionsForType(type);
  return withAuth(
    req,
    permissions,
    async () => {
      try {
        const normalizedType = String(type).trim().toLowerCase();

        let LogModel: any;
        if (normalizedType === 'crossing') {
          LogModel = CrossingLog;
        } else if (normalizedType === 'sale') {
          LogModel = SaleLog;
        } else if (normalizedType === 'treatment') {
          LogModel = TreatmentLog;
        } else if (normalizedType === 'shed') {
          LogModel = ShedLog;
        } else if (normalizedType === 'purchase') {
          LogModel = PurchaseLog;
        } else {
          return errorResponse(`Invalid log type: '${type}'.`, 400);
        }

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
            LogModel.countDocuments(query),
            LogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
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
          }, `${type} logs fetched successfully`);
        }

        const records = await LogModel.find(query).sort({ createdAt: -1 });
        return successResponse(records, `${type} logs fetched successfully`);
      } catch (error: any) {
        return errorResponse(error.message || 'Failed to fetch logs', 500);
      }
    }
  );
}
