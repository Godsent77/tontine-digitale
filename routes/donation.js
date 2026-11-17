const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Donation = require('../models/Donation');
const Fusion = require('../models/Fusion');
const { convertFcfaToUsdt, getUsdtRateInFcfa } = require('../utils/usdtConverter');
const { runFusion } = require('../utils/fusionEngine');

const ALLOWED_AMOUNTS = [5000, 10000, 20000, 50000];
const DAILY_MAX_FCFA = 50000;

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function getUserId(req) {
  if (!req.user) return null;
  return req.user.id || req.user._id || req.user.userId;
}

// 1. Obtenir le statut du membre et ses demandes de dons
router.get('/my-status', auth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    const today = getTodayString();
    if (user.dailyDonationDate !== today) {
      user.dailyDonationTotal = 0;
      user.dailyDonationDate = today;
      await user.save();
    }

    // Vérifier si des dons ont terminé leurs 30 minutes
    await runFusion();

    const donations = await Donation.find({
      userId,
      status: { $ne: 'cancelled' }
    }).sort({ createdAt: -1 });

    res.json({
      user,
      dailyDonationTotal: user.dailyDonationTotal || 0,
      dailyRemaining: Math.max(0, DAILY_MAX_FCFA - (user.dailyDonationTotal || 0)),
      donations
    });
  } catch (err) {
    console.error('Erreur GET /my-status:', err.message);
    res.status(500).json({ message: 'Erreur lors du chargement du statut.' });
  }
});

// 2. Obtenir le taux USDT du jour
router.get('/usdt-rate', auth, async (req, res) => {
  try {
    let rate = 650;
    try {
      if (typeof getUsdtRateInFcfa === 'function') {
        const liveRate = await getUsdtRateInFcfa();
        if (liveRate && !isNaN(liveRate)) rate = liveRate;
      }
    } catch (e) {
      rate = 650;
    }
    res.json({ rate });
  } catch (err) {
    res.json({ rate: 650 });
  }
});

// 3. Créer une demande de don (avec compte à rebours de 30 minutes pour annuler)
router.post('/create', auth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const amount = Number(req.body.amount);
    const paymentMethod = req.body.paymentMethod || 'Mobile Money / USDT';

    if (!ALLOWED_AMOUNTS.includes(amount)) {
      return res.status(400).json({
        message: 'Montant non autorisé. Choisissez 5 000, 10 000, 20 000 ou 50 000 FCFA.'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: 'Votre compte est bloqué.' });
    }

    const today = getTodayString();
    if (user.dailyDonationDate !== today) {
      user.dailyDonationTotal = 0;
      user.dailyDonationDate = today;
    }

    const usedToday = user.dailyDonationTotal || 0;
    if (usedToday + amount > DAILY_MAX_FCFA) {
      const left = Math.max(0, DAILY_MAX_FCFA - usedToday);
      return res.status(400).json({
        message: `Plafond journalier de 50 000 FCFA dépassé. Il vous reste ${left.toLocaleString('fr-FR')} FCFA pour aujourd'hui.`
      });
    }

    // Calcul du montant USDT avec sécurité anti-plantage
    let usdtAmount = Number((amount / 650).toFixed(2));
    try {
      if (typeof convertFcfaToUsdt === 'function') {
        const converted = await convertFcfaToUsdt(amount);
        if (converted && !isNaN(converted)) {
          usdtAmount = Number(Number(converted).toFixed(2));
        }
      }
    } catch (e) {
      usdtAmount = Number((amount / 650).toFixed(2));
    }

    // Délai de 30 minutes chrono à partir de maintenant
    const cancelDeadline = new Date(Date.now() + 30 * 60 * 1000);

    const donation = await Donation.create({
      userId: user._id,
      amount,
      usdtAmount,
      paymentMethod,
      status: 'pending',
      expectedReturn: amount * 2,
      progress: 0,
      cancelDeadline
    });

    user.dailyDonationTotal = usedToday + amount;
    user.dailyDonationDate = today;
    await user.save();

    res.status(201).json({
      message: `✅ Demande de don de ${amount.toLocaleString('fr-FR')} FCFA enregistrée ! Vous avez 30 minutes chrono pour l'annuler si vous le souhaitez.`,
      donation
    });
  } catch (err) {
    console.error('Erreur POST /api/donation/create:', err);
    res.status(500).json({
      message: 'Erreur lors de la création du don : ' + (err.message || 'Veuillez réessayer.')
    });
  }
});

// 4. Annuler une demande de don avant la fin des 30 minutes chrono
router.post('/cancel/:id', auth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const donationId = req.params.id;

    const donation = await Donation.findOne({ _id: donationId, userId });
    if (!donation) {
      return res.status(404).json({ message: 'Demande de don introuvable.' });
    }

    if (!['pending', 'waiting'].includes(donation.status)) {
      return res.status(400).json({
        message: 'Cette demande a déjà été prise en compte et ne peut plus être annulée.'
      });
    }

    const now = new Date();
    const deadline = donation.cancelDeadline
      ? new Date(donation.cancelDeadline)
      : new Date(new Date(donation.createdAt).getTime() + 30 * 60 * 1000);

    if (now >= deadline) {
      await runFusion();
      return res.status(400).json({
        message: 'Les 30 minutes sont écoulées. Votre demande de don est définitivement prise en compte.'
      });
    }

    const refundedAmount = donation.amount;
    await Donation.findByIdAndDelete(donation._id);

    // Recréditer le plafond journalier de l'utilisateur
    const user = await User.findById(userId);
    if (user && user.dailyDonationDate === getTodayString()) {
      user.dailyDonationTotal = Math.max(0, (user.dailyDonationTotal || 0) - refundedAmount);
      await user.save();
    }

    res.json({
      message: `✅ Votre demande de don de ${refundedAmount.toLocaleString('fr-FR')} FCFA a été annulée avec succès.`
    });
  } catch (err) {
    console.error('Erreur POST /api/donation/cancel:', err.message);
    res.status(500).json({ message: "Erreur lors de l'annulation du don." });
  }
});

// 5. Liste des dons de l'utilisateur
router.get('/my-donations', auth, async (req, res) => {
  try {
    const userId = getUserId(req);
    await runFusion();

    const donations = await Donation.find({
      userId,
      status: { $ne: 'cancelled' }
    }).sort({ createdAt: -1 });

    res.json(donations);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des dons.' });
  }
});

// 6. Historique des transactions validées
router.get('/my-history', auth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const history = await Fusion.find({
      $or: [{ donorId: userId }, { receiverId: userId }],
      status: { $in: ['confirmed', 'completed', 'validated'] }
    })
      .populate('donorId', 'fullName email whatsapp phone')
      .populate('receiverId', 'fullName email whatsapp phone')
      .sort({ validatedAt: -1, createdAt: -1 });

    res.json(history);
  } catch (err) {
    res.status(500).json({ message: "Erreur lors du chargement de l'historique." });
  }
});

module.exports = router;