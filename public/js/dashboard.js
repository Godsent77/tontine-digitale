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
    console.error("Erreur init dashboard:", err);
  }
}

async function fetchUsdtRate() {
  try {
    const res = await fetch('/api/donation/usdt-rate');
    const data = await res.json();
    if (data.success && data.rate) {
      document.getElementById('usdtRateDisplay').innerText = `📊 Taux Direct : 1 USDT = ${data.rate} FCFA (Binance P2P)`;
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
      timerEl.innerText = `Valide pendant ${timeLeft}s`;

      const interval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
          clearInterval(interval);
          timerEl.innerText = "Code expiré.";
          document.getElementById('generatedCodeDisplay').innerText = "------";
        } else {
          timerEl.innerText = `Valide pendant ${timeLeft}s`;
        }
      }, 1000);
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert("Erreur génération code.");
  }
}

async function submitDonation(amount) {
  if (!confirm(`Confirmez-vous le don de ${amount.toLocaleString()} FCFA ?`)) return;

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
      container.innerHTML = '<p style="color:#777;">Aucun don actif actuellement.</p>';
      return;
    }

    data.donations.forEach(d => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#f8f9fa; padding:12px; border-radius:6px; margin-bottom:10px; border-left:4px solid #27ae60;';
      card.innerHTML = `
        <h4 style="margin:0; color:#2c3e50;">Montant : ${d.amount.toLocaleString()} FCFA</h4>
        <p style="margin:5px 0 0 0; font-size:13px; color:#666;">Statut : <strong style="color:#e67e22;">${d.status}</strong> | Date : ${new Date(d.createdAt).toLocaleString('fr-FR')}</p>
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
      container.innerHTML = '<p style="color:#777;">Aucune fusion active pour le moment.</p>';
      return;
    }

    data.fusions.forEach(f => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#f8f9fa; padding:15px; border-radius:6px; margin-bottom:15px; border-left:4px solid #3498db;';
      card.innerHTML = `
        <h4 style="margin:0;">Fusion #${f._id.substr(-6)} - Gain Prévu : ${(f.expectedAmount || 0).toLocaleString()} FCFA</h4>
        <p>Progression : <strong>${f.progressPercent}%</strong> ${f.isPaused ? '<span style="color:red; font-weight:bold;">(Mise en Pause)</span>' : ''}</p>
        ${f.donorId && f.donorId._id === currentUser._id ? `
          <div style="background:#eef; padding:10px; border-radius:5px; font-size:13px;">
            <strong>Receveur :</strong> ${f.receiverId.fullName} (${f.receiverId.whatsapp || 'N/A'})<br>
            <strong>Orange :</strong> ${f.receiverId.paymentMethods?.orange || 'N/A'} | <strong>Wave :</strong> ${f.receiverId.paymentMethods?.wave || 'N/A'}<br>
            <strong>Moov :</strong> ${f.receiverId.paymentMethods?.moov || 'N/A'} | <strong>MTN :</strong> ${f.receiverId.paymentMethods?.mtn || 'N/A'}<br>
            <strong>USDT BEP20 :</strong> ${f.receiverId.paymentMethods?.usdtAddress || 'N/A'}
          </div>
        ` : ''}
        ${f.receiverId && f.receiverId._id === currentUser._id ? `
          <button onclick="confirmReceipt('${f._id}')" style="background:#27ae60; color:white; border:none; padding:8px 12px; border-radius:4px; font-weight:bold; cursor:pointer; margin-top:10px;">✅ Confirmer Réception du Paiement</button>
        ` : ''}
      `;
      container.appendChild(card);
    });
  } catch (err) { console.error(err); }
}

async function confirmReceipt(fusionId) {
  if (!confirm("Confirmez-vous la réception du paiement ?")) return;
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
      container.innerHTML = '<p style="color:#777;">Aucun cycle en progression.</p>';
      return;
    }

    data.fusions.forEach(f => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#fff; padding:15px; border-radius:6px; margin-bottom:15px; border:1px solid #ddd;';
      card.innerHTML = `
        <h4 style="margin:0 0 10px 0;">Cycle de Progression - ${f.progressPercent}%</h4>
        <div style="background:#eee; border-radius:10px; height:18px; width:100%; overflow:hidden;">
          <div style="background:#27ae60; height:100%; width:${f.progressPercent}%;"></div>
        </div>
        <p style="font-size:13px; margin:8px 0 0 0; color:#555;">Gain Prévu (x2) : <strong>${(f.expectedAmount || 0).toLocaleString()} FCFA</strong> dans 25 jours</p>
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
      container.innerHTML = '<p style="color:#777;">Aucune transaction terminée dans l\'historique.</p>';
      return;
    }

    data.history.forEach(h => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#f8f9fa; padding:12px; border-radius:6px; margin-bottom:10px; border-left:4px solid #27ae60;';
      const vDate = h.validatedAt ? new Date(h.validatedAt).toLocaleString('fr-FR') : 'Date non disponible';
      card.innerHTML = `
        <h4 style="margin:0; color:#27ae60;">📜 Don/Paiement de ${h.amount.toLocaleString()} FCFA - VALIDÉ</h4>
        <p style="margin:5px 0 0 0; font-size:13px; color:#666;">Validé le : <strong>${vDate}</strong></p>
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
      container.innerHTML = '<p style="color:#777;">Vous n\'avez aucun filleul parrainé pour l\'instant.</p>';
      return;
    }

    data.referrals.forEach(ref => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#fff; padding:12px; border-radius:6px; margin-bottom:10px; border:1px solid #eee;';
      card.innerHTML = `
        <h4 style="margin:0;">👤 ${ref.fullName}</h4>
        <p style="margin:5px 0 0 0; font-size:13px; color:#555;">WhatsApp : <strong>${ref.whatsapp || 'N/A'}</strong> | Email : ${ref.email}</p>
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