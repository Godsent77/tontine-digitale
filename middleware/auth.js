const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  const header = req.header('Authorization');
  if (!header) return res.status(401).json({ error: 'Token manquant' });

  const token = header.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token invalide' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token expire ou invalide' });
  }
};