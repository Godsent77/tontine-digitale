const token = localStorage.getItem('token');

if (!token) {
  window.location.href = '/login';
}

let currentUser = null;

async function initDashboard() {
  try {
    const res = await fetch('/api/donation/my-status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!data.success || !data.user) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      return;
    }

    currentUser = data.user;
    document.getElementById('userNameDisplay').innerText = currentUser.fullName;
    document.getElementById('userCodeDisplay').innerText = currentUser.referralCode;

    // Définir le lien de parrainage
    const referralLink = `${window.location.origin}/register?ref=${currentUser.referralCode}`;
    const linkInput = document.getElementById('myReferralLink');
    if (linkInput) linkInput.value = referralLink;

    // Bouton de redirection vers le Backoffice
    const btnAdmin = document.getElementById('btnAdminNav');
    if (btnAdmin) {
      if (currentUser.role === 'founder' || currentUser.role === 'sub_founder') {
        btnAdmin.style.display = 'inline-block';
        btnAdmin.innerText = currentUser.role === 'founder' ? '👑 Backoffice' : '⭐ Panel Sous-Fondateur';
      } else {
        btnAdmin.style.display = 'none';
      }
    }

    fetchUsdtRate();
    showTab('donations');
    loadMyDonations();
  } catch (err) {
    console.error("Erreur d'initialisation du dashboard:", err);
  }
}

function copyReferralLink() {
  const linkInput = document.getElementById('myReferralLink');
  linkInput.select();
  document.execCommand('copy');
  alert("Lien de parrainage copié dans le presse-papier !");
}

async function fetchUsdtRate() {
  try {
    const res = await fetch('/api/donation/usdt-rate');
    const data = await res.json();
    if (data.success && data.rate) {
      document.getElementById('usdtRateDisplay').innerText = `📊 Taux Binance P2P Direct : 1 USDT = ${data.rate} FCFA`;
    }
  } catch (err) {
    console.error("Erreur taux USDT", err);
  }
}

