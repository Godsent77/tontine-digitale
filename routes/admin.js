const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const User = require('../models/User');
const Donation = require('../models/Donation');
const Fusion = require('../models/Fusion');
const { runFusionCycle } = require('../utils/fusionEngine');

// 0. Récupérer les infos de l'admin / sous-fondateur connecté
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user || (user.role !== 'founder' && user.role !== 'sub_founder')) {
      return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// 1. Obtenir les statistiques globales
router.get('/stats', authMiddleware, adminAuth('see_stats'), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const blockedUsers = await User.countDocuments({ isActive: false });

    const totalDonations = await Donation.find({ status: 'COMPLETED' });
    const totalVolume = totalDonations.reduce((acc, d) => acc + d.amount, 0);

    const pendingDonations = await Donation.countDocuments({ status: 'PENDING' });
    const activeFusions = await Fusion.countDocuments({ status: 'MATCHED' });
    const completedFusions = await Fusion.countDocuments({ status: 'COMPLETED' });

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        blockedUsers,
        totalVolume,
        pendingDonations,
        activeFusions,
        completedFusions
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur stats.' });
  }
});

// 2. Obtenir la liste complète des membres
router.get('/members', authMiddleware, adminAuth('see_members'), async (req, res) => {
  try {
    const members = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, members });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des membres.' });
  }
});

// 3. Déclencher la fusion manuelle
router.post('/trigger-fusion', authMiddleware, adminAuth('trigger_fusion'), async (req, res) => {
  try {
    const result = await runFusionCycle();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors du déclenchement de la fusion.' });
  }
});

// 4. Accélérer la progression d'un cycle
router.post('/fusions/:fusionId/accelerate', authMiddleware, adminAuth('accelerate_progress'), async (req, res) => {
  try {
    const { percent } = req.body;
    const fusion = await Fusion.findById(req.body.fusionId || req.params.fusionId);
    if (!fusion) return res.status(404).json({ success: false, message: 'Cycle introuvable.' });

    if (percent === 100) {
      if (!req.user.permissions.includes('instant_100') && req.user.role !== 'founder') {
        return res.status(403).json({ success: false, message: 'Permission non accordée pour le 100% instantané.' });
      }
      fusion.progressPercent = 100;
    } else {
      fusion.progressPercent = Math.min(100, fusion.progressPercent + (percent || 10));
    }

    await fusion.save();
    res.json({ success: true, message: `Progression mise à jour à ${fusion.progressPercent}%`, fusion });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de l\'accélération.' });
  }
});

// 5. Mettre en pause ou reprendre un cycle
router.put('/fusions/:fusionId/toggle-pause', authMiddleware, async (req, res) => {
  try {
    const fusion = await Fusion.findById(req.params.fusionId);
    if (!fusion) return res.status(404).json({ success: false, message: 'Cycle introuvable.' });

    if (fusion.isPaused) {
      if (!req.user.permissions.includes('resume_cycle') && req.user.role !== 'founder') {
        return res.status(403).json({ success: false, message: 'Permission refusée pour reprendre le cycle.' });
      }
      fusion.isPaused = false;
    } else {
      if (!req.user.permissions.includes('pause_cycle') && req.user.role !== 'founder') {
        return res.status(403).json({ success: false, message: 'Permission refusée pour mettre en pause.' });
      }
      fusion.isPaused = true;
    }

    await fusion.save();
    res.json({ success: true, message: `Cycle ${fusion.isPaused ? 'mis en pause' : 'repris'}.`, fusion });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors du changement de statut du cycle.' });
  }
});

// 6. Bloquer / Débloquer un membre
router.put('/users/:userId/toggle-block', authMiddleware, adminAuth('toggle_block'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

    if (user.role === 'founder') {
      return res.status(403).json({ success: false, message: 'Impossible de bloquer le Fondateur.' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: `Compte de ${user.fullName} ${user.isActive ? 'débloqué' : 'bloqué'}.`,
      isActive: user.isActive
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la modification du statut.' });
  }
});

// 7. Promouvoir un membre en Sous-Fondateur et attribuer les tâches déléguées
router.post('/users/:userId/promote', authMiddleware, adminAuth('manage_subfounders'), async (req, res) => {
  try {
    const { permissions } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    if (user.role === 'founder') {
      return res.status(400).json({ success: false, message: 'Le compte fondateur principal ne peut pas être modifié.' });
    }

    user.role = 'sub_founder';
    user.permissions = Array.isArray(permissions) ? permissions : [];
    await user.save();

    res.json({
      success: true,
      message: `${user.fullName} a été promu Sous-Fondateur avec ${user.permissions.length} tâche(s) déléguée(s).`,
      user
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la promotion du membre.' });
  }
});

// 8. Rétrograder un sous-fondateur en Membre Simple
router.post('/users/:userId/demote', authMiddleware, adminAuth('manage_subfounders'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    if (user.role === 'founder') {
      return res.status(400).json({ success: false, message: 'Impossible de rétrograder le Fondateur.' });
    }

    user.role = 'user';
    user.permissions = [];
    await user.save();

    res.json({
      success: true,
      message: `${user.fullName} a été rétrogradé en Membre Simple.`,
      user
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la rétrogradation.' });
  }
});

// 9. Validation administrative de paiement pour un membre
router.post('/users/:userId/validate-donation', authMiddleware, adminAuth('validate_payment'), async (req, res) => {
  try {
    const userId = req.params.userId;

    const pendingDonation = await Donation.findOne({
      $or: [{ donorId: userId }, { receiverId: userId }],
      status: 'PENDING'
    });

    if (!pendingDonation) {
      return res.status(404).json({ success: false, message: 'Aucun don en attente de validation trouvé pour ce membre.' });
    }

    pendingDonation.status = 'COMPLETED';
    await pendingDonation.save();

    const fusion = await Fusion.findOne({ donationIds: pendingDonation._id });
    if (fusion) {
      fusion.status = 'COMPLETED';
      fusion.validatedAt = new Date();
      await fusion.save();
    }

    res.json({ success: true, message: `Paiement validé avec succès pour la transaction de ${pendingDonation.amount} FCFA !` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la validation du paiement.' });
  }
});

module.exports = router;