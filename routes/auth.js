const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'default_tontine_secret_key_12345';

// Stockage temporaire des codes d'accès générés (30 secondes)
// Structure: { code: { sponsorId, expiresAt } }
global.accessCodes = global.accessCodes || {};

// Nettoyage automatique des codes expirés
setInterval(() => {
  const now = Date.now();
  for (const code in global.accessCodes) {
    if (global.accessCodes[code].expiresAt < now) {
      delete global.accessCodes[code];
    }
  }
}, 5000);

// 1. Inscription d'un Fondateur Principal
router.post('/create-founder', async (req, res) => {
  try {
    const { fullName, email, password, whatsapp, orange, wave, moov, mtn, usdtAddress, referralCode } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Cet email est déjà utilisé.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const code = referralCode || `FOUNDER_${Math.floor(1000 + Math.random() * 9000)}`;

    const founder = new User({
      fullName,
      email,
      password: hashedPassword,
      whatsapp,
      role: 'founder',
      sponsorCode: 'AUCUN',
      referralCode: code,
      paymentMethods: {
        orange: orange || '',
        wave: wave || '',
        moov: moov || '',
        mtn: mtn || '',
        usdtAddress: usdtAddress || ''
      }
    });

    await founder.save();

    res.json({
      success: true,
      message: 'Compte Fondateur créé avec succès !',
      referralCode: founder.referralCode
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la création du fondateur.' });
  }
});

// 2. Générer un code d'accès de 30 secondes pour un filleul
router.post('/generate-code', authMiddleware, async (req, res) => {
  try {
    const sponsor = await User.findById(req.user.id);
    if (!sponsor) {
      return res.status(404).json({ success: false, message: 'Parrain introuvable.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 30 * 1000; // 30 secondes

    global.accessCodes[code] = {
      sponsorCode: sponsor.referralCode,
      sponsorName: sponsor.fullName,
      expiresAt
    };

    res.json({
      success: true,
      code,
      expiresInSeconds: 30
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la génération du code.' });
  }
});

// 3. Vérifier la validité d'un lien de parrainage
router.get('/check-sponsor/:code', async (req, res) => {
  try {
    const sponsor = await User.findOne({ referralCode: req.params.code });
    if (!sponsor) {
      return res.status(404).json({ success: false, message: 'Parrain non trouvé.' });
    }
    res.json({ success: true, sponsorName: sponsor.fullName });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// 4. Inscription d'un nouveau membre
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, accessCode, sponsorCode, whatsapp, orange, wave, moov, mtn, usdtAddress } = req.body;

    // Vérification du code d'accès de 30 secondes
    const codeData = global.accessCodes[accessCode];
    if (!codeData || codeData.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, message: 'Code d\'accès invalide ou expiré (30s).' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Cet email est déjà utilisé.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newReferralCode = `MEM_${Math.floor(100000 + Math.random() * 900000)}`;

    const user = new User({
      fullName,
      email,
      password: hashedPassword,
      whatsapp,
      role: 'user',
      sponsorCode: sponsorCode || codeData.sponsorCode,
      referralCode: newReferralCode,
      paymentMethods: {
        orange: orange || '',
        wave: wave || '',
        moov: moov || '',
        mtn: mtn || '',
        usdtAddress: usdtAddress || ''
      }
    });

    await user.save();

    // Consommer le code d'accès
    delete global.accessCodes[accessCode];

    res.json({
      success: true,
      message: 'Inscription réussie ! Vous pouvez maintenant vous connecter.',
      referralCode: user.referralCode
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de l\'inscription.' });
  }
});

// 5. Connexion
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Email ou mot de passe incorrect.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Votre compte a été bloqué par l\'administration.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Email ou mot de passe incorrect.' });
    }

    // Signature explicite avec id, userId et role
    const token = jwt.sign(
      { id: user._id, userId: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        referralCode: user.referralCode
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la connexion.' });
  }
});

module.exports = router;