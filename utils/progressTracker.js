const Fusion = require('../models/Fusion');

function startTracker() {
  console.log('Tracker de progression demarre (verification toutes les heures)');
  setInterval(updateProgress, 3600000);
  updateProgress();
}

async function updateProgress() {
  try {
    // Exclut les cycles en pause (isPaused: true)
    const activeFusions = await Fusion.find({ status: 'active', startDate: { $ne: null }, isPaused: { $ne: true } });
    const now = new Date();

    for (const f of activeFusions) {
      const elapsed = now - f.startDate;
      const hoursElapsed = elapsed / (3600 * 1000);
      const progress = Math.min(100, (hoursElapsed / 24) * 4);

      f.progress = Math.round(progress * 100) / 100;

      if (progress >= 100) {
        f.status = 'completed';
        f.progress = 100;
        f.endDate = now;
        console.log('Fusion terminee: ' + f._id);
      }

      await f.save();
    }
  } catch (err) {
    console.error('Erreur tracker:', err.message);
  }
}

module.exports = { startTracker, updateProgress };