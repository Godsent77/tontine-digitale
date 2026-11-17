let U = null, F = [];
const AM = [5000, 10000, 20000, 50000];
const PM = ['orange_money', 'wave', 'moov_money', 'mtn_money', 'usdt_bep20'];
const PL = { orange_money: 'Orange Money', wave: 'Wave', moov_money: 'Moov Money', mtn_money: 'MTN Money', usdt_bep20: 'USDT BEP20' };

async function api(u, o) {
  o = o || {};
  o.headers = Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('tk') }, o.headers || {});
  var r = await fetch(u, o);
  var d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Erreur');
  return d;
}

function toast(m, t) {
  t = t || 'success';
  var d = document.createElement('div');
  d.className = 'toast toast-' + t;
  d.textContent = m;
  document.body.appendChild(d);
  setTimeout(function() { d.remove(); }, 4000);
}

function fmt(n) { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

function badge(s) {
  var m = { pending: 'En attente', active: 'Actif', completed: 'Termine', cancelled: 'Annule', paid: 'Paye', validated: 'Valide' };
  return '<span class="badge badge-' + s + '">' + (m[s] || s) + '</span>';
}

function tab(t) {
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.tab === t); });
  document.querySelectorAll('.tab-pane').forEach(function(p) { p.classList.toggle('active', p.id === 'tab-' + t); });
  if (t === 'fusion') loadFusion();
  if (t === 'progress') loadProgress();
  if (t === 'historique') loadHistory();
  if (t === 'parrainage') { loadDuties(); loadReferrals(); }
}

function initPayGrid() {
  var h = '';
  PM.forEach(function(p) {
    h += '<label class="pay-opt"><input type="radio" name="payMethod" value="' + p + '" onchange="updSum()"> ' + PL[p] + '</label>';
  });
  document.getElementById('payGrid').innerHTML = h;
}

async function loadDash() {
  try {
    var d = await api('/api/dashboard');
    U = d.user;
    F = d.fusions || [];
    if (U.sponsorCode === 'AUCUN' || (U.referralCode && U.referralCode.indexOf('FONDATEUR') === 0)) {
  if (!document.getElementById('btnAdmin')) {
    var hRight = document.querySelector('.header-right');
    var btnA = document.createElement('a');
    btnA.id = 'btnAdmin';
    btnA.href = '/admin';
    btnA.className = 'btn btn-sm btn-warning';
    btnA.style.marginRight = '8px';
    btnA.textContent = '👑 Backoffice';
    hRight.insertBefore(btnA, hRight.firstChild);
  }
}
    document.getElementById('uName').textContent = U.fullName;
    document.getElementById('uEmail').textContent = U.email;
    document.getElementById('uPhone').textContent = U.whatsapp || U.phone || '-';
    document.getElementById('uSponsor').textContent = U.sponsorCode || 'Fondateur';
    document.getElementById('uLink').value = location.origin + '/register?ref=' + U.referralCode;
    document.getElementById('pFullName').value = U.fullName || '';
    document.getElementById('pWhatsapp').value = U.whatsapp || U.phone || '';
    document.getElementById('pOrange').value = U.paymentMethods ? U.paymentMethods.orange_money || '' : '';
    document.getElementById('pWave').value = U.paymentMethods ? U.paymentMethods.wave || '' : '';
    document.getElementById('pMoov').value = U.paymentMethods ? U.paymentMethods.moov_money || '' : '';
    document.getElementById('pMtn').value = U.paymentMethods ? U.paymentMethods.mtn_money || '' : '';
    document.getElementById('pUsdt').value = U.paymentMethods ? U.paymentMethods.usdt_bep20 || '' : '';
    var dl = d.dailyLimit || { used: 0, max: 50000, remaining: 50000 };
    document.getElementById('dlUsed').textContent = fmt(dl.used) + ' F';
    document.getElementById('dlRem').textContent = fmt(dl.remaining) + ' F';
    document.getElementById('dlBar').style.width = (dl.used / dl.max * 100) + '%';
    AM.forEach(function(a) {
      var b = document.getElementById('amt' + a);
      if (b) b.disabled = dl.remaining < a;
    });
    initPayGrid();
  } catch (e) {
    if (e.message.indexOf('token') >= 0 || e.message.indexOf('expire') >= 0) {
      localStorage.removeItem('tk');
      location.href = '/login';
    } else {
      toast(e.message, 'error');
    }
  }
}

function selA(a) {
  document.querySelectorAll('.amt-btn').forEach(function(b) { b.classList.remove('selected'); });
  var b = document.getElementById('amt' + a);
  if (b && !b.disabled) {
    b.classList.add('selected');
    document.getElementById('donAmt').value = a;
    updSum();
  }
}

