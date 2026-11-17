const User = require('../models/User');
const Donation = require('../models/Donation');
const Fusion = require('../models/Fusion');

async function runFusion() {
  try {
    const now = new Date();

    // Ne sélectionne que les demandes de dons dont le compte à rebours de 30 minutes est écoulé
    const pendingDonations = await Donation.find({
      status: { $in: ['pending', 'waiting'] },
      $or: [
        { cancelDeadline: { $lte: now } },
        { cancelDeadline: { $exists: false } },
        { cancelDeadline: null }
      ]
    }).sort({ createdAt: 1 });

    if (!pendingDonations.length) {
      return { createdFusions: 0 };
    }

    let createdFusions = 0;

    // 1. Récupérer tous les Fondateurs actifs (qui reçoivent leurs 2 premiers dons sans donner avant)
    const founders = await User.find({
      isActive: { $ne: false },
      $or: [{ sponsorCode: 'AUCUN' }, { role: 'founder' }]
    }).sort({ createdAt: 1 });

    for (const donation of pendingDonations) {
      const freshDonation = await Donation.findById(donation._id);
      if (!freshDonation || !['pending', 'waiting'].includes(freshDonation.status)) {
        continue;
      }

      let matched = false;

      // ÉTAPE 1 : Attribuer les 2 premiers dons à chaque Fondateur
      for (const founder of founders) {
        if (String(founder._id) === String(freshDonation.userId)) continue;

        const founderReceivedCount = await Fusion.countDocuments({
          receiverId: founder._id
        });

        if (founderReceivedCount < 2) {
          await Fusion.create({
            donationId: freshDonation._id,
            donorId: freshDonation.userId,
            receiverId: founder._id,
            amount: freshDonation.amount,
            usdtAmount: freshDonation.usdtAmount || Number((freshDonation.amount / 650).toFixed(2)),
            status: 'pending',
            progressPercent: 0,
            isPaused: false
          });

          freshDonation.status = 'matched';
          await freshDonation.save();
          createdFusions++;
          matched = true;
          break;
        }
      }

      if (matched) continue;

      // ÉTAPE 2 : Chercher un membre dont la fusion/cycle est arrivé à 100% (mature) pour recevoir x2 (2 dons)
      const maturedFusions = await Fusion.find({
        status: { $in: ['confirmed', 'completed', 'validated'] },
        progressPercent: { $gte: 100 },
        amount: freshDonation.amount,
        donorId: { $ne: freshDonation.userId }
      }).sort({ validatedAt: 1, createdAt: 1 });

      for (const matured of maturedFusions) {
        const alreadyAssignedCount = await Fusion.countDocuments({
          receiverId: matured.donorId,
          amount: freshDonation.amount,
          createdAt: { $gte: matured.createdAt }
        });

        if (alreadyAssignedCount < 2) {
          await Fusion.create({
            donationId: freshDonation._id,
            donorId: freshDonation.userId,
            receiverId: matured.donorId,
            amount: freshDonation.amount,
            usdtAmount: freshDonation.usdtAmount || Number((freshDonation.amount / 650).toFixed(2)),
            status: 'pending',
            progressPercent: 0,
            isPaused: false
          });

          freshDonation.status = 'matched';
          await freshDonation.save();
          createdFusions++;
          matched = true;
          break;
        }
      }
    }

    return { createdFusions };
  } catch (err) {
    console.error('Erreur dans runFusion:', err.message);
    return { createdFusions: 0, error: err.message };
  }
}

module.exports = { runFusion };