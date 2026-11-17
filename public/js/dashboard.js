const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/login';
}

let currentUser = null;
let myDonations = [];
let myFusions = [];
let timer30MinInterval = null;
let code30SecInterval = null;

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
}

function showAlert(message, isError = false) {
  const alertEl = document.getElementById('dashboardAlert');
  if (!alertEl) return;

  alertEl.style.display = 'block';
  alertEl.style.background = isError ? '#fdecea' : '#e8f8f5';
  alertEl.style.color = isError ? '#c0392b' : '#1e8449';
  alertEl.style.border = isError ? '1px solid #f5c6cb' : '1px solid #a3e4d7';
  alertEl.textContent = message;

  setTimeout(() => {
    alertEl.style.display = 'none';
  }, 6000);
}

function switchTab(tabId, btnElement) {
  document.querySelectorAll('.tab-content').forEach((sec) => {
    sec.style.display = 'none';
    sec.classList.remove('active');
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.remove('active');
  });

  const target = document.getElementById(tabId);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
  }

  if (btnElement) {
    btnElement.classList.add('active');
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

function formatChrono(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
}

// 1. Charger le statut et la liste des demandes de dons
async function loadStatus() {
  try {
    const res = await fetch('/api/donation/my-status', { headers: getHeaders() });
    if (res.status === 401) {
      logout();
      return;
    }

    const data = await res.json();
    if (!res.ok) return;

    currentUser = data.user;
    myDonations = data.donations || [];

    const welcomeEl = document.getElementById('userWelcome');
    if (welcomeEl && currentUser) {
      welcomeEl.textContent = `👤 ${currentUser.fullName} (${currentUser.referralCode})`;
    }

    const adminBtn = document.getElementById('adminNavBtn');
    if (adminBtn && currentUser && (currentUser.role === 'founder' || currentUser.role === 'sub_founder')) {
      adminBtn.style.display = 'inline-block';
    }

    const dailyEl = document.getElementById('dailyUsedDisplay');
    if (dailyEl) {
      dailyEl.textContent = `${Number(data.dailyDonationTotal || 0).toLocaleString('fr-FR')} FCFA`;
    }

    const refInput = document.getElementById('referralLinkInput');
    if (refInput && currentUser) {
      refInput.value = `${window.location.origin}/register?ref=${currentUser.referralCode}`;
    }

    renderDonations();
    renderProfile();
  } catch (err) {
    console.error('Erreur loadStatus:', err);
  }
}

// 2. Créer une demande de don (lance le chrono de 30 minutes)
async function createDonation(amount) {
  const ok = confirm(
    `Voulez-vous lancer une demande de don de ${Number(amount).toLocaleString('fr-FR')} FCFA ?\n\n⏱️ Vous aurez 30 minutes chrono pour annuler si vous changez d'avis.`
  );
  if (!ok) return;

  try {
    const res = await fetch('/api/donation/create', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ amount: Number(amount) })
    });

    const data = await res.json();
    if (!res.ok) {
      showAlert(data.message || 'Erreur lors de la création du don.', true);
      return;
    }

    showAlert(data.message || 'Demande de don créée !');
    await loadStatus();
    await loadFusions();
  } catch (err) {
    showAlert('Erreur réseau lors de la création de la demande de don.', true);
  }
}

// 3. Annuler une demande de don pendant les 30 minutes
async function cancelDonationRequest(donationId, amount) {
  const ok = confirm(
    `Confirmez-vous l'annulation de votre demande de don de ${Number(amount).toLocaleString('fr-FR')} FCFA ?`
  );
  if (!ok) return;

  try {
    const res = await fetch(`/api/donation/cancel/${donationId}`, {
      method: 'POST',
      headers: getHeaders()
    });

    const data = await res.json();
    if (!res.ok) {
      showAlert(data.message || "Impossible d'annuler cette demande.", true);
      await loadStatus();
      return;
    }

    showAlert(data.message || 'Demande annulée avec succès.');
    await loadStatus();
  } catch (err) {
    showAlert("Erreur réseau lors de l'annulation.", true);
  }
}

