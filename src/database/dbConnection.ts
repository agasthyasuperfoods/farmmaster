import dns from 'dns';
dns.setServers(['8.8.8.8']);
import mongoose from 'mongoose';
// redeploy: 2026-08-14

// ─── Pre-register all models to resolve Mongoose lazy-loading race conditions ───
import '../models/Farm';
import '../models/Land';
import '../models/BMC';

import '../models/Shed';
import '../models/Cattle';
import '../models/LiveStock';
import '../models/Animal';
import '../models/Tag';
import '../models/User';
import '../models/Role';
import '../models/Logs'; // registers CrossingLog, SaleLog, and TreatmentLog
import '../models/VaccinationLog';
import '../models/Vaccine';
import '../models/FeedInventory';
import '../models/MedicineInventory';
import '../models/Medicine';
import '../models/GrassCollection';
import '../models/DailyFeeding';
import '../models/MilkCollection';
import '../models/MilkQuality';
import '../models/Department';
import '../models/TagSuffix';
import '../models/Designation';
import '../models/Labor';
import '../models/ProcurementSource';
import '../../app/api/customer-app/models/Customer';
import '../../app/api/customer-app/models/Address';
import '../../app/api/customer-app/models/Cart';
import '../../app/api/customer-app/models/Category';
import '../../app/api/customer-app/models/DeliveryExecutive';
import '../../app/api/customer-app/models/DeliveryLocation';
import '../../app/api/customer-app/models/DeliveryRoute';
import '../../app/api/customer-app/models/Favourite';
import '../../app/api/customer-app/models/Order';
import '../../app/api/customer-app/models/PaymentMethod';
import '../../app/api/customer-app/models/Product';
import '../../app/api/customer-app/models/ProductInventory';

function cleanMongoUri(rawUri?: string): string {
  let uri = (rawUri || '').trim();
  if (uri.startsWith('"') && uri.endsWith('"')) uri = uri.slice(1, -1);
  if (uri.startsWith("'") && uri.endsWith("'")) uri = uri.slice(1, -1);
  uri = uri.trim();
  if (!uri) {
    uri = 'mongodb+srv://agasthyanutromilkanm_db_user:RIUUsL50QZtWqd6R@anm.spyvi98.mongodb.net/farmmaster';
  }
  if (uri.startsWith('mongodb+srv://')) {
    // Strip illegal port numbers from mongodb+srv format (e.g. :27017)
    uri = uri.replace(/^(mongodb\+srv:\/\/(?:[^:@\/]+(?::[^@\/]+)?@)?)([^:\/?#]+)(?::\d+)?(\/.*)?$/, '$1$2$3');
  }
  return uri;
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  const rawUri = process.env.MONGODB_URI;
  const mongodbUri = cleanMongoUri(rawUri);
  console.log('--- dbConnect() called. target URI:', mongodbUri, 'cached:', !!cached.conn);

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const dbName = process.env.MONGODB_DB;
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      ...(dbName ? { dbName } : {}),
    };

    try {
      dns.setServers(['8.8.8.8', '8.8.4.4']);
      console.log('Dynamically set DNS servers to [8.8.8.8, 8.8.4.4] in dbConnect.');
    } catch (err) {
      console.error('Non-blocking error setting DNS servers:', err);
    }

    console.log('Connecting to MongoDB URI:', mongodbUri);
    cached.promise = mongoose.connect(mongodbUri, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;

