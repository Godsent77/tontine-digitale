const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    enum: [5000, 10000, 20000, 50000]
  },
  usdtAmount: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    default: 'Mobile Money / USDT'
  },
  status: {
    type: String,
    enum: ['pending', 'waiting', 'matched', 'confirmed', 'active', 'completed', 'cancelled'],
    default: 'pending'
  },
  expectedReturn: {
    type: Number,
    default: function () {
      return this.amount * 2;
    }
  },
  progress: {
    type: Number,
    default: 0
  },
  isPaused: {
    type: Boolean,
    default: false
  },
  // Date limite des 30 minutes chrono pour annuler la demande de don
  cancelDeadline: {
    type: Date,
    default: function () {
      return new Date(Date.now() + 30 * 60 * 1000);
    }
  },
  lastProgressUpdate: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Donation', donationSchema);