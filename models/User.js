const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, default: '' },
  referralCode: { type: String, unique: true },
  sponsorCode: { type: String, default: '' },
  sponsorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  paymentMethods: {
    orange_money: { type: String, default: '' },
    wave: { type: String, default: '' },
    moov_money: { type: String, default: '' },
    mtn_money: { type: String, default: '' },
    usdt_bep20: { type: String, default: '' }
  },
  dailyDonationTotal: { type: Number, default: 0 },
  dailyDonationDate: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', function(next) {
  if (!this.referralCode) {
    this.referralCode = 'REF' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('User', userSchema);