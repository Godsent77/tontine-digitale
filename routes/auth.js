const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_tontine_123';

// 1. Vérification en direct du parrain sur register.html
router.get('/check-sponsor/:code', async (req, res) => {
  try {
    const rawCode = (req.params.code || '').trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ message: 'Code parrain requis.' });
    }

    if (rawCode === 'AUCUN' || rawCode === 'FONDATEUR') {
      return res.json({ sponsorName: 'Fondateur Officiel', referralCode: rawCode });
    }

    const sponsor = await User.findOne({
      referralCode: { $regex: new RegExp('^' + rawCode + '$', 'i') }
    });

    if (!sponsor) {
      return res.status(404).json({ message: 'Code parrain introuvable.' });
    }

    res.json({
      sponsorName: sponsor.fullName,
      referralCode: sponsor.referralCode
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la vérification du parrain.' });
  }
});

// 2. Générer un code d'accès de 30 secondes pour un filleul
router.post('/generate-code', auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id || req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    // Code à 6 chiffres
    const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 30 * 1000); // 30 secondes

    user.accessCode = accessCode;
    user.accessCodeExpires = expiresAt;
    await user.save();

    res.json({
      message: "Code d'accès généré ! Valide pendant 30 secondes.",
      accessCode,
      expiresInSeconds: 30
    });
  } catch (err) {
    console.error('Erreur generate-code:', err);
    res.status(500).json({ message: "Erreur lors de la génération du code d'accès." });
  }
});

// 3. Formulaire d'inscription officiel
router.post('/register', async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      phone,
      whatsapp,
      sponsorCode,
      accessCode,
      orangeMoney,
      wave,
      mtnMoney,
      moovMoney,
      usdtBep20,
      paymentMethods
    } = req.body;

    if (!fullName || !email || !password || !sponsorCode) {
      return res.status(400).json({
        message: 'Veuillez remplir les champs obligatoires (Nom, Email, Mot de passe, Code Parrain).'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanSponsorCode = sponsorCode.trim().toUpperCase();
    const cleanAccessCode = (accessCode || '').trim();

    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Cette adresse e-mail est déjà inscrite.' });
    }

    let sponsorId = null;
    let sponsorUser = null;

    if (cleanSponsorCode !== 'AUCUN') {
      sponsorUser = await User.findOne({
        referralCode: { $regex: new RegExp('^' + cleanSponsorCode + '$', 'i') }
      });

      if (!sponsorUser) {
        return res.status(400).json({
          message: `Le code parrain "${cleanSponsorCode}" n'existe pas.`
        });
      }

      sponsorId = sponsorUser._id;

      // Vérifier le code 30s du parrain s'il en a généré un
      const isFounderSponsor = sponsorUser.role === 'founder' || sponsorUser.sponsorCode === 'AUCUN';

      if (!isFounderSponsor || (sponsorUser.accessCode && sponsorUser.accessCodeExpires)) {
        if (!cleanAccessCode) {
          return res.status(400).json({
            message: "Le code d'accès de 30 secondes fourni par votre parrain est obligatoire."
          });
        }

        const now = new Date();
        if (
          !sponsorUser.accessCode ||
          sponsorUser.accessCode !== cleanAccessCode ||
          !sponsorUser.accessCodeExpires ||
          sponsorUser.accessCodeExpires < now
        ) {
          return res.status(400).json({
            message: "Code d'accès de 30 secondes invalide ou expiré. Demandez un nouveau code à votre parrain."
          });
        }

        // Réinitialiser le code après usage
        sponsorUser.accessCode = null;
        sponsorUser.accessCodeExpires = null;
        await sponsorUser.save();
      }
    }

    // Générer un code parrain unique pour le nouveau membre
    let referralCode = '';
    let isUnique = false;
    while (!isUnique) {
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      referralCode = 'TON' + randomPart;
      const checkCode = await User.findOne({ referralCode });
      if (!checkCode) isUnique = true;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const finalPhone = (whatsapp || phone || '').trim();
    const mergedPayments = {
      orangeMoney: orangeMoney || (paymentMethods && paymentMethods.orangeMoney) || '',
      wave: wave || (paymentMethods && paymentMethods.wave) || '',
      mtnMoney: mtnMoney || (paymentMethods && paymentMethods.mtnMoney) || '',
      moovMoney: moovMoney || (paymentMethods && paymentMethods.moovMoney) || '',
      usdtBep20: usdtBep20 || (paymentMethods && paymentMethods.usdtBep20) || ''
    };

    const newUser = await User.create({
      fullName: fullName.trim(),
      email: cleanEmail,
      password: hashedPassword,
      phone: finalPhone,
      whatsapp: finalPhone,
      referralCode,
      sponsorCode: cleanSponsorCode,
      sponsorId,
      role: 'member',
      paymentMethods: mergedPayments
    });

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: '🎉 Inscription réussie !',
      token,
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        referralCode: newUser.referralCode,
        role: newUser.role
      }
    });
  } catch (err) {
    console.error('Erreur inscription backend:', err);
    res.status(500).json({
      message: "Erreur lors de l'inscription : " + (err.message || 'Erreur serveur.')
    });
  }
});

// 4. Connexion au compte
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Veuillez renseigner votre email et mot de passe.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(400).json({ message: 'Adresse email ou mot de passe incorrect.' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: 'Votre compte a été bloqué par l administration.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Adresse email ou mot de passe incorrect.' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Connexion réussie !',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        referralCode: user.referralCode,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Erreur login:', err);
    res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
  }
});

// 5. Création ou promotion d'un compte Fondateur
router.post('/create-founder', async (req, res) => {
  try {
    const { fullName, email, password, whatsapp, orangeMoney, wave, mtnMoney, moovMoney, usdtBep20 } = req.body;

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password || !fullName) {
      return res.status(400).json({ message: 'Nom, email et mot de passe requis.' });
    }

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      existing.role = 'founder';
      existing.sponsorCode = 'AUCUN';
      if (!existing.referralCode) existing.referralCode = 'FONDATEUR';
      await existing.save();

      const token = jwt.sign(
        { id: existing._id, email: existing.email, role: existing.role },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.json({
        message: 'Compte existant promu Fondateur !',
        token,
        user: existing
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const founder = await User.create({
      fullName: fullName.trim(),
      email: cleanEmail,
      password: hashedPassword,
      phone: (whatsapp || '').trim(),
      whatsapp: (whatsapp || '').trim(),
      role: 'founder',
      referralCode: 'FONDATEUR',
      sponsorCode: 'AUCUN',
      paymentMethods: {
        orangeMoney: orangeMoney || '',
        wave: wave || '',
        mtnMoney: mtnMoney || '',
        moovMoney: moovMoney || '',
        usdtBep20: usdtBep20 || ''
      }
    });

    const token = jwt.sign(
      { id: founder._id, email: founder.email, role: founder.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'Compte Fondateur créé avec succès !',
      token,
      user: founder
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur création Fondateur : ' + err.message });
  }
});

module.exports = router;