// 4. Afficher les demandes de dons et leur compte à rebours de 30 minutes
function renderDonations() {
  const container = document.getElementById('myDonationsList');
  if (!container) return;

  if (!myDonations.length) {
    container.innerHTML = `<p style="color:#777;">Aucune demande de don pour le moment.</p>`;
    return;
  }

  const now = Date.now();
  const thirtyMinMs = 30 * 60 * 1000;

  container.innerHTML = myDonations
    .map((d) => {
      const deadlineMs = d.cancelDeadline
        ? new Date(d.cancelDeadline).getTime()
        : new Date(d.createdAt).getTime() + thirtyMinMs;
      const remainingMs = deadlineMs - now;
      const isPending = d.status === 'pending' || d.status === 'waiting';
      const canStillCancel = isPending && remainingMs > 0;
      const barWidth = Math.max(0, Math.min(100, (remainingMs / thirtyMinMs) * 100));

      let statusTag = '';
      if (isPending) {
        statusTag = canStillCancel
          ? `<span style="background:#fef3c7; color:#b45309; padding:4px 10px; border-radius:50px; font-size:0.82rem; font-weight:700;">⏱️ Annulable pendant 30 min</span>`
          : `<span style="background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:50px; font-size:0.82rem; font-weight:700;">✅ Pris en compte (En attente de fusion)</span>`;
      } else if (d.status === 'matched') {
        statusTag = `<span style="background:#e0f2fe; color:#0369a1; padding:4px 10px; border-radius:50px; font-size:0.82rem; font-weight:700;">🔄 Fusionné</span>`;
      } else {
        statusTag = `<span style="background:#d1fae5; color:#065f46; padding:4px 10px; border-radius:50px; font-size:0.82rem; font-weight:700;">✅ Validé / Actif</span>`;
      }

      let countdownHtml = '';
      if (isPending) {
        if (canStillCancel) {
          countdownHtml = `
            <div class="countdown-box" data-deadline="${deadlineMs}" data-id="${d._id}">
              <div class="countdown-header">
                <span style="font-weight:700; color:#92400e; font-size:0.9rem;">
                  ⏳ Compte à rebours avant prise en compte définitive :
                </span>
                <span class="countdown-badge js-chrono-text">
                  ⏱️ ${formatChrono(remainingMs)}
                </span>
              </div>
              <div class="countdown-progress-bg">
                <div class="countdown-progress-bar js-chrono-bar" style="width:${barWidth}%;"></div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <small style="color:#78350f;">
                  Passé ce compte à rebours de 30 minutes, la demande est définitivement prise en compte.
                </small>
                <button class="btn-cancel-request" onclick="cancelDonationRequest('${d._id}', ${d.amount})">
                  ❌ Annuler ma demande
                </button>
              </div>
            </div>
          `;
        } else {
          countdownHtml = `
            <div class="validated-request-box">
              ✅ Les 30 minutes sont écoulées : Votre demande de don est prise en compte et prête pour la fusion.
            </div>
          `;
        }
      }

      return `
        <div class="item-card">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <strong style="font-size:1.1rem; color:#2c3e50;">
              🎁 Don de ${Number(d.amount).toLocaleString('fr-FR')} FCFA
              <small style="color:#64748b; font-weight:500;">(≈ ${d.usdtAmount || (d.amount / 650).toFixed(2)} USDT)</small>
            </strong>
            ${statusTag}
          </div>
          <div style="margin-top:6px; font-size:0.9rem; color:#475569;">
            🎯 Retour x2 : <strong style="color:#27ae60;">${Number(d.amount * 2).toLocaleString('fr-FR')} FCFA</strong>
            • 📅 Date : ${new Date(d.createdAt).toLocaleString('fr-FR')}
          </div>
          ${countdownHtml}
        </div>
      `;
    })
    .join('');

  startChronoTicker();
}

// 5. Faire défiler le chronomètre chaque seconde en direct
function startChronoTicker() {
  if (timer30MinInterval) clearInterval(timer30MinInterval);

  const thirtyMinMs = 30 * 60 * 1000;

  timer30MinInterval = setInterval(async () => {
    const boxes = document.querySelectorAll('.countdown-box[data-deadline]');
    if (!boxes.length) return;

    const now = Date.now();
    let anyExpired = false;

    boxes.forEach((box) => {
      const deadline = Number(box.getAttribute('data-deadline'));
      const remaining = deadline - now;
      const textEl = box.querySelector('.js-chrono-text');
      const barEl = box.querySelector('.js-chrono-bar');

      if (remaining <= 0) {
        anyExpired = true;
      } else {
        if (textEl) textEl.textContent = `⏱️ ${formatChrono(remaining)}`;
        if (barEl) {
          const pct = Math.max(0, Math.min(100, (remaining / thirtyMinMs) * 100));
          barEl.style.width = `${pct}%`;
        }
      }
    });

    if (anyExpired) {
      clearInterval(timer30MinInterval);
      await loadStatus();
      await loadFusions();
    }
  }, 1000);
}

