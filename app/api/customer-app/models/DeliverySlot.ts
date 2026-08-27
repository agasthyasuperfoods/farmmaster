import mongoose, { Schema } from 'mongoose';

const DeliverySlotSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    cutoffTime: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    displayOrder: { type: Number, default: 0 },
    maxOrdersPerDay: { type: Number, default: 0 }, // 0 = unlimited
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

DeliverySlotSchema.index({ enabled: 1, displayOrder: 1 });

if (mongoose.models.DeliverySlot) {
  delete mongoose.models.DeliverySlot;
}

export default mongoose.model('DeliverySlot', DeliverySlotSchema);
