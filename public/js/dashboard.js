const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/login.html';
}

let currentUser = null;

// Initialiser le tableau de bord
async function initDashboard() {
  try {
    const res = await fetch('/api/donation/my-status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!data.success) {
      localStorage.removeItem('token');
      window.location.href = '/login.html';
      return;
    }

    currentUser = data.user;
    document.getElementById('userNameDisplay').innerText = currentUser.fullName;
    document.getElementById('userCodeDisplay').innerText = currentUser.referralCode;

    // Affichage conditionnel du bouton Admin / Backoffice
    const btnAdmin = document.getElementById('btnAdminNav');
    if (btnAdmin) {
      if (currentUser.role === 'founder' || currentUser.role === 'sub_founder') {
        btnAdmin.style.display = 'inline-block';
        btnAdmin.innerText = currentUser.role === 'founder' ? '👑 Backoffice' : '⭐ Panel Sous-Fondateur';
      } else {
        btnAdmin.style.display = 'none';
      }
    }

    // Charger les informations USDT live
    fetchUsdtRate();

    // Afficher la section dons par défaut
    showTab('donations');
    loadMyDonations();
  } catch (err) {
    console.error("Erreur d'initialisation du dashboard:", err);
  }
}

// Récupérer le taux USDT live Binance
async function fetchUsdtRate() {
  try {
    const res = await fetch('/api/donation/usdt-rate');
    const data = await res.json();
    if (data.success && data.rate) {
      document.getElementById('usdtRateDisplay').innerText = `1 USDT = ${data.rate} FCFA (Binance P2P)`;
    }
  } catch (err) {
    console.error("Erreur récupération taux USDT", err);
  }
}

// Navigation par Onglets
function showTab(tabName) {
  const tabs = ['donations', 'fusions', 'progress', 'history', 'referrals', 'profile'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = (t === tabName) ? 'block' : 'none';
  });

  if (tabName === 'fusions') loadActiveFusions();
  if (tabName === 'progress') loadProgression();
  if (tabName === 'history') loadHistory();
  if (tabName === 'referrals') loadReferrals();
  if (tabName === 'profile') loadProfile();
}

// Générer un code d'accès de 30 secondes pour un filleul
async function generateAccessCode() {
  try {
    const res = await fetch('/api/auth/generate-code', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('generatedCodeDisplay').innerText = data.code;
      let timeLeft = 30;
      const timerEl = document.getElementById('codeTimer');
      timerEl.innerText = `Valide pendant ${timeLeft}s`;

      const interval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
          clearInterval(interval);
          timerEl.innerText = "Code expiré. Régénérez-en un nouveau.";
          document.getElementById('generatedCodeDisplay').innerText = "------";
        } else {
          timerEl.innerText = `Valide pendant ${timeLeft}s`;
        }
      }, 1000);
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert("Erreur lors de la génération du code.");
  }
}

// Faire un don
async function submitDonation(amount) {
  if (!confirm(`Confirmez-vous la demande de don de ${amount.toLocaleString()} FCFA ?`)) return;

  try {
    const res = await fetch('/api/donation/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ amount })
    });
    const data = await res.json();
    alert(data.message);
    loadMyDonations();
  } catch (err) {
    alert("Erreur lors de la création du don.");
  }
}