// 6. Charger les fusions actives et la progression
async function loadFusions() {
  const container = document.getElementById('myFusionsList');
  if (!container) return;

  try {
    const res = await fetch('/api/fusion/my-fusions', { headers: getHeaders() });
    const data = await res.json();
    myFusions = Array.isArray(data) ? data : [];

    renderProgress();

    const pendingFusions = myFusions.filter((f) => f.status === 'pending');

    if (!pendingFusions.length) {
      container.innerHTML = `<p style="color:#777;">Aucune fusion en attente de paiement pour le moment.</p>`;
      return;
    }

    const myId = currentUser ? String(currentUser._id) : '';

    container.innerHTML = pendingFusions
      .map((f) => {
        const isReceiver = f.receiverId && String(f.receiverId._id || f.receiverId) === myId;
        const donor = f.donorId || {};
        const receiver = f.receiverId || {};
        const pm = receiver.paymentMethods || {};

        return `
          <div class="item-card" style="border-left-color:${isReceiver ? '#27ae60' : '#2980b9'};">
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <strong>
                ${isReceiver ? '📥 Don à Recevoir' : '📤 Don à Envoyer'} : ${Number(f.amount).toLocaleString('fr-FR')} FCFA
              </strong>
              <span style="background:#fef3c7; color:#b45309; padding:3px 10px; border-radius:50px; font-size:0.8rem; font-weight:700;">
                En attente de confirmation
              </span>
            </div>

            <div style="margin-top:10px; background:#f8fafc; padding:12px; border-radius:8px; font-size:0.9rem;">
              <div><strong>📤 Donneur :</strong> ${donor.fullName || 'Membre'} (WhatsApp : ${donor.whatsapp || donor.phone || 'N/A'})</div>
              <div style="margin-top:4px;"><strong>📥 Receveur :</strong> ${receiver.fullName || 'Membre'} (WhatsApp : ${receiver.whatsapp || receiver.phone || 'N/A'})</div>
              <div style="margin-top:8px; padding-top:8px; border-top:1px dashed #cbd5e1;">
                <strong>💳 Moyens de paiement du Receveur :</strong><br/>
                🟠 Orange : <strong>${pm.orangeMoney || 'N/A'}</strong> |
                🔵 Wave : <strong>${pm.wave || 'N/A'}</strong> |
                🟡 MTN : <strong>${pm.mtnMoney || 'N/A'}</strong> |
                🟣 Moov : <strong>${pm.moovMoney || 'N/A'}</strong><br/>
                💎 USDT BEP20 : <strong>${pm.usdtBep20 || 'N/A'}</strong>
              </div>
            </div>

            ${
              isReceiver
                ? `<div style="margin-top:12px; text-align:right;">
                    <button class="btn btn-primary" onclick="confirmFusionReceipt('${f._id}')">
                      ✅ Confirmer la réception du don
                    </button>
                  </div>`
                : ''
            }
          </div>
        `;
      })
      .join('');
  } catch (err) {
    container.innerHTML = `<p style="color:#c0392b;">Erreur lors du chargement des fusions.</p>`;
  }
}

async function confirmFusionReceipt(fusionId) {
  if (!confirm('Confirmez-vous avoir bien reçu ce paiement ?')) return;

  try {
    const res = await fetch('/api/fusion/confirm-receipt', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ fusionId })
    });
    const data = await res.json();
    if (!res.ok) {
      showAlert(data.message || 'Erreur lors de la validation.', true);
      return;
    }

    showAlert('✅ Paiement confirmé et déplacé dans votre Historique !');
    await loadStatus();
    await loadFusions();
    await loadHistory();
  } catch (err) {
    showAlert('Erreur réseau.', true);
  }
}

function renderProgress() {
  const container = document.getElementById('myProgressList');
  if (!container) return;

  const activeList = myFusions.filter((f) => f.status !== 'pending');
  if (!activeList.length) {
    container.innerHTML = `<p style="color:#777;">Aucun cycle actif en progression pour le moment.</p>`;
    return;
  }

  container.innerHTML = activeList
    .map((f) => {
      const pct = Math.min(100, f.progressPercent || 0);
      return `
        <div class="item-card">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <strong>Cycle de ${Number(f.amount).toLocaleString('fr-FR')} FCFA → Retour : ${Number(f.amount * 2).toLocaleString('fr-FR')} FCFA</strong>
            <strong style="color:#27ae60;">${pct}% / 100%</strong>
          </div>
          <div style="width:100%; height:14px; background:#e2e8f0; border-radius:50px; overflow:hidden;">
            <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #27ae60, #2ecc71);"></div>
          </div>
        </div>
      `;
    })
    .join('');
}

