const User = require('../models/User');

module.exports = async function(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user || (user.sponsorCode !== 'AUCUN' && !user.referralCode.startsWith('FONDATEUR'))) {
      return res.status(403).json({ error: 'Accès strictement réservé au Fondateur' });
    }
    req.adminUser = user;
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};