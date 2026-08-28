import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { verifyAccessToken, TokenPayload } from '@/src/utils/jwt';
import { unauthorizedResponse, forbiddenResponse } from '@/src/utils/responses';

import dbConnect from '@/src/database/dbConnection';
import User from '@/src/models/User';
import Role from '@/src/models/Role';

export async function authenticate(req: NextRequest): Promise<TokenPayload | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyAccessToken(token);
  
  if (!payload) return null;

  // Ensure user exists and is still active in the database
  try {
    await dbConnect();
    const user = await User.findById(payload.userId).select('status role farmId').lean();
    if (!user || user.status === false) {
      return null;
    }
    
    // Refresh permissions and farmId on every request for immediate revocation/granting
    const roleDoc = await Role.findOne({ name: String(user.role).toUpperCase() }).lean();
    let permissions = roleDoc?.permissions || [];
    
    // Failsafe for Super Admin
    if (permissions.length === 0 && user.role === 'SUPER_ADMIN') {
      permissions = ['ALL'];
    }
    
    payload.permissions = permissions;
    payload.farmId = user.farmId ? user.farmId.toString() : null;
  } catch (error) {
    console.error("Auth DB Check Error:", error);
    throw error;
  }

  return payload;
}

const BASE_TOKEN_MAP: Record<string, string[]> = {
  CATTLE: ['CATTLE_MANAGEMENT', 'TAG_MANAGEMENT', 'BREED_MANAGEMENT', 'ANIMAL_MANAGEMENT', 'LIVESTOCK'],
  HEALTH: ['HEALTH_MANAGEMENT', 'TREATMENT_LOG', 'VACCINATION_LOG', 'HEALTH'],
  INVENTORY: ['FEED_ITEMS', 'FEED_INVENTORY', 'MEDICINE_INVENTORY', 'INVENTORY'],
  MILK: ['MILK_COLLECTION', 'MILK_QA', 'MILK_PROCUREMENT', 'MILK_PERFORMANCE', 'MILK'],
  MILK_PRODUCTION: ['MILK_COLLECTION', 'MILK_QA', 'MILK_PROCUREMENT', 'MILK_PERFORMANCE', 'MILK'],
  USERS: ['USER_MANAGEMENT'],
  DEPARTMENTS: ['DEPARTMENT'],
  FARMS: ['FARM_MANAGEMENT'],
  LAND: ['LAND_MANAGEMENT', 'LAND'],
  SHEDS: ['SHED_MANAGEMENT', 'LINE_MANAGEMENT', 'SHEDS'],
  BMC: ['BMC'],
  SHED_LOG: ['SHED_LOG'],
  CROSSING_LOG: ['CROSSING_LOG', 'INSEMINATION_MANAGEMENT'],
  PURCHASE_LOG: ['PURCHASE_LOG'],
  SALE_LOG: ['SALE_LOG'],
  GRASS: ['GRASS', 'GRASS_COLLECTION'],
  FEEDING: ['FEEDING'],
  GRASS_MANAGEMENT: ['GRASS_MANAGEMENT'],
  LABOR_MANAGEMENT: ['LABOR_MANAGEMENT', 'DESIGNATIONS', 'LABORS'],
  PROCUREMENT_MANAGEMENT: ['PROCUREMENT_MANAGEMENT'],
};

