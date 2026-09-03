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

      const isInactiveStatus = { $nin: ['SOLD', 'DECEASED', 'DEAD', 'sold', 'deceased', 'dead'] };

      // ── 4. Per-shed breakdown ─────────────────────────────────────────────────
      // For each shed, accurately count active animals currently residing in it
      const shedBreakdown = await Promise.all(
        sheds.map(async (shed) => {
          const shedIdStr = String(shed._id);
          const shedCodeStr = String(shed.code || '').trim();
          const cleanNum = shedCodeStr.replace(/[^0-9]/g, '');
          const num = cleanNum ? parseInt(cleanNum, 10) : null;
          const shedNameStr = String(shed.name || '').trim();

          const orConditions: any[] = [
            { shedId: shed._id },
            { shedId: shedIdStr },
            { shedId: shedCodeStr },
            { shed: shed._id },
            { shed: shedIdStr },
            { shed: shedCodeStr },
          ];

          if (num !== null && !isNaN(num)) {
            orConditions.push({ shed: num });
            orConditions.push({ shedId: num });
            orConditions.push({ shed: String(num) });
            orConditions.push({ shedId: String(num) });
            orConditions.push({ shed: new RegExp(`^\\s*(?:[A-Z0-9]+[\\s-_]+)?(?:shed\\s*)?${num}\\s*$`, 'i') });
            orConditions.push({ shedId: new RegExp(`^\\s*(?:[A-Z0-9]+[\\s-_]+)?(?:shed\\s*)?${num}\\s*$`, 'i') });
          }

          if (shedNameStr) {
            orConditions.push({ shedId: shedNameStr });
            orConditions.push({ shed: shedNameStr });
            orConditions.push({ shed: new RegExp(`^\\s*${shedNameStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') });
          }

          const shedOccupied = await LiveStock.countDocuments({
            isDeleted: { $ne: true },
            status: isInactiveStatus,
            $or: orConditions,
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

      // ── 5. Total live occupancy for farm = sum of live cattle in farm sheds ──
      const occupied = shedBreakdown.reduce((sum, s) => sum + s.occupied, 0);

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
