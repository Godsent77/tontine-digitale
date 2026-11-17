const User = require('../models/User');

// La fonction externe DOIT être synchrone et retourner la fonction middleware async
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
        return res.status(403).json({ success: false, message: 'Votre compte a été bloqué par l\'administration.' });
      }

      // 1. Le Fondateur Principal a accès à TOUTES les fonctionnalités
      if (user.role === 'founder') {
        req.user = user;
        return next();
      }

      // 2. Le Sous-Fondateur accède uniquement si la tâche spécifique lui a été déléguée
      if (user.role === 'sub_founder') {
        if (requiredPermission && (!user.permissions || !user.permissions.includes(requiredPermission))) {
          return res.status(403).json({
            success: false,
            message: `Permission refusée : la tâche '${requiredPermission}' ne vous a pas été déléguée.`
          });
        }
        req.user = user;
        return next();
      }

      return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur lors de la vérification des permissions d\'administration.' });
    }
  };
};