// 7. Charger l'historique
async function loadHistory() {
  const container = document.getElementById('myHistoryList');
  if (!container) return;

  try {
    const res = await fetch('/api/donation/my-history', { headers: getHeaders() });
    const list = await res.json();

    if (!res.ok || !Array.isArray(list) || !list.length) {
      container.innerHTML = `<p style="color:#777;">Aucune transaction validée dans l'historique.</p>`;
      return;
    }

    const myId = currentUser ? String(currentUser._id) : '';

    container.innerHTML = list
      .map((h) => {
        const isReceiver = h.receiverId && String(h.receiverId._id || h.receiverId) === myId;
        const dateStr = h.validatedAt
          ? new Date(h.validatedAt).toLocaleString('fr-FR')
          : new Date(h.createdAt).toLocaleString('fr-FR');

        return `
          <div class="item-card">
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap;">
              <strong>${isReceiver ? '📥 Don Reçu' : '📤 Don Envoyé'} : ${Number(h.amount).toLocaleString('fr-FR')} FCFA</strong>
              <span style="color:#15803d; font-weight:700;">✅ Validé le ${dateStr}</span>
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    container.innerHTML = `<p style="color:#c0392b;">Erreur chargement historique.</p>`;
  }
}

// 8. Parrainage : Copier le lien et Générer le code 30 secondes
function copyReferralLink() {
  const input = document.getElementById('referralLinkInput');
  if (!input || !input.value) return;
  navigator.clipboard.writeText(input.value);
  showAlert('📋 Lien de parrainage copié !');
}

async function generateAccessCode() {
  try {
    const res = await fetch('/api/auth/generate-code', {
      method: 'POST',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) {
      showAlert(data.message || 'Erreur génération code.', true);
      return;
    }

    const box = document.getElementById('accessCodeBox');
    const val = document.getElementById('accessCodeValue');
    const timer = document.getElementById('accessCodeTimer');

    box.style.display = 'block';
    val.textContent = data.accessCode || data.code;

    let sec = 30;
    timer.textContent = sec;

    if (code30SecInterval) clearInterval(code30SecInterval);
    code30SecInterval = setInterval(() => {
      sec--;
      timer.textContent = Math.max(0, sec);
      if (sec <= 0) {
        clearInterval(code30SecInterval);
        val.textContent = 'EXPIRÉ';
      }
    }, 1000);
  } catch (err) {
    showAlert('Erreur réseau.', true);
  }
}

async function loadReferrals() {
  const container = document.getElementById('myReferralsList');
  if (!container) return;

  try {
    const res = await fetch('/api/dashboard/referrals', { headers: getHeaders() });
    const data = await res.json();
    const referrals = Array.isArray(data) ? data : data.referrals || [];

    if (!referrals.length) {
      container.innerHTML = `<p style="color:#777;">Aucun filleul inscrit pour le moment.</p>`;
      return;
    }

    container.innerHTML = referrals
      .map(
        (r) => `
        <div class="item-card">
          <strong>👤 ${r.fullName}</strong> (${r.referralCode || ''})<br/>
          <small style="color:#475569;">📧 ${r.email} | 💬 WhatsApp : ${r.whatsapp || r.phone || 'N/A'}</small>
        </div>
      `
      )
      .join('');
  } catch (err) {
    container.innerHTML = `<p style="color:#777;">Aucun filleul trouvé.</p>`;
  }
}

function renderProfile() {
  const container = document.getElementById('profileDetails');
  if (!container || !currentUser) return;

  const pm = currentUser.paymentMethods || {};
  container.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
      <div style="background:#f8fafc; padding:12px; border-radius:8px;"><strong>Nom :</strong><br/>${currentUser.fullName}</div>
      <div style="background:#f8fafc; padding:12px; border-radius:8px;"><strong>Email :</strong><br/>${currentUser.email}</div>
      <div style="background:#f8fafc; padding:12px; border-radius:8px;"><strong>WhatsApp :</strong><br/>${currentUser.whatsapp || currentUser.phone || 'N/A'}</div>
      <div style="background:#f8fafc; padding:12px; border-radius:8px;"><strong>Code Parrain :</strong><br/>${currentUser.referralCode}</div>
      <div style="background:#fff3e0; padding:12px; border-radius:8px;"><strong>🟠 Orange Money :</strong><br/>${pm.orangeMoney || 'Non renseigné'}</div>
      <div style="background:#e1f5fe; padding:12px; border-radius:8px;"><strong>🔵 Wave :</strong><br/>${pm.wave || 'Non renseigné'}</div>
      <div style="background:#fffde7; padding:12px; border-radius:8px;"><strong>🟡 MTN :</strong><br/>${pm.mtnMoney || 'Non renseigné'}</div>
      <div style="background:#e8eaf6; padding:12px; border-radius:8px;"><strong>🟣 Moov :</strong><br/>${pm.moovMoney || 'Non renseigné'}</div>
      <div style="background:#e8f8f5; padding:12px; border-radius:8px; grid-column:1 / -1;"><strong>💎 USDT BEP20 :</strong><br/>${pm.usdtBep20 || 'Non renseigné'}</div>
    </div>
  `;
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadStatus();
  await loadFusions();
  await loadHistory();
  await loadReferrals();
});