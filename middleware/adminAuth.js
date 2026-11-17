const User = require('../models/User');

module.exports = function(requiredPermission) {
  return async (req, res, next) => {
    try {
      const userId = req.user ? (req.user.id || req.user.userId || req.user._id) : null;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Non autorisé, jeton manquant.' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Utilisateur introuvable.' });
      }

      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Compte suspendu par l\'administration.' });
      }

      // 1. Fondateur Principal
      if (user.role === 'founder') {
        req.user = user;
        return next();
      }

      // 2. Sous-Fondateur
      if (user.role === 'sub_founder') {
        if (requiredPermission && (!user.permissions || !user.permissions.includes(requiredPermission))) {
          return res.status(403).json({
            success: false,
            message: `Permission non accordée : la tâche '${requiredPermission}' ne vous a pas été déléguée.`
          });
        }
        req.user = user;
        return next();
      }

      return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur middleware d\'administration.' });
    }
  };
};