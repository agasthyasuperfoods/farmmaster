import mongoose, { Schema, Document, Model } from 'mongoose';
import LiveStock from './LiveStock';
import Cattle from './Cattle';

// ─── Shared Utility ───────────────────────────────────────────────────────────

export function safeDateParse(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '-') return null;
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'number' && isFinite(value)) {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

// ─── Asynchronous tag_id Foreign-Key Validator ──────────────────────────────────

export async function resolveTagString(value: string): Promise<string> {
  if (!value) return value;
  const cleanValue = String(value).trim();
  if (/^[0-9a-fA-F]{24}$/.test(cleanValue)) {
    try {
      // 1. Check LiveStock
      const liveAnimal = await LiveStock.findById(cleanValue).lean();
      if (liveAnimal && liveAnimal.tag_id) {
        return String(liveAnimal.tag_id).trim();
      }

      // 2. Check Cattle
      const cattleAnimal = await Cattle.findById(cleanValue).lean();
      if (cattleAnimal && cattleAnimal.tag) {
        return String(cattleAnimal.tag).trim();
      }
    } catch (err) {
      console.error('[resolveTagString] error:', err);
    }
  }
  return cleanValue;
}

async function validateLiveStockTag(this: any, value: string): Promise<boolean> {
  return true;
}

// ─── CROSSING LOG ─────────────────────────────────────────────────────────────

export interface ICrossingLog extends Document {
  tag_id: string;
  tag?: string;
  maleTag?: string;
  crossingType?: string;
  batchNumber?: string;
  crossingDate?: Date;
  crossingAttemptNumber?: number;
  pdDate?: Date;
  pregnancyStatus?: string;
  pregnancyConfirmedDate?: Date;
  estimatedCalvingDate?: Date;
  pregnantAge?: string;
  actualCalvingDate?: Date;
  calvingStatus?: string;
  calfTag?: string;
  breedType?: string;
  heatMonitoring1stNotification?: Date;
  heatMonitoring2ndNotification?: Date;
  remarks?: string;
  farmId?: mongoose.Types.ObjectId;
  isDeleted: boolean;
}

const CrossingLogSchema = new Schema<ICrossingLog>(
  {
    tag_id: {
      type: String,
      required: [true, 'tag_id is required — every crossing log must reference an active livestock tag'],
      trim: true,
      uppercase: true,
      index: true,
      validate: {
        validator: validateLiveStockTag,
        message: 'Validation failed: Animal with Tag ID {VALUE} does not exist in active Live Stock.',
      },
    },
    tag: { type: String, trim: true, default: '' },
    maleTag: { type: String, trim: true, default: null },
    crossingType: { type: String, trim: true, default: 'Natural' },
    batchNumber: { type: String, trim: true, default: null },
    crossingDate: { type: Date, default: null, set: safeDateParse },
    crossingAttemptNumber: { type: Number, default: null, min: 0 },
    pdDate: { type: Date, default: null, set: safeDateParse },
    pregnancyStatus: {
      type: String,
      trim: true,
      enum: {
        values: ['Positive', 'Negative', 'Pending', '', null],
        message: 'pregnancyStatus must be Positive, Negative, or Pending',
      },
      default: null,
    },
    pregnancyConfirmedDate: { type: Date, default: null, set: safeDateParse },
    estimatedCalvingDate: { type: Date, default: null, set: safeDateParse },
    pregnantAge: { type: String, trim: true, default: null },
    actualCalvingDate: { type: Date, default: null, set: safeDateParse },
    calvingStatus: {
      type: String,
      trim: true,
      enum: {
        values: ['pending', 'normal', 'abortion', 'premature', 'calving', 'force termination', 'false pd', '', null],
        message: 'calvingStatus must be one of: pending, normal, abortion, premature, calving, force termination, false pd',
      },
      default: null,
    },
    calfTag: { type: String, trim: true, default: null },
    breedType: { type: String, trim: true, default: null },
    heatMonitoring1stNotification: { type: Date, default: null, set: safeDateParse },
    heatMonitoring2ndNotification: { type: Date, default: null, set: safeDateParse },
    remarks: { type: String, trim: true, default: '' },
    farmId: { type: Schema.Types.ObjectId, ref: 'Farm', index: true, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, strict: false }
);

CrossingLogSchema.index({ farmId: 1, tag_id: 1 });

// ─── SALE LOG ─────────────────────────────────────────────────────────────────

export interface ISaleLog extends Document {
  tag_id: string;
  buyerName?: string;
  buyerPhone?: string;
  salePrice?: number;
  remarks?: string;
  date?: Date;
  farmId?: mongoose.Types.ObjectId;
  isDeleted: boolean;
}

const SaleLogSchema = new Schema<ISaleLog>(
  {
    tag_id: {
      type: String,
      required: [true, 'tag_id is required — every sale log must reference an active livestock tag'],
      trim: true,
      uppercase: true,
      index: true,
      validate: {
        validator: validateLiveStockTag,
        message: 'Validation failed: Animal with Tag ID {VALUE} does not exist in active Live Stock.',
      },
    },
    buyerName: { type: String, trim: true, default: '' },
    buyerPhone: { type: String, trim: true, default: '' },
    salePrice: { type: Number, default: 0, min: 0 },
    remarks: { type: String, trim: true, default: '' },
    date: { type: Date, default: Date.now, set: safeDateParse },
    farmId: { type: Schema.Types.ObjectId, ref: 'Farm', index: true, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

SaleLogSchema.index({ farmId: 1, tag_id: 1 });

// ─── TREATMENT LOG ────────────────────────────────────────────────────────────

export interface ITreatmentLog extends Document {
  tag_id: string;
  tagId?: string;
  animalType?: string;
  shedId?: string;
  symptoms?: string;
  diagnosis?: string;
  treatment?: string;
  treatmentDetails?: string;
  healthStatus?: string;
  medicinesUsed?: string;
  startDate?: Date;
  endDate?: Date;
  administeredBy?: string;
  status?: string;
  cost?: number;
  remarks?: string;
  farmId?: mongoose.Types.ObjectId;
  isDeleted: boolean;
}

const TreatmentLogSchema = new Schema<ITreatmentLog>(
  {
    tag_id: {
      type: String,
      required: false,
      default: 'GENERAL',
      trim: true,
      uppercase: true,
      index: true,
      validate: {
        validator: validateLiveStockTag,
        message: 'Validation failed: Animal with Tag ID {VALUE} does not exist in active Live Stock.',
      },
    },
    tagId:         { type: String, trim: true, default: '' },
    // Animal info — populated from livestock registry by frontend before save
    animalType:    { type: String, trim: true, default: '' },
    shedId:        { type: String, trim: true, default: '' },
    // Treatment fields — frontend-facing names (match LogForm field names)
    symptoms:      { type: String, trim: true, default: '' },
    diagnosis:     { type: String, trim: true, default: '' },
    treatment:     { type: String, trim: true, default: '' }, // "Action Taken" in UI
    healthStatus:  { type: String, trim: true, default: '' }, // "Health Status" in UI
    // Legacy / extended fields kept for backward compatibility
    treatmentDetails: { type: String, trim: true, default: '' },
    medicinesUsed: { type: String, trim: true, default: '' },
    startDate:     { type: Date, default: null, set: safeDateParse },
    endDate:       { type: Date, default: null, set: safeDateParse },
    administeredBy:{ type: String, trim: true, default: '' },
    status:        { type: String, trim: true, default: '' }, // legacy alias for healthStatus
    cost:          { type: Number, default: 0, min: 0 },
    remarks:       { type: String, trim: true, default: '' },
    farmId:        { type: Schema.Types.ObjectId, ref: 'Farm', index: true, default: null },
    isDeleted:     { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

TreatmentLogSchema.index({ farmId: 1, tag_id: 1 });

TreatmentLogSchema.pre('validate', function (this: any) {
  if (this.startDate && this.endDate) {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
      this.invalidate('endDate', 'Treatment validation failed: endDate cannot be chronologically before startDate.');
    }
  }
});

// ─── Export Compiled Models ─────────────────────────────────────────────────────

export const CrossingLog: Model<ICrossingLog> =
  mongoose.models.CrossingLog || mongoose.model<ICrossingLog>('CrossingLog', CrossingLogSchema);

export const SaleLog: Model<ISaleLog> =
  mongoose.models.SaleLog || mongoose.model<ISaleLog>('SaleLog', SaleLogSchema);

export const TreatmentLog: Model<ITreatmentLog> =
  mongoose.models.TreatmentLog || mongoose.model<ITreatmentLog>('TreatmentLog', TreatmentLogSchema);

// ─── SHED LOG ─────────────────────────────────────────────────────────────────

export interface IShedLog extends Document {
  tag_id: string;
  shiftingDate?: Date;
  oldShed?: string;
  newShed?: string;
  oldLineNo?: number;
  newLineNo?: number;
  oldPosition?: number;
  newPosition?: number;
  reason?: string;
  farmId?: mongoose.Types.ObjectId;
  isDeleted: boolean;
}

const ShedLogSchema = new Schema<IShedLog>(
  {
    tag_id: {
      type: String,
      required: [true, 'tag_id is required — every shed log must reference an active livestock tag'],
      trim: true,
      uppercase: true,
      index: true,
      validate: {
        validator: validateLiveStockTag,
        message: 'Data Validation Error: Cannot log transaction. The targeted Tag ID does not exist in the Live Stock registry.',
      },
    },
    shiftingDate: { type: Date, default: Date.now, set: safeDateParse },
    oldShed: { type: String, trim: true, default: '' },
    newShed: { type: String, trim: true, default: '' },
    oldLineNo: { type: Number, default: 0 },
    newLineNo: { type: Number, default: 0 },
    oldPosition: { type: Number, default: 0 },
    newPosition: { type: Number, default: 0 },
    reason: { type: String, trim: true, default: '' },
    farmId: { type: Schema.Types.ObjectId, ref: 'Farm', index: true, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

ShedLogSchema.index({ farmId: 1, tag_id: 1 });

// ─── PURCHASE LOG ─────────────────────────────────────────────────────────────

export interface IPurchaseLog extends Document {
  tag_id: string;
  sellerName?: string;
  sellerContact?: string;
  price?: number;
  purchaseDate?: Date;
  farmId?: mongoose.Types.ObjectId;
  isDeleted: boolean;
}

const PurchaseLogSchema = new Schema<IPurchaseLog>(
  {
    tag_id: {
      type: String,
      required: [true, 'tag_id is required — every purchase log must reference an active livestock tag'],
      trim: true,
      uppercase: true,
      index: true,
    },
    sellerName: { type: String, trim: true, default: '' },
    sellerContact: { type: String, trim: true, default: '' },
    price: { type: Number, default: 0, min: 0 },
    purchaseDate: { type: Date, default: Date.now, set: safeDateParse },
    farmId: { type: Schema.Types.ObjectId, ref: 'Farm', index: true, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

PurchaseLogSchema.index({ farmId: 1, tag_id: 1 });

export const ShedLog: Model<IShedLog> =
  mongoose.models.ShedLog || mongoose.model<IShedLog>('ShedLog', ShedLogSchema);

export const PurchaseLog: Model<IPurchaseLog> =
  mongoose.models.PurchaseLog || mongoose.model<IPurchaseLog>('PurchaseLog', PurchaseLogSchema);
