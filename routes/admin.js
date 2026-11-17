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
    if (!req.hasPermission('see_stats')) {
      return res.status(403).json({ error: 'Permission refusée : Voir les statistiques' });
    }

    const totalUsers = await User.countDocuments();
    const totalDonations = await Donation.countDocuments();
    const pendingDonations = await Donation.countDocuments({ status: 'pending' });
    const activeFusions = await Fusion.countDocuments({ status: 'active', receiptConfirmed: true });
    const pendingFusions = await Fusion.countDocuments({ receiptConfirmed: false });
    const completedFusions = await Fusion.countDocuments({ status: 'completed' });

    const donationsList = await Donation.find();
    const totalVolume = donationsList.reduce((acc, d) => acc + d.amount, 0);

    res.json({
      totalUsers,
      totalDonations,
      pendingDonations,
      activeFusions,
      pendingFusions,
      completedFusions,
      totalVolume,
      isMainFounder: req.isMainFounder,
      permissions: req.userPermissions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ⚡ 2. Lancer la fusion automatique manuellement
router.post('/trigger-fusion', async (req, res) => {
  try {
    if (!req.hasPermission('trigger_fusion')) {
      return res.status(403).json({ error: 'Permission refusée : Lancer la fusion manuelle' });
    }
    await runFusion();
    res.json({ message: 'Fusion automatique exécutée avec succès !' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🚀 3. Accélérer la progression (% de gain)
router.post('/accelerate-progress', async (req, res) => {
  try {
    const { boostPercent } = req.body;
    const boost = parseFloat(boostPercent) || 10;

    if (boost >= 100) {
      if (!req.hasPermission('instant_100')) {
        return res.status(403).json({ error: 'Permission refusée : Valider à 100% instantanément' });
      }
    } else {
      if (!req.hasPermission('accelerate_progress')) {
        return res.status(403).json({ error: 'Permission refusée : Accélérer les gains' });
      }
    }

    const activeFusions = await Fusion.find({ status: 'active', receiptConfirmed: true });
    for (const f of activeFusions) {
      f.progress = Math.min(100, (f.progress || 0) + boost);
      if (f.progress >= 100) {
        f.status = 'completed';
        f.endDate = new Date();
      }
      await f.save();
    }

    res.json({ message: `Progression accélérée de +${boost}% pour les cycles actifs !` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ⏸️ 4. Pause ou Redémarrage d'un cycle de progression
router.post('/toggle-cycle-pause', async (req, res) => {
  try {
    const { fusionId, action } = req.body; // action: 'pause' ou 'resume'

    if (action === 'pause' && !req.hasPermission('pause_cycle')) {
      return res.status(403).json({ error: 'Permission refusée : Pause de progression' });
    }
    if (action === 'resume' && !req.hasPermission('resume_cycle')) {
      return res.status(403).json({ error: 'Permission refusée : Redémarrer la progression' });
    }

    const fusion = await Fusion.findById(fusionId);
    if (!fusion) return res.status(404).json({ error: 'Fusion introuvable' });

    fusion.isPaused = (action === 'pause');
    await fusion.save();

    res.json({ message: `Cycle ${action === 'pause' ? 'mis en pause' : 'redémarré'} avec succès !` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ 5. Valider un paiement à la place du receveur
router.post('/validate-payment-admin', async (req, res) => {
  try {
    if (!req.hasPermission('validate_payment')) {
      return res.status(403).json({ error: 'Permission refusée : Valider le paiement' });
    }

    const { fusionId } = req.body;
    const fusion = await Fusion.findById(fusionId);
    if (!fusion) return res.status(404).json({ error: 'Fusion introuvable' });

    fusion.receiptConfirmed = true;
    fusion.paymentConfirmed = true;
    fusion.status = 'active';
    fusion.startDate = new Date();
    fusion.validatedAt = new Date();
    fusion.progress = 0;
    await fusion.save();

    res.json({ message: 'Transaction validée par l\'administration !' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🚫 6. Bloquer / Débloquer un membre
router.post('/toggle-block-user', async (req, res) => {
  try {
    if (!req.hasPermission('toggle_block')) {
      return res.status(403).json({ error: 'Permission refusée : Bloquer/Débloquer des comptes' });
    }

    const { targetUserId } = req.body;
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ error: 'Membre introuvable' });

    targetUser.isActive = !targetUser.isActive;
    await targetUser.save();

    res.json({ message: `Compte de ${targetUser.fullName} ${targetUser.isActive ? 'débloqué' : 'bloqué'} avec succès.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🛡️ 7. Enregistrer les Permissions d'un Sous-Fondateur (Fondateur Principal Uniquement)
router.post('/save-subfounder-permissions', async (req, res) => {
  try {
    if (!req.hasPermission('manage_subfounders')) {
      return res.status(403).json({ error: 'Seul le Fondateur Principal peut gérer les permissions des Sous-Fondateurs.' });
    }

    const { targetUserId, permissions, role } = req.body;
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) return res.status(404).json({ error: 'Membre introuvable' });

    targetUser.role = role || 'sub_founder';
    targetUser.permissions = Array.isArray(permissions) ? permissions : [];
    await targetUser.save();

    res.json({ message: `Permissions de ${targetUser.fullName} mises à jour avec succès !` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 👥 8. Liste complète de tous les membres et fusions
router.get('/users', async (req, res) => {
  try {
    if (!req.hasPermission('see_members')) {
      return res.status(403).json({ error: 'Permission refusée : Voir la liste des membres' });
    }

    const users = await User.find().select('-password').sort({ createdAt: -1 });
    const fusions = await Fusion.find().populate('payerId receiverId', 'fullName email phone whatsapp').sort({ createdAt: -1 }).limit(20);

    res.json({ users, fusions, isMainFounder: req.isMainFounder, myPermissions: req.userPermissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;