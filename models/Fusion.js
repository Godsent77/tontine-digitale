const mongoose = require('mongoose');

const fusionSchema = new mongoose.Schema({
  payerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  payerDonationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation' },
  receiverDonationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation' },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'active', 'completed', 'disputed', 'cancelled'], default: 'pending' },
  paymentConfirmed: { type: Boolean, default: false },
  receiptConfirmed: { type: Boolean, default: false },
  paymentType: { type: String, default: 'direct' },
  paymentViaSponsor: { type: String, default: '' },
  forwardConfirmed: { type: Boolean, default: false },
  isPaused: { type: Boolean, default: false }, // Indique si le cycle est en pause
  startDate: { type: Date, default: null },
  validatedAt: { type: Date, default: null },
  endDate: { type: Date, default: null },
  progress: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Fusion', fusionSchema);