function updSum() {
  var a = parseInt(document.getElementById('donAmt').value) || 0;
  var m = document.querySelector('input[name="payMethod"]:checked');
  var sum = document.getElementById('summary');
  if (a > 0 && m) {
    sum.style.display = 'block';
    document.getElementById('sumAmt').textContent = fmt(a) + ' F CFA';
    document.getElementById('sumRec').textContent = fmt(a * 2) + ' F CFA';
    if (m.value === 'usdt_bep20') calcU(a);
    else document.getElementById('usdtInfo').style.display = 'none';
  } else {
    sum.style.display = 'none';
  }
}

async function calcU(a) {
  try {
    var d = await api('/api/donation/usdt-rate?amount=' + a);
    document.getElementById('usdtAmt').textContent = d.usdtAmount + ' USDT';
    document.getElementById('usdtRate').textContent = '1 USDT = ' + fmt(Math.round(d.rate)) + ' F';
    document.getElementById('usdtInfo').style.display = 'block';
  } catch (e) {
    document.getElementById('usdtInfo').style.display = 'none';
  }
}

async function mkDon() {
  var a = parseInt(document.getElementById('donAmt').value);
  var m = document.querySelector('input[name="payMethod"]:checked');
  if (!a || AM.indexOf(a) < 0) return toast('Choisissez un montant', 'error');
  if (!m) return toast('Choisissez un moyen de paiement', 'error');
  if (!confirm('Confirmer la donation de ' + fmt(a) + ' F CFA ?\nVous recevrez ' + fmt(a * 2) + ' F CFA dans 25 jours.')) return;
  try {
    await api('/api/donation', { method: 'POST', body: JSON.stringify({ amount: a, paymentMethod: m.value }) });
    toast('Donation creee ! En attente de fusion...');
    loadDash();
  } catch (e) { toast(e.message, 'error'); }
}

async function loadFusion() {
  try {
    var d = await api('/api/fusion/my-fusions');
    var c = document.getElementById('fusionList');
    // On filtre pour ne garder que les fusions NON encore confirmees par le receveur
    var pendingFusions = (d.fusions || []).filter(function(f) { return !f.receiptConfirmed; });
    if (pendingFusions.length === 0) { c.innerHTML = '<div class="empty">Aucune fusion en attente de paiement</div>'; return; }
    var h = '';
    pendingFusions.forEach(function(f) {
      var isPayer = f.role === 'payer';
      h += '<div class="fusion-card">';
      h += '<div class="fusion-header">' + badge(f.status) + ' <strong>' + fmt(f.amount) + ' F CFA</strong></div>';
      h += '<div class="fusion-body">';
      h += '<p><strong>Partenaire:</strong> ' + (f.partnerName || 'En attente') + '</p>';
      if (f.partner) {
        h += '<p>WhatsApp / Tél: ' + (f.partner.whatsapp || f.partner.phone || '-') + '</p>';
        h += '<p>Email: ' + (f.partner.email || '-') + '</p>';
        h += '<div class="pay-details"><strong>Moyens de paiement du receveur:</strong><br>';
        if (f.partner.paymentMethods) {
          PM.forEach(function(p) {
            if (f.partner.paymentMethods[p]) h += '- ' + PL[p] + ': ' + f.partner.paymentMethods[p] + '<br>';
          });
        }
        h += '</div>';
        if (isPayer) {
          h += '<div class="sponsor-chain"><strong>Chaine de parrainage:</strong><br>';
          h += 'Parrain: ' + (f.partner.sponsor1 || '-') + '<br>';
          h += 'Parrain x2: ' + (f.partner.sponsor2 || '-') + '<br>';
          h += 'Parrain x3: ' + (f.partner.sponsor3 || '-') + '</div>';
          h += '<button onclick="showSP(\'' + f._id + '\')" class="btn btn-sm btn-secondary mt-1">Afficher contacts parrains</button>';
          h += '<div id="sp-' + f._id + '" class="hidden"></div>';
          h += '<div class="mt-1"><button onclick="confirmPay(\'' + f._id + '\',\'direct\')" class="btn btn-success btn-sm">J\'ai paye directement</button></div>';
          h += '<div class="mt-1"><button onclick="payVia(\'' + f._id + '\')" class="btn btn-warning btn-sm">Payer via parrain</button></div>';
          h += '<div id="pvs-' + f._id + '" class="hidden mt-1"></div>';
        } else {
          h += '<div class="mt-1"><button onclick="confirmRecv(\'' + f._id + '\')" class="btn btn-success btn-sm">💰 J\'ai bien recu l\'argent (Valider)</button></div>';
          h += '<div class="mt-1"><button onclick="confirmFwd(\'' + f._id + '\')" class="btn btn-info btn-sm">Mon parrain m\'a transfere l\'argent</button></div>';
        }
      }
      h += '</div></div>';
    });
    c.innerHTML = h;
  } catch (e) { toast(e.message, 'error'); }
}

