const Fusion = require('../models/Fusion');
const Donation = require('../models/Donation');
const { runFusion } = require('./fusionEngine');

async function checkProgressAndFusions() {
  try {
    const now = new Date();

    // 1. Avancer de +4% par 24h les cycles validés qui ne sont pas en pause
    const activeFusions = await Fusion.find({
      status: { $in: ['confirmed', 'completed', 'validated'] },
      progressPercent: { $lt: 100 },
      isPaused: { $ne: true }
    });

    for (const fusion of activeFusions) {
      const refDate = fusion.lastProgressAt || fusion.validatedAt || fusion.createdAt;
      const hoursElapsed = (now - new Date(refDate)) / (1000 * 60 * 60);

      if (hoursElapsed >= 24) {
        const daysPassed = Math.floor(hoursElapsed / 24);
        const addPercent = daysPassed * 4;
        fusion.progressPercent = Math.min(100, (fusion.progressPercent || 0) + addPercent);
        fusion.lastProgressAt = now;
        await fusion.save();

        if (fusion.donationId) {
          await Donation.findByIdAndUpdate(fusion.donationId, {
            $set: { progress: fusion.progressPercent }
          });
        }
      }
    }

    // 2. Déclencher la prise en compte automatique des dons ayant dépassé les 30 minutes
    await runFusion();
  } catch (err) {
    console.error('Erreur dans progressTracker:', err.message);
  }
}

function startProgressTracker() {
  console.log('⏱️ Tracker de progression (+4%/24h) et validation des 30 min actif.');
  checkProgressAndFusions();
  setInterval(checkProgressAndFusions, 30 * 1000);
}

module.exports = { startProgressTracker };