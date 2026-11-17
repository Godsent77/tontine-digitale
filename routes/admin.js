const express = require('express');
const User = require('../models/User');
const Donation = require('../models/Donation');
const Fusion = require('../models/Fusion');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { runFusion } = require('../utils/fusionEngine');
const router = express.Router();

router.use(auth, adminAuth);

// 📊 1. Statistiques globales
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalDonations = await Donation.countDocuments();
    const pendingDonations = await Donation.countDocuments({ status: 'pending' });
    const activeFusions = await Fusion.countDocuments({ status: 'active', receiptConfirmed: true });
    const pendingFusions = await Fusion.countDocuments({ receiptConfirmed: false });
    const completedFusions = await Fusion.countDocuments({ status: 'completed' });

    // Calcul du volume total
    const donationsList = await Donation.find();
    const totalVolume = donationsList.reduce((acc, d) => acc + d.amount, 0);

    res.json({
      totalUsers,
      totalDonations,
      pendingDonations,
      activeFusions,
      pendingFusions,
      completedFusions,
      totalVolume
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ⚡ 2. Lancer la fusion automatique manuellement
router.post('/trigger-fusion', async (req, res) => {
  try {
    await runFusion();
    res.json({ message: 'Engine de fusion exécuté avec succès !' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🚀 3. Accélérer la progression (% de gain)
router.post('/accelerate-progress', async (req, res) => {
  try {
    const { boostPercent, fusionId } = req.body;
    const boost = parseFloat(boostPercent) || 10;

    if (fusionId) {
      // Booster une fusion spécifique
      const f = await Fusion.findById(fusionId);
      if (f && f.status === 'active') {
        f.progress = Math.min(100, (f.progress || 0) + boost);
        if (f.progress >= 100) {
          f.status = 'completed';
          f.endDate = new Date();
        }
        await f.save();
      }
    } else {
      // Booster TOUTES les fusions actives
      const activeFusions = await Fusion.find({ status: 'active', receiptConfirmed: true });
      for (const f of activeFusions) {
        f.progress = Math.min(100, (f.progress || 0) + boost);
        if (f.progress >= 100) {
          f.status = 'completed';
          f.endDate = new Date();
        }
        await f.save();
      }
    }

    res.json({ message: `Progression accélérée de +${boost}% pour les cycles actifs !` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 👥 4. Liste complète de tous les membres
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;