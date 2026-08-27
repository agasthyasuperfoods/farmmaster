import mongoose, { Schema } from 'mongoose';

const OrderItemSchema = new Schema({
  product: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
});

const OrderSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    orderNumber: { type: String, required: true, unique: true },
    status: { type: String, default: 'pending' },
    totalPrice: { type: Number, default: 0 },
    items: [OrderItemSchema],
    address: { type: Object },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'DeliveryExecutive', default: null },
    deliveryDate: { type: String, default: null },
    deliverySlot: { type: String, default: null },
  },
  { timestamps: true }
);

if (mongoose.models.Order) {
  delete mongoose.models.Order;
}

export default mongoose.model('Order', OrderSchema);
