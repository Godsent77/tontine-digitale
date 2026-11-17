const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    default: ''
  },
  whatsapp: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['member', 'founder', 'sub_founder'],
    default: 'member'
  },
  permissions: {
    type: [String],
    default: []
  },
  referralCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  sponsorCode: {
    type: String,
    default: 'AUCUN',
    uppercase: true,
    trim: true
  },
  sponsorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  accessCode: {
    type: String,
    default: null
  },
  accessCodeExpires: {
    type: Date,
    default: null
  },
  dailyDonationTotal: {
    type: Number,
    default: 0
  },
  dailyDonationDate: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  paymentMethods: {
    orangeMoney: { type: String, default: '' },
    wave: { type: String, default: '' },
    mtnMoney: { type: String, default: '' },
    moovMoney: { type: String, default: '' },
    usdtBep20: { type: String, default: '' }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);