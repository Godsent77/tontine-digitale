const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');
const Donation = require('../models/Donation');
const { getLiveUsdtRate } = require('../utils/usdtConverter');

// 1. Obtenir le statut du membre connecté (PROFIL & INFOS)
router.get('/my-status', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Votre compte a été bloqué par l\'administration.' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors du chargement du statut.' });
  }
});

// 2. Obtenir le taux USDT Binance P2P Live
router.get('/usdt-rate', async (req, res) => {
  try {
    const rate = await getLiveUsdtRate();
    res.json({ success: true, rate });
  } catch (err) {
    res.status(500).json({ success: false, rate: 650 });
  }
});

// 3. Soumettre une demande de don
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const validAmounts = [5000, 10000, 20000, 50000];

    if (!validAmounts.includes(Number(amount))) {
      return res.status(400).json({ success: false, message: 'Montant de don invalide (5000, 10000, 20000, 50000 FCFA).' });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.isActive) {
      return res.status(403).json({ success: false, message: 'Compte inactif ou introuvable.' });
    }

    // Limite journalière (Max 50 000 FCFA / jour)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayDonations = await Donation.find({
      donorId: user._id,
      createdAt: { $gte: startOfDay }
    });

    const totalToday = todayDonations.reduce((sum, d) => sum + d.amount, 0);
    if (totalToday + Number(amount) > 50000) {
      return res.status(400).json({
        success: false,
        message: `Limite journalière atteinte (Max 50 000 FCFA/jour). Vous avez déjà effectué ${totalToday.toLocaleString()} FCFA de dons aujourd'hui.`
      });
    }

    const donation = new Donation({
      donorId: user._id,
      amount: Number(amount),
      status: 'PENDING'
    });

    await donation.save();

    res.json({
      success: true,
      message: `Votre demande de don de ${Number(amount).toLocaleString()} FCFA a été enregistrée !`,
      donation
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la création du don.' });
  }
});

// 4. Mes dons actifs en attente
router.get('/my-donations', authMiddleware, async (req, res) => {
  try {
    const donations = await Donation.find({ donorId: req.user.id, status: 'PENDING' }).sort({ createdAt: -1 });
    res.json({ success: true, donations });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des dons.' });
  }
});

// 5. Historique de mes transactions validées
router.get('/my-history', authMiddleware, async (req, res) => {
  try {
    const history = await Donation.find({
      $or: [{ donorId: req.user.id }, { receiverId: req.user.id }],
      status: 'COMPLETED'
    }).sort({ updatedAt: -1 });

    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération de l\'historique.' });
  }
});

module.exports = router;