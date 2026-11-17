const User = require('../models/User');

module.exports = function(requiredPermission) {
  return async (req, res, next) => {
    try {
      const userId = req.user ? (req.user.id || req.user.userId || req.user._id) : null;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Non autorisé.' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Utilisateur non trouvé.' });
      }

      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Compte bloqué.' });
      }

      // 1. Fondateur : accès total
      if (user.role === 'founder') {
        req.user = user;
        return next();
      }

      // 2. Sous-Fondateur : vérification de la permission déléguée
      if (user.role === 'sub_founder') {
        if (requiredPermission && (!user.permissions || !user.permissions.includes(requiredPermission))) {
          return res.status(403).json({ success: false, message: `Permission '${requiredPermission}' non accordée.` });
        }
        req.user = user;
        return next();
      }

      return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur autorisation admin.' });
    }
  };
};