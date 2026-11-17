const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Fusion = require('../models/Fusion');
const Donation = require('../models/Donation');

// Obtenir mes fusions actives (où je suis donneur ou receveur)
router.get('/my-fusions', authMiddleware, async (req, res) => {
  try {
    const fusions = await Fusion.find({
      $or: [{ donorId: req.user.id }, { receiverId: req.user.id }],
      status: 'MATCHED'
    })
    .populate('donorId', 'fullName whatsapp email paymentMethods')
    .populate('receiverId', 'fullName whatsapp email paymentMethods')
    .sort({ createdAt: -1 });

    res.json({ success: true, fusions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur récupération des fusions.' });
  }
});

// Confirmer la réception d'un paiement (Receveur)
router.post('/confirm-receipt', authMiddleware, async (req, res) => {
  try {
    const { fusionId } = req.body;
    const fusion = await Fusion.findById(fusionId);

    if (!fusion) {
      return res.status(404).json({ success: false, message: 'Fusion introuvable.' });
    }

    if (fusion.receiverId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'Vous n\'êtes pas le receveur de cette fusion.' });
    }

    fusion.status = 'COMPLETED';
    fusion.validatedAt = new Date();
    await fusion.save();

    await Donation.updateMany(
      { _id: { $in: fusion.donationIds } },
      { $set: { status: 'COMPLETED' } }
    );

    res.json({ success: true, message: 'Paiement confirmé et fusion terminée avec succès !' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la confirmation du paiement.' });
  }
});

module.exports = router;