export function authorize(user: TokenPayload, allowedRolesOrPermissions: string[], method: string = 'GET', pathname?: string) {
  // Always grant access to roles that have the 'ALL' permission
  if (user.permissions?.includes('ALL')) {
    return true;
  }

  // Allow read-only (GET) requests for essential lookup tables to all authenticated users
  if (method.toUpperCase() === 'GET' && pathname) {
    const isLookupPath = 
      pathname.startsWith('/api/farms') || 
      pathname.startsWith('/api/lands') || 
      pathname.startsWith('/api/sheds') || 
      pathname.startsWith('/api/cattle') || 
      pathname.startsWith('/api/breeds') || 
      pathname.startsWith('/api/feed-items') || 
      pathname.startsWith('/api/medicines') ||
      pathname.startsWith('/api/animals') ||
      pathname.startsWith('/api/designations') ||
      pathname.startsWith('/api/labors') || 
      pathname.startsWith('/api/bmcs') || 
      pathname.startsWith('/api/procurement-sources') ||
      pathname.startsWith('/api/tags');
    if (isLookupPath) {
      return true;
    }
  }

  // Determine required action suffix based on request method
  let suffix = 'VIEW';
  const upperMethod = method.toUpperCase();
  if (upperMethod === 'POST') {
    suffix = 'CREATE';
  } else if (upperMethod === 'PUT' || upperMethod === 'PATCH') {
    suffix = 'EDIT';
  } else if (upperMethod === 'DELETE') {
    suffix = 'DELETE';
  }

  // Check if user's role OR any of their permissions match the required list
  return allowedRolesOrPermissions.some(req => {
    // 1. Direct match (e.g. user.role === req or user.permissions has req)
    // We strictly ignore role name match for FARM_ADMIN and INCHARGE to enforce their customized permissions!
    if (user.role === req && req.toUpperCase() !== 'FARM_ADMIN' && req.toUpperCase() !== 'INCHARGE') {
      return true;
    }

    if (user.permissions?.includes(req)) {
      return true;
    }

    // 2. Granular sub-module match
    // If the required permission is a baseToken (like CATTLE), and the user has any of its sub-module permissions (like LIVESTOCK_VIEW)
    const reqUpper = req.toUpperCase();
    let subPrefixes = BASE_TOKEN_MAP[reqUpper];
    if (!subPrefixes) {
      subPrefixes = [reqUpper];
    }

    const getBaseModule = (perm: string): string => {
      const upper = perm.toUpperCase();
      const suffixes = ['_VIEW', '_CREATE', '_EDIT', '_DELETE'];
      for (const s of suffixes) {
        if (upper.endsWith(s)) {
          return upper.substring(0, upper.length - s.length);
        }
      }
      return upper;
    };

    return subPrefixes.some(prefix => 
      user.permissions?.some(p => {
        const upperP = String(p).trim().toUpperCase();
        const userModule = getBaseModule(upperP);

        // The user's permission module must exactly match the required prefix (preventing bleed-through like GRASS matching GRASS_MANAGEMENT)
        if (userModule !== prefix) {
          return false;
        }

        // Wildcard check (e.g. user has 'GRASS_COLLECTION')
        if (upperP === userModule) {
          return true;
        }

        // Specific action check (e.g. user has 'GRASS_COLLECTION_VIEW')
        const requiredActionToken = `${prefix}_${suffix}`;
        return upperP === requiredActionToken;
      })
    );
  });
}

export async function withAuth(
  req: NextRequest,
  allowedRolesOrPermissions: string[],
  handler: (user: TokenPayload) => Promise<Response>
) {
  let response: Response;
  try {
    const user = await authenticate(req);
    if (!user) {
      response = unauthorizedResponse('Invalid or expired token');
    } else {
      const { pathname } = req.nextUrl;
      if (!authorize(user, allowedRolesOrPermissions, req.method, pathname)) {
        response = forbiddenResponse('You do not have permission for this action');
      } else {
        response = await handler(user);
      }
    }
  } catch (err) {
    console.error('[withAuth] Unexpected auth/DB error:', err);
    response = NextResponse.json(
      { success: false, error: 'Database or Internal authentication error' },
      { status: 500 }
    );
  }

  // Calculate and log transfer sizes
  const { pathname } = req.nextUrl;
  const reqSize = parseInt(req.headers.get('content-length') || '0', 10);
  const reqSizeKB = (reqSize / 1024).toFixed(2);

  let resSize = 0;
  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    resSize = parseInt(contentLength, 10);
  } else {
    // Only clone and read blob if it's text or JSON to avoid memory issues on files/streams
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json') || contentType.includes('text/')) {
      try {
        const cloned = response.clone();
        const blob = await cloned.blob();
        resSize = blob.size;
      } catch (error) {
        // Suppress errors during cloning or reading body
      }
    }
  }
  const resSizeKB = (resSize / 1024).toFixed(2);

  console.log(`[API] ${req.method} ${pathname} - Req: ${reqSizeKB}KB | Res: ${resSizeKB}KB`);

  return response;
}
