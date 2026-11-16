require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes d'affichage des pages HTML (URL propres sans .html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Routes API
const authRoutes = require('./routes/auth');
const donationRoutes = require('./routes/donation');
const fusionRoutes = require('./routes/fusion');
const dashboardRoutes = require('./routes/dashboard');

app.use('/api/auth', authRoutes);
app.use('/api/donation', donationRoutes);
app.use('/api/fusion', fusionRoutes);
app.use('/api/dashboard', dashboardRoutes);

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connecte');
    app.listen(PORT, '0.0.0.0', () => {
      console.log('Serveur lance sur http://localhost:' + PORT);
    });
    require('./utils/progressTracker').startTracker();
  })
  .catch(err => {
    console.error('Erreur MongoDB:', err.message);
  });