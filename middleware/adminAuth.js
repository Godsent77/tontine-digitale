const User = require('../models/User');

// La fonction principale DOIT être synchrone pour renvoyer directement le middleware à Express
module.exports = function(requiredPermission) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: 'Non autorisé, jeton manquant.' });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Utilisateur introuvable.' });
      }

      // 1. Les comptes Fondateurs principaux ont TOUS les accès
      if (user.role === 'founder') {
        req.user = user;
        return next();
      }

      // 2. Les Sous-Fondateurs vérifient si la permission spécifique leur est attribuée
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

      // 3. Les membres simples sont refusés
      return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur lors de la vérification des permissions d\'administration.' });
    }
  };
};