function showTab(tabName) {
  const tabs = ['donations', 'fusions', 'progress', 'history', 'referrals', 'profile'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tabBtn-${t}`);
    if (el) el.style.display = (t === tabName) ? 'block' : 'none';
    if (btn) {
      if (t === tabName) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });

  if (tabName === 'fusions') loadActiveFusions();
  if (tabName === 'progress') loadProgression();
  if (tabName === 'history') loadHistory();
  if (tabName === 'referrals') loadReferrals();
  if (tabName === 'profile') loadProfile();
}

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
      timerEl.innerText = `Code valide pendant ${timeLeft}s`;

      const interval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
          clearInterval(interval);
          timerEl.innerText = "Code expiré. Régénérez un nouveau code.";
          document.getElementById('generatedCodeDisplay').innerText = "------";
        } else {
          timerEl.innerText = `Code valide pendant ${timeLeft}s`;
        }
      }, 1000);
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert("Erreur génération du code.");
  }
}

async function submitDonation(amount) {
  if (!confirm(`Confirmez-vous la création de votre demande de don de ${amount.toLocaleString()} FCFA ?`)) return;

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
    alert("Erreur création du don.");
  }
}

async function loadMyDonations() {
  try {
    const res = await fetch('/api/donation/my-donations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('myDonationsList');
    container.innerHTML = '';

    if (!data.donations || data.donations.length === 0) {
      container.innerHTML = '<p style="color:#7f8c8d;">Aucune demande de don active actuellement.</p>';
      return;
    }

    data.donations.forEach(d => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#f8f9fa; padding:12px 15px; border-radius:6px; margin-bottom:10px; border-left:4px solid #27ae60;';
      card.innerHTML = `
        <h4 style="margin:0; color:#2c3e50;">Montant : ${d.amount.toLocaleString()} FCFA</h4>
        <p style="margin:5px 0 0 0; font-size:13px; color:#7f8c8d;">Statut : <strong style="color:#e67e22;">${d.status}</strong> | Date : ${new Date(d.createdAt).toLocaleString('fr-FR')}</p>
      `;
      container.appendChild(card);
    });
  } catch (err) { console.error(err); }
}

async function loadActiveFusions() {
  try {
    const res = await fetch('/api/fusion/my-fusions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('activeFusionsList');
    container.innerHTML = '';

    if (!data.fusions || data.fusions.length === 0) {
      container.innerHTML = '<p style="color:#7f8c8d;">Aucune fusion active pour le moment.</p>';
      return;
    }

    data.fusions.forEach(f => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#ffffff; padding:18px; border-radius:8px; margin-bottom:15px; border:1px solid #e1e8ed; border-left:5px solid #3498db;';
      card.innerHTML = `
        <h4 style="margin:0 0 8px 0; color:#2c3e50;">Fusion #${f._id.substr(-6)} - Montant Prévu : ${(f.expectedAmount || 0).toLocaleString()} FCFA</h4>
        <p style="margin:0 0 10px 0;">Progression : <strong>${f.progressPercent}%</strong> ${f.isPaused ? '<span style="color:#e74c3c; font-weight:bold;">(En Pause)</span>' : ''}</p>
        ${f.donorId && f.donorId._id === currentUser._id ? `
          <div style="background:#ebf5fb; padding:12px; border-radius:6px; font-size:13px; color:#1b4f72;">
            <strong style="font-size:14px; display:block; margin-bottom:5px;">Coordonnées du Receveur :</strong>
            Nom : <strong>${f.receiverId.fullName}</strong><br>
            WhatsApp : <strong>${f.receiverId.whatsapp || 'N/A'}</strong><br>
            Orange Money : ${f.receiverId.paymentMethods?.orange || 'N/A'} | Wave : ${f.receiverId.paymentMethods?.wave || 'N/A'}<br>
            Moov Money : ${f.receiverId.paymentMethods?.moov || 'N/A'} | MTN Money : ${f.receiverId.paymentMethods?.mtn || 'N/A'}<br>
            USDT BEP20 : ${f.receiverId.paymentMethods?.usdtAddress || 'N/A'}
          </div>
        ` : ''}
        ${f.receiverId && f.receiverId._id === currentUser._id ? `
          <button onclick="confirmReceipt('${f._id}')" class="btn btn-success" style="margin-top:10px;">✅ Confirmer Réception du Paiement</button>
        ` : ''}
      `;
      container.appendChild(card);
    });
  } catch (err) { console.error(err); }
}

async function confirmReceipt(fusionId) {
  if (!confirm("Confirmez-vous avoir reçu les fonds sur votre compte ?")) return;
  try {
    const res = await fetch('/api/fusion/confirm-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ fusionId })
    });
    const data = await res.json();
    alert(data.message);
    loadActiveFusions();
  } catch (err) { alert("Erreur confirmation."); }
}

async function loadProgression() {
  try {
    const res = await fetch('/api/fusion/my-fusions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('progressionList');
    container.innerHTML = '';

    if (!data.fusions || data.fusions.length === 0) {
      container.innerHTML = '<p style="color:#7f8c8d;">Aucun cycle actuellement en progression.</p>';
      return;
    }

    data.fusions.forEach(f => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#ffffff; padding:18px; border-radius:8px; margin-bottom:15px; border:1px solid #e1e8ed;';
      card.innerHTML = `
        <h4 style="margin:0 0 10px 0; color:#2c3e50;">Cycle de Progression - ${f.progressPercent}%</h4>
        <div style="background:#ecf0f1; border-radius:10px; height:20px; width:100%; overflow:hidden;">
          <div style="background:#27ae60; height:100%; width:${f.progressPercent}%;"></div>
        </div>
        <p style="font-size:13px; margin:10px 0 0 0; color:#34495e;">Gain Prévu (x2) : <strong>${(f.expectedAmount || 0).toLocaleString()} FCFA</strong> dans 25 jours (+4%/24h)</p>
      `;
      container.appendChild(card);
    });
  } catch (err) { console.error(err); }
}

async function loadHistory() {
  try {
    const res = await fetch('/api/donation/my-history', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('historyList');
    container.innerHTML = '';

    if (!data.history || data.history.length === 0) {
      container.innerHTML = '<p style="color:#7f8c8d;">Aucune transaction dans votre historique.</p>';
      return;
    }

    data.history.forEach(h => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#f8f9fa; padding:14px; border-radius:6px; margin-bottom:10px; border-left:5px solid #27ae60;';
      const vDate = h.validatedAt ? new Date(h.validatedAt).toLocaleString('fr-FR') : 'Non renseignée';
      card.innerHTML = `
        <h4 style="margin:0; color:#27ae60;">📜 Transaction de ${h.amount.toLocaleString()} FCFA - VALIDÉE</h4>
        <p style="margin:5px 0 0 0; font-size:13px; color:#7f8c8d;">Validée le : <strong>${vDate}</strong></p>
      `;
      container.appendChild(card);
    });
  } catch (err) { console.error(err); }
}

async function loadReferrals() {
  try {
    const res = await fetch('/api/dashboard/referrals', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('referralsList');
    container.innerHTML = '';

    if (!data.referrals || data.referrals.length === 0) {
      container.innerHTML = '<p style="color:#7f8c8d;">Vous n\'avez aucun filleul directement inscrit pour l\'instant.</p>';
      return;
    }

    data.referrals.forEach(ref => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#ffffff; padding:15px; border-radius:8px; margin-bottom:12px; border:1px solid #e1e8ed;';
      card.innerHTML = `
        <h4 style="margin:0; color:#2c3e50;">👤 ${ref.fullName}</h4>
        <p style="margin:6px 0 0 0; font-size:13px; color:#34495e;">WhatsApp : <strong style="color:#27ae60;">${ref.whatsapp || 'N/A'}</strong> | Email : ${ref.email}</p>
        <p style="margin:3px 0 0 0; font-size:12px; color:#95a5a6;">Inscrit le : ${new Date(ref.createdAt).toLocaleDateString('fr-FR')}</p>
      `;
      container.appendChild(card);
    });
  } catch (err) { console.error(err); }
}

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
  window.location.href = '/login';
}

initDashboard();