import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/src/database/dbConnection';
import Farm from '@/src/models/Farm';
import Shed from '@/src/models/Shed';
import LiveStock from '@/src/models/LiveStock';
import { withAuth } from '@/src/utils/authGuard';
import { successResponse, errorResponse, notFoundResponse } from '@/src/utils/responses';
import { objectIdSchema } from '@/src/utils/validation';

/**
 * GET /api/farms/[id]/capacity
 *
 * Farm Capacity Engine — real-time aggregation endpoint.
 *
 * Returns:
 *   - maxCapacity:   sum of all sheds' `capacity` values for this farm
 *   - occupied:      count of ACTIVE, non-deleted LiveStock records in those sheds
 *   - vacant:        maxCapacity - occupied
 *   - usagePercent:  (occupied / maxCapacity) * 100, rounded to 1 decimal
 *   - sheds:         per-shed breakdown with individual occupancy counts
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'FARMS', 'FARM_MANAGEMENT'], async () => {
    try {
      const { id } = await params;

      const parsedId = objectIdSchema.safeParse(id);
      if (!parsedId.success) {
        return errorResponse('Invalid farm ID format', 400);
      }

      const farmObjectId = new mongoose.Types.ObjectId(parsedId.data);

      await dbConnect();

      // ── 1. Verify farm exists ─────────────────────────────────────────────────
      const farm = await Farm.findOne({ _id: farmObjectId, isDeleted: false }).lean();
      if (!farm) {
        return notFoundResponse('Farm not found');
      }

      // ── 2. Fetch all active sheds for this farm ───────────────────────────────
      const sheds = await Shed.find({
        farmId: farmObjectId,
        isDeleted: false,
      }).lean();

      // ── 3. Max structural capacity: sum of all shed capacity values ───────────
      const maxCapacity = sheds.reduce(
        (sum, shed) => sum + (Number(shed.capacity) || 0),
        0
      );

      // ── 4. Live occupancy: count active animals assigned to this farm ─────────
      // We match on farmId covering both ObjectId and string/code variants
      // that older records may carry.
      const shedIds = sheds.map((s) => String(s._id));

      const occupied = await LiveStock.countDocuments({
        isDeleted: false,
        status: { $nin: ['SOLD', 'DECEASED'] },
        $and: [
          {
            $or: [
              { farmId: farmObjectId },
              { farmId: String(farm._id) },
              { farmId: farm.code },
              { farmId: farm.name }
            ]
          },
          {
            $or: [
              { shedId: { $in: shedIds } },
              { shed: { $in: sheds.map(s => String(s.code)) } },
              { shedId: { $in: sheds.map(s => String(s.code)) } }
            ]
          }
        ]
      });

      // ── 5. Per-shed breakdown ─────────────────────────────────────────────────
      // For each shed, count active animals whose shedId matches this shed's
      // _id (as ObjectId or string) or name/code.
      const shedBreakdown = await Promise.all(
        sheds.map(async (shed) => {
          const shedIdStr = String(shed._id);
          const shedOccupied = await LiveStock.countDocuments({
            isDeleted: false,
            status: { $nin: ['SOLD', 'DECEASED'] },
            $or: [
              { shedId: shed._id },
              { shedId: shedIdStr },
              { shedId: shed.code },
              { shedId: shed.name },
            ],
          });

          return {
            shedId: shedIdStr,
            name: shed.name,
            code: shed.code,
            capacity: Number(shed.capacity) || 0,
            occupied: shedOccupied,
            vacant: Math.max(0, (Number(shed.capacity) || 0) - shedOccupied),
            status: shed.status,
          };
        })
      );

      // ── 6. Balancing calculations ─────────────────────────────────────────────
      const vacant = Math.max(0, maxCapacity - occupied);
      const usagePercent =
        maxCapacity > 0
          ? Math.round((occupied / maxCapacity) * 1000) / 10 // 1 decimal
          : 0;

      return successResponse(
        {
          farmId: String(farm._id),
          farmName: (farm as any).name,
          farmCode: (farm as any).code,
          maxCapacity,
          occupied,
          vacant,
          usagePercent,
          sheds: shedBreakdown,
        },
        'Farm capacity data fetched successfully'
      );
    } catch (error: any) {
      console.error('[GET /api/farms/[id]/capacity]', error);
      return errorResponse(error.message || 'Failed to compute farm capacity', 500);
    }
  });
}
