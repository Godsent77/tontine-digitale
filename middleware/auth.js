const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Jeton d\'authentification manquant.' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Format de jeton invalide.' });
    }

    const secret = process.env.JWT_SECRET || 'default_tontine_secret_key_12345';
    const decoded = jwt.verify(token, secret);

    const userId = decoded.id || decoded.userId || decoded._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Jeton invalide (identifiant introuvable).' });
    }

    // Normalisation de l'utilisateur dans la requête pour qu'il soit reconnu partout
    req.user = {
      id: userId,
      userId: userId,
      _id: userId,
      role: decoded.role
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expirée ou jeton invalide.' });
  }
};