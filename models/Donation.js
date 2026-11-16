const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, enum: [5000, 10000, 20000, 50000] },
  paymentMethod: { type: String, required: true },
  status: { type: String, enum: ['pending', 'fused', 'completed', 'cancelled'], default: 'pending' },
  fusionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fusion', default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Donation', donationSchema);