// Charger mes dons actifs
async function loadMyDonations() {
  try {
    const res = await fetch('/api/donation/my-donations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('myDonationsList');
    container.innerHTML = '';

    if (!data.donations || data.donations.length === 0) {
      container.innerHTML = '<p>Aucun don actif pour le moment.</p>';
      return;
    }

    data.donations.forEach(d => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>Montant : ${d.amount.toLocaleString()} FCFA</h3>
        <p>Statut : <strong>${d.status}</strong></p>

        <p>Date : ${new Date(d.createdAt).toLocaleString('fr-FR')}</p>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Erreur chargement dons", err);
  }
}

// Charger les fusions actives
async function loadActiveFusions() {
  try {
    const res = await fetch('/api/fusion/my-fusions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('activeFusionsList');
    container.innerHTML = '';

    if (!data.fusions || data.fusions.length === 0) {
      container.innerHTML = '<p>Aucune fusion active pour le moment.</p>';
      return;
    }

    data.fusions.forEach(f => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>Fusion #${f._id.substr(-6)}</h3>
        <p>Progression : <strong>${f.progressPercent}%</strong></p>
        <p>Montant Attendu : <strong>${(f.expectedAmount || 0).toLocaleString()} FCFA</strong></p>
        ${f.isPaused ? '<p style="color:red; font-weight:bold;">⏸️ Cycle actuellement en pause</p>' : ''}
        ${f.donorId && f.donorId._id === currentUser._id ? `
          <div style="background:#eef; padding:10px; border-radius:5px; margin-top:10px;">
            <h4>Coordonnées du Receveur :</h4>
            <p>Nom : <strong>${f.receiverId.fullName}</strong></p>
            <p>WhatsApp : <strong>${f.receiverId.whatsapp || 'N/A'}</strong></p>
            <p>Orange Money : ${f.receiverId.paymentMethods?.orange || 'N/A'}</p>
            <p>Wave : ${f.receiverId.paymentMethods?.wave || 'N/A'}</p>
            <p>Moov : ${f.receiverId.paymentMethods?.moov || 'N/A'}</p>
            <p>MTN : ${f.receiverId.paymentMethods?.mtn || 'N/A'}</p>
            <p>USDT (BEP20) : ${f.receiverId.paymentMethods?.usdtAddress || 'N/A'}</p>
          </div>
        ` : ''}
        ${f.receiverId && f.receiverId._id === currentUser._id ? `
          <button onclick="confirmReceipt('${f._id}')" class="btn btn-success" style="margin-top:10px;">✅ Confirmer Réception du Paiement</button>
        ` : ''}
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Erreur chargement fusions", err);
  }
}

// Confirmer la réception d'un paiement
async function confirmReceipt(fusionId) {
  if (!confirm("Confirmez-vous avoir reçu les fonds sur votre compte ?")) return;

  try {
    const res = await fetch('/api/fusion/confirm-receipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ fusionId })
    });
    const data = await res.json();
    alert(data.message);
    loadActiveFusions();
  } catch (err) {
    alert("Erreur lors de la confirmation.");
  }
}

// Charger la progression des cycles (+4%/24h)
async function loadProgression() {
  try {
    const res = await fetch('/api/fusion/my-fusions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('progressionList');
    container.innerHTML = '';

    if (!data.fusions || data.fusions.length === 0) {
      container.innerHTML = '<p>Aucun cycle en progression.</p>';
      return;
    }

    data.fusions.forEach(f => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>Cycle de Progression - ${f.progressPercent}%</h3>
        <div style="background:#ddd; border-radius:10px; height:20px; width:100%; overflow:hidden;">
          <div style="background:#27ae60; height:100%; width:${f.progressPercent}%;"></div>
        </div>
        <p style="margin-top:8px;">Gain Prévu (x2) : <strong>${(f.expectedAmount || 0).toLocaleString()} FCFA</strong> dans 25 jours</p>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Erreur chargement progression", err);
  }
}

// Charger l'historique des transactions validées
async function loadHistory() {
  try {
    const res = await fetch('/api/donation/my-history', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('historyList');
    container.innerHTML = '';

    if (!data.history || data.history.length === 0) {
      container.innerHTML = '<p>Aucune transaction terminée dans l\'historique.</p>';
      return;
    }

    data.history.forEach(h => {
      const card = document.createElement('div');
      card.className = 'card';
      const validationDate = h.validatedAt ? new Date(h.validatedAt).toLocaleString('fr-FR') : 'Date non disponible';
      card.innerHTML = `
        <h3>📜 Don/Paiement de ${h.amount.toLocaleString()} FCFA</h3>
        <p>Statut : <span style="color:green; font-weight:bold;">TERMINÉ / VALIDÉ</span></p>
        <p>Validé le : <strong>${validationDate}</strong></p>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Erreur historique", err);
  }
}

// Charger mes filleuls
async function loadReferrals() {
  try {
    const res = await fetch('/api/dashboard/referrals', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('referralsList');
    container.innerHTML = '';

    if (!data.referrals || data.referrals.length === 0) {
      container.innerHTML = '<p>Vous n\'avez aucun filleul directement parrainé pour l\'instant.</p>';
      return;
    }

    data.referrals.forEach(ref => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>👤 ${ref.fullName}</h3>
        <p>WhatsApp : <strong>${ref.whatsapp || 'N/A'}</strong></p>
        <p>Email : ${ref.email}</p>
        <p>Inscrit le : ${new Date(ref.createdAt).toLocaleDateString('fr-FR')}</p>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Erreur parrainage", err);
  }
}

// Charger le profil utilisateur
function loadProfile() {
  if (!currentUser) return;
  document.getElementById('profileName').value = currentUser.fullName || '';
  document.getElementById('profileEmail').value = currentUser.email || '';
  document.getElementById('profileWhatsapp').value = currentUser.whatsapp || '';
  document.getElementById('profileOrange').value = currentUser.paymentMethods?.orange || '';
  document.getElementById('profileWave').value = currentUser.paymentMethods?.wave || '';
  document.getElementById('profileMoov').value = currentUser.paymentMethods?.moov || '';
  document.getElementById('profileMtn').value = currentUser.paymentMethods?.mtn || '';
  document.getElementById('profileUsdt').value = currentUser.paymentMethods?.usdtAddress || '';
}

function logout() {
  localStorage.removeItem('token');
  window.location.href = '/login.html';
}

// Démarrer au chargement
initDashboard();