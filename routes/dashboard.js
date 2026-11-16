const express = require('express');
const User = require('../models/User');
const Fusion = require('../models/Fusion');
const Donation = require('../models/Donation');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const today = new Date().toISOString().split('T')[0];
    if (user.dailyDonationDate !== today) {
      user.dailyDonationTotal = 0;
      user.dailyDonationDate = today;
      await user.save();
    }

    const fusions = await Fusion.find({
      $or: [{ payerId: req.userId }, { receiverId: req.userId }]
    }).sort({ createdAt: -1 }).limit(10);

    res.json({
      user,
      fusions,
      dailyLimit: {
        used: user.dailyDonationTotal,
        max: 50000,
        remaining: 50000 - user.dailyDonationTotal
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/referrals', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const referrals = await User.find({
      $or: [
        { sponsorId: req.userId },
        { sponsorCode: user.referralCode }
      ]
    }).select('fullName email phone whatsapp paymentMethods createdAt').sort({ createdAt: -1 });

    res.json({ referrals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/profile', auth, async (req, res) => {
  try {
    const { fullName, phone, whatsapp, paymentMethods } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    if (fullName) user.fullName = fullName;
    if (phone !== undefined) user.phone = phone;
    if (whatsapp !== undefined) user.whatsapp = whatsapp;
    if (paymentMethods) {
      user.paymentMethods = { ...user.paymentMethods, ...paymentMethods };
    }

    await user.save();
    res.json({ message: 'Profil mis a jour' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;