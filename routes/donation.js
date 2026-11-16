const express = require('express');
const Donation = require('../models/Donation');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { convertToUsdt } = require('../utils/usdtConverter');
const { runFusion } = require('../utils/fusionEngine');
const router = express.Router();

const VALID_AMOUNTS = [5000, 10000, 20000, 50000];
const DAILY_MAX = 50000;

router.post('/', auth, async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;
    if (!VALID_AMOUNTS.includes(amount)) return res.status(400).json({ error: 'Montant invalide (5000, 10000, 20000 ou 50000)' });

    const user = await User.findById(req.userId);
    const today = new Date().toISOString().split('T')[0];

    if (user.dailyDonationDate !== today) {
      user.dailyDonationTotal = 0;
      user.dailyDonationDate = today;
    }

    if (user.dailyDonationTotal + amount > DAILY_MAX) {
      return res.status(400).json({ error: 'Limite quotidienne de ' + DAILY_MAX + ' F atteinte. Reste: ' + (DAILY_MAX - user.dailyDonationTotal) + ' F' });
    }

    const donation = new Donation({
      userId: req.userId,
      amount,
      paymentMethod
    });

    await donation.save();

    user.dailyDonationTotal += amount;
    await user.save();

    await runFusion();

    res.json({ message: 'Donation creee', donation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/usdt-rate', auth, async (req, res) => {
  try {
    const amount = parseFloat(req.query.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Montant invalide' });
    const result = await convertToUsdt(amount);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my-donations', auth, async (req, res) => {
  try {
    const donations = await Donation.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ donations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;