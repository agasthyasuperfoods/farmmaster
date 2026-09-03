import { NextRequest } from 'next/server';
import dbConnect from '@/src/database/dbConnection';
import Farm from '@/src/models/Farm';
import Shed from '@/src/models/Shed';
import LiveStock from '@/src/models/LiveStock';
import { withAuth } from '@/src/utils/authGuard';
import { successResponse, errorResponse, createdResponse, forbiddenResponse } from '@/src/utils/responses';
import { createFarmSchema } from '@/src/utils/validation';

export async function GET(req: NextRequest) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'FARMS'], async (user) => {
    try {
      await dbConnect();
      const { searchParams } = new URL(req.url);
      const embedCapacity = searchParams.get('capacity') === 'true';

      const query: any = { isDeleted: false };
      const userRole = String(user.role).toUpperCase();
      if (userRole !== 'SUPER_ADMIN' && user.farmId) {
        query._id = user.farmId;
      }

      const farms = await Farm.find(query).sort({ createdAt: -1 }).lean();

      if (embedCapacity) {
        const isInactiveStatus = { $nin: ['SOLD', 'DECEASED', 'DEAD', 'sold', 'deceased', 'dead'] };
        const enhancedFarms = await Promise.all(
          farms.map(async (farm) => {
            const sheds = await Shed.find({ farmId: farm._id, isDeleted: false }).lean();
            const maxCapacity = sheds.reduce((sum, s) => sum + (Number(s.capacity) || 0), 0);

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

                const count = await LiveStock.countDocuments({
                  isDeleted: { $ne: true },
                  status: isInactiveStatus,
                  $or: orConditions,
                });
                return count;
              })
            );

            const occupied = shedBreakdown.reduce((sum, c) => sum + c, 0);
            const vacant = Math.max(0, maxCapacity - occupied);
            const usagePercent = maxCapacity > 0 ? Math.round((occupied / maxCapacity) * 1000) / 10 : 0;

            return {
              ...farm,
              capacity: {
                maxCapacity,
                occupied,
                vacant,
                usagePercent,
              },
            };
          })
        );
        return successResponse(enhancedFarms, 'Farms fetched successfully with capacity');
      }

      return successResponse(farms, 'Farms fetched successfully');
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  });
}


export async function POST(req: NextRequest) {
  return withAuth(req, ['SUPER_ADMIN', 'FARM_ADMIN', 'FARMS'], async (user) => {
    try {
      const userRole = String(user.role).toUpperCase();
      if (userRole !== 'SUPER_ADMIN') {
        return forbiddenResponse('Only super administrators can create new farms');
      }
      const parsedBody = createFarmSchema.safeParse(await req.json());
      if (!parsedBody.success) {
        return errorResponse(parsedBody.error.issues[0]?.message || 'Invalid request body', 400);
      }
      const { name, code, address, location } = parsedBody.data;

      await dbConnect();
      
      const existingFarm = await Farm.findOne({ code });
      if (existingFarm) {
        if (!existingFarm.isDeleted) {
          return errorResponse('Farm code already exists', 400);
        }
        const farm = await Farm.findByIdAndUpdate(
          existingFarm._id,
          { name, code, address, location, isDeleted: false },
          { new: true }
        );
        return createdResponse(farm, 'Farm created successfully');
      }

      const farm = await Farm.create({
        name,
        code,
        address,
        location,
      });

      return createdResponse(farm, 'Farm created successfully');
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  });
}
