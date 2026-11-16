const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

const accessCodes = {};

router.post('/create-founder', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) return res.status(400).json({ error: 'Tous les champs sont requis' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email deja utilise' });

    const founderCount = await User.countDocuments({ sponsorCode: 'AUCUN' });
    const refCode = 'FONDATEUR' + (founderCount + 1);

    const hash = await bcrypt.hash(password, 10);
    const user = new User({
      fullName,
      email,
      password: hash,
      referralCode: refCode,
      sponsorCode: 'AUCUN'
    });

    await user.save();
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, fullName: user.fullName, email: user.email, referralCode: refCode } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate-code', auth, async (req, res) => {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    accessCodes[code] = { sponsorId: req.userId, expires: Date.now() + 30000 };
    res.json({ code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, accessCode, referralCode } = req.body;
    if (!fullName || !email || !password || !accessCode) return res.status(400).json({ error: 'Tous les champs sont requis' });

    const codeData = accessCodes[accessCode];
    if (!codeData || Date.now() > codeData.expires) return res.status(400).json({ error: 'Code d\'acces invalide ou expire' });

    const sponsor = await User.findById(codeData.sponsorId);
    if (!sponsor) return res.status(400).json({ error: 'Parrain introuvable' });

    delete accessCodes[accessCode];

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email deja utilise' });

    const hash = await bcrypt.hash(password, 10);
    const user = new User({
      fullName,
      email,
      password: hash,
      sponsorCode: sponsor.referralCode,
      sponsorId: sponsor._id
    });

    await user.save();
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, fullName: user.fullName, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Email ou mot de passe incorrect' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Email ou mot de passe incorrect' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, fullName: user.fullName, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;