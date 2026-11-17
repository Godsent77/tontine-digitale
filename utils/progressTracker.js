const Fusion = require('../models/Fusion');

// Tracker de progression (+4% par 24h)
function startProgressTracker() {
  console.log(' Tracker de progression automatique (+4%/24h) démarré.');

  // Mettre à jour la progression toutes les 10 minutes
  setInterval(async () => {
    try {
      // Ne mettre à jour que les fusions actives (MATCHED) et non mises en pause
      const activeFusions = await Fusion.find({ status: 'MATCHED', isPaused: false });
      const now = Date.now();

      for (const fusion of activeFusions) {
        const lastUpdate = fusion.updatedAt ? new Date(fusion.updatedAt).getTime() : new Date(fusion.createdAt).getTime();
        const hoursElapsed = (now - lastUpdate) / (1000 * 60 * 60);

        // Progression de 4% par 24h (~0.166% par heure)
        if (hoursElapsed >= 0.25) { // Mise à jour toutes les 15 minutes minimum
          const addedProgress = (4 / 24) * hoursElapsed;
          fusion.progressPercent = Math.min(100, Math.round((fusion.progressPercent + addedProgress) * 100) / 100);
          await fusion.save();
        }
      }
    } catch (err) {
      console.error("Erreur dans le tracker de progression:", err);
    }
  }, 10 * 60 * 1000); // Exécution toutes les 10 minutes
}

module.exports = { startProgressTracker };