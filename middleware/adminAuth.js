const User = require('../models/User');

module.exports = async function(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(403).json({ error: 'Utilisateur introuvable' });

    if (!user.isActive) {
      return res.status(403).json({ error: 'Votre compte a été bloqué par l\'administration.' });
    }

    const isFounder = user.role === 'founder' || user.sponsorCode === 'AUCUN' || (user.referralCode && user.referralCode.startsWith('FONDATEUR'));
    const isSubFounder = user.role === 'sub_founder';

    if (!isFounder && !isSubFounder) {
      return res.status(403).json({ error: 'Accès réservé aux Fondateurs et Sous-Fondateurs' });
    }

    req.adminUser = user;
    req.isMainFounder = isFounder;
    req.userPermissions = user.permissions || [];

    // Helper pour vérifier si l'utilisateur a la permission requise
    req.hasPermission = function(perm) {
      if (req.isMainFounder) return true; // Le Fondateur Principal a TOUS les pouvoirs
      return req.userPermissions.includes(perm);
    };

    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};