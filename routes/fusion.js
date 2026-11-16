const express = require('express');
const Fusion = require('../models/Fusion');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

async function getSponsorChain(userId, depth) {
  const chain = [];
  let currentId = userId;
  for (let i = 0; i < depth; i++) {
    const user = await User.findById(currentId);
    if (!user || !user.sponsorId) {
      chain.push(null);
      continue;
    }
    const sponsor = await User.findById(user.sponsorId);
    if (!sponsor) {
      chain.push(null);
      continue;
    }
    chain.push({ fullName: sponsor.fullName, phone: sponsor.phone, email: sponsor.email });
    currentId = sponsor._id;
  }
  return chain;
}

router.get('/my-fusions', auth, async (req, res) => {
  try {
    const fusions = await Fusion.find({
      $or: [{ payerId: req.userId }, { receiverId: req.userId }]
    }).sort({ createdAt: -1 });

    const result = [];
    for (const f of fusions) {
      const isPayer = String(f.payerId) === String(req.userId);
      const partnerId = isPayer ? f.receiverId : f.payerId;
      const partner = await User.findById(partnerId);

      const daysRemaining = f.startDate
        ? Math.max(0, 25 - Math.floor((Date.now() - f.startDate) / 86400000))
        : 25;

      result.push({
        _id: f._id,
        role: isPayer ? 'payer' : 'receiver',
        amount: f.amount,
        status: f.status,
        progress: f.progress,
        daysRemaining,
        paymentConfirmed: f.paymentConfirmed,
        receiptConfirmed: f.receiptConfirmed,
        partnerName: partner ? partner.fullName : 'Inconnu',
        partner
      });
    }

    res.json({ fusions: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/sponsor-contacts', auth, async (req, res) => {
  try {
    const fusion = await Fusion.findById(req.params.id);
    if (!fusion) return res.status(404).json({ error: 'Fusion introuvable' });

    const isPayer = String(fusion.payerId) === String(req.userId);
    const partnerId = isPayer ? fusion.receiverId : fusion.payerId;
    const chain = await getSponsorChain(partnerId, 3);

    res.json({ s1: chain[0], s2: chain[1], s3: chain[2] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/confirm-payment', auth, async (req, res) => {
  try {
    const fusion = await Fusion.findById(req.params.id);
    if (!fusion) return res.status(404).json({ error: 'Fusion introuvable' });
    if (String(fusion.payerId) !== String(req.userId)) return res.status(403).json({ error: 'Non autorise' });

    fusion.paymentConfirmed = true;
    fusion.paymentType = req.body.type || 'direct';
    if (req.body.sponsor) fusion.paymentViaSponsor = req.body.sponsor;
    await fusion.save();

    res.json({ message: 'Paiement confirme' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/confirm-receipt', auth, async (req, res) => {
  try {
    const fusion = await Fusion.findById(req.params.id);
    if (!fusion) return res.status(404).json({ error: 'Fusion introuvable' });
    if (String(fusion.receiverId) !== String(req.userId)) return res.status(403).json({ error: 'Non autorise' });

    fusion.receiptConfirmed = true;
    fusion.status = 'active';
    fusion.startDate = new Date();
    fusion.progress = 0;
    await fusion.save();

    res.json({ message: 'Reception confirmee, cycle demarre' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/confirm-forward', auth, async (req, res) => {
  try {
    const fusion = await Fusion.findById(req.params.id);
    if (!fusion) return res.status(404).json({ error: 'Fusion introuvable' });
    if (String(fusion.receiverId) !== String(req.userId)) return res.status(403).json({ error: 'Non autorise' });

    fusion.forwardConfirmed = true;
    await fusion.save();

    res.json({ message: 'Transfert confirme' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;