// CHARGEMENT DE L'HISTORIQUE DES TRANSACTIONS VALIDÉES
async function loadHistory() {
  try {
    var d = await api('/api/fusion/my-fusions');
    var c = document.getElementById('historyList');
    var validatedFusions = (d.fusions || []).filter(function(f) { return f.receiptConfirmed; });
    if (validatedFusions.length === 0) { c.innerHTML = '<div class="empty">Aucune transaction validee dans l\'historique</div>'; return; }
    var h = '';
    validatedFusions.forEach(function(f) {
      var isPayer = f.role === 'payer';
      var vDate = f.validatedAt ? new Date(f.validatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Date inconnue';
      h += '<div class="fusion-card" style="border-left:4px solid #16a34a;">';
      h += '<div class="fusion-header"><span class="badge badge-validated">✔️ Valide</span> <strong>' + fmt(f.amount) + ' F CFA</strong></div>';
      h += '<div class="fusion-body">';
      h += '<p><strong>' + (isPayer ? '💸 Vous avez paye a :' : '💰 Vous avez recu de :') + '</strong> ' + (f.partnerName || 'Partenaire') + '</p>';
      if (f.partner) {
        h += '<p>WhatsApp: ' + (f.partner.whatsapp || f.partner.phone || '-') + ' | Email: ' + (f.partner.email || '-') + '</p>';
      }
      h += '<p><small style="color:#16a34a; font-weight:600;">📅 Valide le : ' + vDate + '</small></p>';
      h += '</div></div>';
    });
    c.innerHTML = h;
  } catch (e) { toast(e.message, 'error'); }
}

async function showSP(fid) {
  try {
    var d = await api('/api/fusion/' + fid + '/sponsor-contacts');
    var el = document.getElementById('sp-' + fid);
    var h = '<div class="sponsor-box"><strong>Contacts parrains:</strong><br>';
    h += 'A1: ' + (d.s1 ? d.s1.fullName + ' - ' + (d.s1.phone || '-') : '-') + '<br>';
    h += 'A2: ' + (d.s2 ? d.s2.fullName + ' - ' + (d.s2.phone || '-') : '-') + '<br>';
    h += 'A3: ' + (d.s3 ? d.s3.fullName + ' - ' + (d.s3.phone || '-') : '-') + '</div>';
    el.innerHTML = h;
    el.classList.remove('hidden');
  } catch (e) { toast(e.message, 'error'); }
}

async function confirmPay(fid, type) {
  if (!confirm('Confirmer que vous avez effectue le paiement ?')) return;
  try {
    await api('/api/fusion/' + fid + '/confirm-payment', { method: 'POST', body: JSON.stringify({ type: type || 'direct' }) });
    toast('Paiement signale !');
    loadFusion();
  } catch (e) { toast(e.message, 'error'); }
}

async function payVia(fid) {
  var el = document.getElementById('pvs-' + fid);
  try {
    var d = await api('/api/fusion/' + fid + '/sponsor-contacts');
    var h = '<strong>Payer via parrain:</strong><br>';
    if (d.s1) h += '<button onclick="doPayVia(\'' + fid + '\',\'s1\')" class="btn btn-sm btn-warning mt-05">Payer via B1 (' + d.s1.fullName + ')</button><br>';
    if (d.s2) h += '<button onclick="doPayVia(\'' + fid + '\',\'s2\')" class="btn btn-sm btn-warning mt-05">Payer via B2 (' + d.s2.fullName + ')</button><br>';
    if (d.s3) h += '<button onclick="doPayVia(\'' + fid + '\',\'s3\')" class="btn btn-sm btn-warning mt-05">Payer via B3 (' + d.s3.fullName + ')</button>';
    el.innerHTML = h;
    el.classList.remove('hidden');
  } catch (e) { toast(e.message, 'error'); }
}

async function doPayVia(fid, sp) {
  if (!confirm('Vous allez payer via le parrain. Appelez-le pour confirmer.')) return;
  try {
    await api('/api/fusion/' + fid + '/confirm-payment', { method: 'POST', body: JSON.stringify({ type: 'via_sponsor', sponsor: sp }) });
    toast('Paiement via parrain signale !');
    loadFusion();
  } catch (e) { toast(e.message, 'error'); }
}

async function confirmRecv(fid) {
  if (!confirm('Confirmer que vous avez BIEN RECU l\'argent ?\nCela transférera cette transaction dans l\'Historique et démarrera le cycle de 25 jours.')) return;
  try {
    await api('/api/fusion/' + fid + '/confirm-receipt', { method: 'POST' });
    toast('Reception confirmee ! Transaction enregistree dans l\'Historique.');
    loadFusion();
    loadDash();
  } catch (e) { toast(e.message, 'error'); }
}

async function confirmFwd(fid) {
  if (!confirm('Confirmer que votre parrain vous a transfere l\'argent ?')) return;
  try {
    await api('/api/fusion/' + fid + '/confirm-forward', { method: 'POST' });
    toast('Transfert confirme !');
    loadFusion();
  } catch (e) { toast(e.message, 'error'); }
}

async function loadProgress() {
  try {
    var d = await api('/api/fusion/my-fusions');
    var c = document.getElementById('progressList');
    var active = (d.fusions || []).filter(function(f) { return f.status === 'active' && f.receiptConfirmed; });
    if (active.length === 0) { c.innerHTML = '<div class="empty">Aucun cycle en cours</div>'; return; }
    var h = '';
    active.forEach(function(f) {
      var pct = f.progress || 0;
      var recv = f.amount * 2;
      var cur = Math.round(recv * (pct / 100));
      h += '<div class="progress-card">';
      h += '<h4>' + fmt(f.amount) + ' F -> ' + fmt(recv) + ' F</h4>';
      h += '<div class="progress-bar-lg"><div class="progress-fill" style="width:' + pct + '%">' + pct.toFixed(1) + '%</div></div>';
      h += '<p>Gain actuel: ' + fmt(cur) + ' F / ' + fmt(recv) + ' F</p>';
      h += '<p>Jours restants: ' + (f.daysRemaining || 25) + '</p>';
      h += '<p>Progression: +4% toutes les 24h</p>';
      h += '</div>';
    });
    c.innerHTML = h;
  } catch (e) { toast(e.message, 'error'); }
}

async function genCode() {
  try {
    var d = await api('/api/auth/generate-code', { method: 'POST' });
    document.getElementById('accessCode').value = d.code;
    document.getElementById('codeTimer').textContent = 'Expire dans 30s';
    toast('Code genere: ' + d.code);
    var s = 30;
    var t = setInterval(function() {
      s--;
      document.getElementById('codeTimer').textContent = 'Expire dans ' + s + 's';
      if (s <= 0) { clearInterval(t); document.getElementById('codeTimer').textContent = 'Expire'; }
    }, 1000);
  } catch (e) { toast(e.message, 'error'); }
}

async function loadReferrals() {
  try {
    var d = await api('/api/dashboard/referrals');
    var c = document.getElementById('referralsList');
    if (!d.referrals || d.referrals.length === 0) {
      c.innerHTML = '<div class="empty">Vous n\'avez aucun filleul pour le moment</div>';
      return;
    }
    var h = '';
    d.referrals.forEach(function(ref) {
      var dStr = new Date(ref.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      h += '<div class="fusion-card" style="margin-bottom:8px;">';
      h += '<strong>👤 Nom: ' + (ref.fullName || 'Filleul') + '</strong><br>';
      h += '💬 WhatsApp: ' + (ref.whatsapp || ref.phone || '-') + '<br>';
      h += '📧 Email: ' + (ref.email || '-') + '<br>';
      h += '<small style="color:#94a3b8">📅 Inscrit le : ' + dStr + '</small>';
      h += '</div>';
    });
    c.innerHTML = h;
  } catch (e) { toast(e.message, 'error'); }
}

async function saveP() {
  var d = {
    fullName: document.getElementById('pFullName').value,
    whatsapp: document.getElementById('pWhatsapp').value,
    paymentMethods: {
      orange_money: document.getElementById('pOrange').value,
      wave: document.getElementById('pWave').value,
      moov_money: document.getElementById('pMoov').value,
      mtn_money: document.getElementById('pMtn').value,
      usdt_bep20: document.getElementById('pUsdt').value
    }
  };
  try {
    await api('/api/dashboard/profile', { method: 'PUT', body: JSON.stringify(d) });
    toast('Profil sauvegarde !');
    loadDash();
  } catch (e) { toast(e.message, 'error'); }
}

async function loadDuties() {
  try {
    var d = await api('/api/fusion/my-fusions');
    var c = document.getElementById('dutiesList');
    var pending = (d.fusions || []).filter(function(f) { return !f.receiptConfirmed; });
    if (pending.length === 0) { c.innerHTML = '<div class="empty">Aucun devoir en attente</div>'; return; }
    var h = '';
    pending.forEach(function(f) {
      var isPayer = f.role === 'payer';
      h += '<div class="duty-card ' + (isPayer ? 'duty-pay' : 'duty-recv') + '">';
      h += '<strong>' + (isPayer ? 'Vous devez PAYER' : 'Vous devez RECEVOIR') + '</strong><br>';
      h += 'Montant: ' + fmt(f.amount) + ' F CFA<br>';
      h += 'Statut: ' + badge(f.status);
      h += '</div>';
    });
    c.innerHTML = h;
  } catch (e) { toast(e.message, 'error'); }
}

function logout() {
  localStorage.removeItem('tk');
  location.href = '/login';
}

loadDash();