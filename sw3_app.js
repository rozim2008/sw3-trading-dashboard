
const APP_URL = 'https://superagent-ad3740f7.base44.app';

// ===== CREDIT TRACKER =====
const DAILY_CREDIT_LIMIT = 15;
const credits = { session: 0, daily: 0 };

function incrementCredit(cost) {
  cost = cost || 1;
  credits.session += cost;
  credits.daily += cost;
  renderCreditUI();
}

function renderCreditUI() {
  const used = credits.daily;
  const pct = Math.min((used / DAILY_CREDIT_LIMIT) * 100, 100);
  const color = used >= DAILY_CREDIT_LIMIT * 0.9 ? '#ff1744' : used >= DAILY_CREDIT_LIMIT * 0.6 ? '#ff9800' : '#ffd600';
  const el = document.getElementById('credits-used');
  const bar = document.getElementById('credits-bar');
  const sub = document.getElementById('credits-sub');
  const banner = document.getElementById('banner-credits');
  if (el) { el.textContent = used.toFixed(1); el.style.color = color; }
  if (bar) { bar.style.width = pct + '%'; bar.style.background = color; }
  if (sub) sub.textContent = 'of ' + DAILY_CREDIT_LIMIT + ' daily · ' + credits.session.toFixed(1) + ' this session';
  if (banner) { banner.textContent = used.toFixed(1) + '/' + DAILY_CREDIT_LIMIT; banner.style.color = color; }
}
const ENTITY_URL = 'https://app.base44.com/api/apps/6a148c2497d9232bad3740f7/entities';
const API_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDgwOWRmMi1jYTBmLTQ3NzgtOWIwOS03ZDlkNDkxNGMxOGQiLCJjbGllbnRfaWQiOiI3ZDgwOWRmMi1jYTBmLTQ3NzgtOWIwOS03ZDlkNDkxNGMxOGQiLCJhcHBfaWQiOiI2YTE0OGMyNDk3ZDkyMzJiYWQzNzQwZjciLCJhdWQiOiJiYXNlNDRfYXBpIiwic2NvcGUiOiJhcHAuYWNjZXNzIiwiZXhwIjoxNzgwMzMxNTc0LCJpYXQiOjE3ODAzMjc5NzR9.eh_voahNGmXKhoJhNA4-TElvTe_jI7ob5U00Ihi2BBk';

// State
let state = {
  account: null,
  positions: [],
  orders: [],
  signals: [],
  watchlist: [],
  agentLogs: [],
  tradeLogs: [],
  currentSignal: null,
  orderSide: 'buy',
  portfolioChart: null,
  portfolioChartBig: null,
  analysisChart: null,
};

// Helpers
const fmt = (n, d=2) => n != null ? '$' + parseFloat(n).toLocaleString('en-US', {minimumFractionDigits:d,maximumFractionDigits:d}) : '—';
const fmtPct = (n) => n != null ? (n >= 0 ? '+' : '') + parseFloat(n).toFixed(2) + '%' : '—';
const fmtNum = (n) => n != null ? parseFloat(n).toLocaleString() : '—';
const pnlClass = (n) => parseFloat(n) >= 0 ? 'pos' : 'neg';
const signalBadge = (s) => `<span class="badge badge-${s?.toLowerCase()}">${s}</span>`;
const statusBadge = (s) => `<span class="badge badge-${s?.toLowerCase()}">${s}</span>`;

async function apiCall(fn, payload) {
  try {
    const r = await fetch(`${APP_URL}/functions/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await r.json();
    // Track credit usage: ~1 credit per function call
    incrementCredit(1);
    return result;
  } catch(e) { return { error: e.message }; }
}

function showToast(msg, type='info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function showPage(p) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
  document.getElementById('page-' + p)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(x => { if(x.textContent.trim().toLowerCase().includes(p.replace('-',' '))) x.classList.add('active'); });
  
  const titles = { overview:'Overview', portfolio:'Portfolio', signals:'AI Signals', trade:'Execute Trade', orders:'Order History', analyze:'Analyze Symbol', watchlist:'Watchlist', agents:'AI Agents', logs:'Trade Logs', risk:'Risk Settings' };
  document.getElementById('page-title').textContent = titles[p] || p;
  document.getElementById('last-update').textContent = new Date().toLocaleTimeString();

  if(p === 'portfolio') loadPortfolio();
  if(p === 'signals') loadSignals();
  if(p === 'orders') loadOrders();
  if(p === 'watchlist') loadWatchlist();
  if(p === 'agents') loadAgentLogs();
  if(p === 'logs') loadTradeLogs();
  if(p === 'trade') loadRecentOrders();
  if(p === 'risk') loadRiskSettings();
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ===== LOAD ACCOUNT =====
async function loadAccount() {
  const data = await apiCall('alpacaAccount', { action: 'get_account' });
  if(data.account) {
    state.account = data.account;
    const a = data.account;
    document.getElementById('account-num').textContent = a.account_number;
    document.getElementById('portfolio-value').textContent = fmt(a.portfolio_value);
    document.getElementById('buying-power').textContent = fmt(a.buying_power);
    
    const todayPnL = parseFloat(a.equity) - parseFloat(a.last_equity);
    const pnlPct = (todayPnL / parseFloat(a.last_equity)) * 100;
    const pnlEl = document.getElementById('daily-pnl');
    pnlEl.textContent = fmt(todayPnL);
    pnlEl.className = `stat-value ${pnlClass(todayPnL)}`;
    document.getElementById('daily-pnl-pct').textContent = fmtPct(pnlPct) + ' today';
    
    // Portfolio page
    document.getElementById('p-equity').textContent = fmt(a.equity);
    document.getElementById('p-cash').textContent = fmt(a.cash);
    document.getElementById('p-long').textContent = fmt(a.long_market_value);
    const unreal = parseFloat(a.equity) - parseFloat(a.last_equity);
    document.getElementById('p-unrealized').textContent = fmt(unreal);
    document.getElementById('p-unrealized').className = `stat-value ${pnlClass(unreal)}`;
    
    document.getElementById('portfolio-change').textContent = fmtPct(pnlPct) + ' today';
    document.getElementById('portfolio-change').className = `stat-change ${pnlClass(pnlPct)}`;
    // Update live banner balance
    const bannerBal = document.getElementById('banner-balance');
    if(bannerBal) bannerBal.textContent = fmt(a.equity);
  }
}

// ===== LOAD POSITIONS =====
async function loadPositions() {
  const data = await apiCall('alpacaAccount', { action: 'get_positions' });
  if(!data.error) {
    state.positions = data.positions || [];
    document.getElementById('positions-count').textContent = state.positions.length;
    const totalVal = state.positions.reduce((s, p) => s + parseFloat(p.market_value || 0), 0);
    document.getElementById('positions-value').textContent = fmt(totalVal) + ' market value';
    renderPositionsMini();
    renderPositionsTable();
  }
}

function renderPositionsMini() {
  const el = document.getElementById('positions-mini');
  if(!state.positions.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><p>No open positions</p></div>'; return; }
  el.innerHTML = state.positions.slice(0,5).map(p => {
    const pnl = parseFloat(p.unrealized_pl || 0);
    const pnlPct = parseFloat(p.unrealized_plpc || 0) * 100;
    return `<div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
      <div><div style="font-size:13px;font-weight:700;">${p.symbol}</div><div style="font-size:11px;color:var(--text3);">${fmtNum(p.qty)} shares @ ${fmt(p.avg_entry_price)}</div></div>
      <div style="text-align:right;"><div style="font-size:13px;font-weight:700;">${fmt(p.market_value)}</div><div class="${pnlClass(pnl)}" style="font-size:11px;">${fmt(pnl)} (${fmtPct(pnlPct)})</div></div>
    </div>`;
  }).join('');
}

function renderPositionsTable() {
  const el = document.getElementById('positions-table');
  if(!state.positions.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><p>No open positions</p></div>'; return; }
  el.innerHTML = `<table><thead><tr><th>Symbol</th><th>Qty</th><th>Avg Entry</th><th>Current Price</th><th>Market Value</th><th>Unrealized P&L</th><th>Today's P&L</th><th>Actions</th></tr></thead><tbody>` +
    state.positions.map(p => {
      const unreal = parseFloat(p.unrealized_pl || 0);
      const unrealPct = parseFloat(p.unrealized_plpc || 0) * 100;
      const todayPnl = parseFloat(p.unrealized_intraday_pl || 0);
      return `<tr>
        <td><strong>${p.symbol}</strong><br/><span class="tag">${p.asset_class}</span></td>
        <td>${fmtNum(p.qty)}</td>
        <td>${fmt(p.avg_entry_price)}</td>
        <td>${fmt(p.current_price)}</td>
        <td><strong>${fmt(p.market_value)}</strong></td>
        <td class="${pnlClass(unreal)}">${fmt(unreal)}<br/><span style="font-size:10px;">${fmtPct(unrealPct)}</span></td>
        <td class="${pnlClass(todayPnl)}">${fmt(todayPnl)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="closePosition('${p.symbol}')">Close</button></td>
      </tr>`;
    }).join('') + '</tbody></table>';
}

// ===== PORTFOLIO HISTORY / CHART =====
async function loadPortfolioChart() {
  const data = await apiCall('alpacaAccount', { action: 'get_portfolio_history', period: '1M', timeframe: '1D' });
  if(data.history && data.history.equity) {
    const hist = data.history;
    const labels = hist.timestamp.map(t => new Date(t * 1000).toLocaleDateString());
    const values = hist.equity;
    
    const createChart = (canvasId) => {
      const canvas = document.getElementById(canvasId);
      if(!canvas) return;
      const ctx = canvas.getContext('2d');
      const existing = Chart.getChart(ctx);
      if(existing) existing.destroy();
      
      const startVal = values[0];
      const colors = values.map(v => v >= startVal ? 'rgba(0,230,118,0.8)' : 'rgba(255,23,68,0.8)');
      
      return new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Portfolio Value',
            data: values,
            borderColor: values[values.length-1] >= startVal ? '#00e676' : '#ff1744',
            backgroundColor: values[values.length-1] >= startVal ? 'rgba(0,230,118,0.05)' : 'rgba(255,23,68,0.05)',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.raw) } } },
          scales: {
            x: { grid: { color: 'rgba(30,45,74,0.5)' }, ticks: { color: '#475569', maxTicksLimit: 8, font: { size: 10 } } },
            y: { grid: { color: 'rgba(30,45,74,0.5)' }, ticks: { color: '#475569', callback: (v) => '$' + (v/1000).toFixed(0) + 'k', font: { size: 10 } } }
          }
        }
      });
    };
    
    createChart('portfolioChart');
    createChart('portfolioChartBig');
  }
}

// ===== SIGNALS =====
async function loadSignals() {
  // signals loaded via fetchSignals below
  // Use entity API
  renderSignals();
  renderRecentSignals();
}

async function fetchSignals(filter='') {
  try {
    const payload = { action: 'get_signals' };
    if (filter) payload.status_filter = filter;
    const data = await apiCall('aiAgent', payload);
    return data.signals || [];
  } catch(e) { return []; }
}

// ===== SIGNAL SORT STATE =====
const signalSort = { col: 'created_date', dir: 'desc' };

function sortSignals(signals) {
  const { col, dir } = signalSort;
  return [...signals].sort((a, b) => {
    let av = a[col], bv = b[col];
    if (col === 'created_date') { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
    else if (typeof av === 'string') { av = av?.toLowerCase() || ''; bv = bv?.toLowerCase() || ''; }
    else { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0; }
    return dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });
}

function sortIcon(col) {
  if (signalSort.col !== col) return '<span style="opacity:0.3;margin-left:4px;">⇅</span>';
  return signalSort.dir === 'asc'
    ? '<span style="color:#00e676;margin-left:4px;">↑</span>'
    : '<span style="color:#00e676;margin-left:4px;">↓</span>';
}

function onSortSignals(col) {
  if (signalSort.col === col) signalSort.dir = signalSort.dir === 'asc' ? 'desc' : 'asc';
  else { signalSort.col = col; signalSort.dir = 'desc'; }
  renderSignalsTable(state.signals);
}

function renderSignalsTable(signals) {
  const el = document.getElementById('signals-table');
  if (!signals || !signals.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">🎯</div><p>No signals yet. Analyze a symbol to generate signals.</p></div>';
    return;
  }
  const sorted = sortSignals(signals);
  const thStyle = 'cursor:pointer;user-select:none;white-space:nowrap;';
  el.innerHTML = `<table><thead><tr>
    <th style="${thStyle}" onclick="onSortSignals('created_date')">Time${sortIcon('created_date')}</th>
    <th style="${thStyle}" onclick="onSortSignals('symbol')">Symbol${sortIcon('symbol')}</th>
    <th style="${thStyle}" onclick="onSortSignals('signal_type')">Signal${sortIcon('signal_type')}</th>
    <th style="${thStyle}" onclick="onSortSignals('confidence')">Confidence${sortIcon('confidence')}</th>
    <th style="${thStyle}" onclick="onSortSignals('entry_price')">Entry${sortIcon('entry_price')}</th>
    <th style="${thStyle}" onclick="onSortSignals('target_price')">Target${sortIcon('target_price')}</th>
    <th style="${thStyle}" onclick="onSortSignals('stop_loss')">Stop${sortIcon('stop_loss')}</th>
    <th style="${thStyle}" onclick="onSortSignals('risk_score')">Risk${sortIcon('risk_score')}</th>
    <th style="${thStyle}" onclick="onSortSignals('status')">Status${sortIcon('status')}</th>
    <th>Actions</th>
  </tr></thead><tbody>` +
    sorted.map(s => `<tr>
      <td style="font-size:11px;">${new Date(s.created_date).toLocaleString()}</td>
      <td><strong>${s.symbol}</strong><br/><span class="tag">${s.strategy || '—'}</span></td>
      <td>${signalBadge(s.signal_type)}</td>
      <td><div style="display:flex;align-items:center;gap:6px;"><div style="width:60px;background:var(--bg3);border-radius:3px;height:6px;overflow:hidden;"><div style="width:${s.confidence}%;background:${s.confidence>75?'#00e676':s.confidence>55?'#ffd600':'#ff1744'};height:100%;"></div></div><span>${s.confidence}%</span></div></td>
      <td>${fmt(s.entry_price)}</td>
      <td class="pos">${fmt(s.target_price)}</td>
      <td class="neg">${fmt(s.stop_loss)}</td>
      <td>${s.risk_score ? `<span style="color:${s.risk_score<30?'#00e676':s.risk_score<60?'#ffd600':'#ff1744'}">${s.risk_score}/100</span>` : '—'}</td>
      <td>${statusBadge(s.status)}</td>
      <td>
        <div class="btn-group">
          ${s.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="approveSignal('${s.id}','${s.symbol}',${s.entry_price})">✓</button><button class="btn btn-danger btn-sm" onclick="rejectSignal('${s.id}')">✗</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="showSignalDetail(${JSON.stringify(s).replace(/"/g,'&quot;')})">Detail</button>
        </div>
      </td>
    </tr>`).join('') + '</tbody></table>';
}

async function renderSignals() {
  const filter = document.getElementById('signal-filter')?.value || '';
  const signals = await fetchSignals(filter);
  state.signals = signals;
  renderSignalsTable(signals);
}

async function renderRecentSignals() {
  const signals = await fetchSignals();
  const el = document.getElementById('recent-signals-list');
  if(!signals.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">🎯</div><p>No signals yet</p></div>'; return; }
  el.innerHTML = signals.slice(0,6).map(s => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:8px;">${signalBadge(s.signal_type)}<strong>${s.symbol}</strong><span class="text-xs">${s.confidence}% conf</span></div>
      <div style="text-align:right;"><div style="font-size:12px;">${fmt(s.entry_price)}</div><div class="text-xs">${new Date(s.created_date).toLocaleDateString()}</div></div>
    </div>`).join('');
}

function filterSignals() { renderSignals(); }

async function approveSignal(id, symbol, price) {
  showToast(`Approving signal for ${symbol}...`, 'info');
  await updateSignalStatus(id, 'approved');
  showToast(`Signal for ${symbol} approved!`, 'success');
  renderSignals();
}

async function rejectSignal(id) {
  await updateSignalStatus(id, 'rejected');
  showToast('Signal rejected', 'error');
  renderSignals();
}

async function updateSignalStatus(id, status) {
  await fetch(`${APP_URL}/functions/aiAgent`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update_signal_status', signal_id: id, status })
  });
}

function showSignalDetail(s) {
  const el = document.getElementById('modal-signal-content');
  const ind = s.technical_indicators || {};
  el.innerHTML = `
    <div class="grid-2" style="margin-bottom:12px;">
      <div><div class="stat-label">Symbol</div><div style="font-size:20px;font-weight:700;">${s.symbol}</div></div>
      <div><div class="stat-label">Signal</div>${signalBadge(s.signal_type)}</div>
    </div>
    <div class="indicator-grid" style="margin-bottom:12px;">
      <div class="indicator"><div class="indicator-label">RSI</div><div class="indicator-value" style="color:${ind.rsi>70?'#ff1744':ind.rsi<30?'#00e676':'#e2e8f0'}">${ind.rsi || '—'}</div></div>
      <div class="indicator"><div class="indicator-label">MACD</div><div class="indicator-value">${ind.macd_line?.toFixed(3) || '—'}</div></div>
      <div class="indicator"><div class="indicator-label">BB %B</div><div class="indicator-value">${ind.bb_pct_b || '—'}</div></div>
      <div class="indicator"><div class="indicator-label">SMA20</div><div class="indicator-value">${fmt(ind.sma20)}</div></div>
      <div class="indicator"><div class="indicator-label">SMA50</div><div class="indicator-value">${fmt(ind.sma50)}</div></div>
      <div class="indicator"><div class="indicator-label">Volume Ratio</div><div class="indicator-value">${ind.volume_ratio || '—'}x</div></div>
    </div>
    <div class="reasoning-box">${s.reasoning || 'No reasoning available'}</div>
    <div class="divider"></div>
    <div class="grid-3" style="margin-bottom:12px;">
      <div><div class="stat-label">Entry</div><div style="font-weight:700;">${fmt(s.entry_price)}</div></div>
      <div><div class="stat-label">Target</div><div style="font-weight:700;color:var(--green);">${fmt(s.target_price)}</div></div>
      <div><div class="stat-label">Stop Loss</div><div style="font-weight:700;color:var(--red);">${fmt(s.stop_loss)}</div></div>
    </div>
  `;
  openModal('modal-signal');
}

// ===== ORDERS =====
async function loadOrders() {
  const filter = document.getElementById('orders-filter')?.value || 'all';
  const data = await apiCall('alpacaAccount', { action: 'get_orders', status: filter, limit: 50 });
  const el = document.getElementById('orders-table');
  const orders = data.orders || [];
  if(!orders.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><p>No orders found</p></div>'; return; }
  el.innerHTML = `<table><thead><tr><th>Time</th><th>Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Price</th><th>Filled Avg</th><th>Status</th><th>Actions</th></tr></thead><tbody>` +
    orders.map(o => `<tr>
      <td style="font-size:11px;">${new Date(o.created_at).toLocaleString()}</td>
      <td><strong>${o.symbol}</strong></td>
      <td>${signalBadge(o.side?.toUpperCase())}</td>
      <td><span class="tag">${o.type}</span></td>
      <td>${o.qty || o.notional || '—'}</td>
      <td>${o.limit_price ? fmt(o.limit_price) : 'Market'}</td>
      <td>${o.filled_avg_price ? fmt(o.filled_avg_price) : '—'}</td>
      <td>${statusBadge(o.status)}</td>
      <td>${['new','accepted','pending_new'].includes(o.status) ? `<button class="btn btn-danger btn-sm" onclick="cancelOrder('${o.id}')">Cancel</button>` : '—'}</td>
    </tr>`).join('') + '</tbody></table>';
}

async function loadRecentOrders() {
  const data = await apiCall('alpacaAccount', { action: 'get_orders', status: 'all', limit: 5 });
  const el = document.getElementById('recent-orders-mini');
  const orders = data.orders || [];
  if(!orders.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><p>No recent orders</p></div>'; return; }
  el.innerHTML = orders.map(o => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
      <div>${signalBadge(o.side?.toUpperCase())} <strong>${o.symbol}</strong> <span class="text-xs">${o.qty} shares</span></div>
      <div>${statusBadge(o.status)}</div>
    </div>`).join('');
}

async function cancelOrder(id) {
  const data = await apiCall('alpacaAccount', { action: 'cancel_order', order_id: id });
  if(data.success) { showToast('Order cancelled', 'success'); loadOrders(); }
  else showToast('Failed to cancel: ' + JSON.stringify(data.error), 'error');
}

async function cancelAllOrders() {
  if(!confirm('Cancel all open orders?')) return;
  const data = await apiCall('alpacaTrade', { action: 'cancel_all_orders' });
  showToast('All open orders cancelled', 'success');
  loadOrders();
}

// ===== PLACE ORDER =====
let orderSide = 'buy';
function setOrderSide(side) {
  orderSide = side;
  document.getElementById('tab-buy').classList.toggle('active', side === 'buy');
  document.getElementById('tab-sell').classList.toggle('active', side === 'sell');
  const btn = document.getElementById('place-order-btn');
  btn.textContent = side === 'buy' ? '✅ Place Buy Order' : '🔴 Place Sell Order';
  btn.className = 'btn ' + (side === 'buy' ? 'btn-success' : 'btn-danger');
}

function updateOrderForm() {
  const type = document.getElementById('order-type').value;
  document.getElementById('limit-price-group').style.display = ['limit','stop_limit'].includes(type) ? 'flex' : 'none';
  document.getElementById('stop-price-group').style.display = ['stop','stop_limit'].includes(type) ? 'flex' : 'none';
}

async function placeOrder() {
  const symbol = document.getElementById('order-symbol').value.toUpperCase().trim();
  const qty = document.getElementById('order-qty').value;
  const type = document.getElementById('order-type').value;
  const tif = document.getElementById('order-tif').value;
  const limitPrice = document.getElementById('order-limit-price').value;
  const stopPrice = document.getElementById('order-stop-price').value;
  const strategy = document.getElementById('order-strategy').value || 'manual';
  const notes = document.getElementById('order-notes').value;
  
  if(!symbol || !qty) { showToast('Symbol and quantity required', 'error'); return; }
  
  showToast(`Placing ${orderSide.toUpperCase()} order for ${qty} ${symbol}...`, 'info');
  
  const payload = { action: 'place_order', symbol, qty: parseFloat(qty), side: orderSide, type, time_in_force: tif, strategy, reasoning: notes };
  if(limitPrice) payload.limit_price = parseFloat(limitPrice);
  if(stopPrice) payload.stop_price = parseFloat(stopPrice);
  
  const data = await apiCall('alpacaTrade', payload);
  if(data.order) {
    showToast(`✅ Order placed! ID: ${data.order.id?.substring(0,8)}`, 'success');
    loadRecentOrders();
  } else {
    showToast('Order failed: ' + JSON.stringify(data.error), 'error');
  }
}

// ===== QUOTE =====
async function getQuote() {
  const symbol = document.getElementById('quote-symbol').value.toUpperCase().trim();
  if(!symbol) return;
  const el = document.getElementById('quote-display');
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const data = await apiCall('aiAgent', { action: 'market_intelligence', symbol });
  if(data.current_price) {
    const trendColor = { uptrend: 'var(--green)', downtrend: 'var(--red)', sideways: 'var(--yellow)' }[data.trend] || 'var(--text2)';
    el.innerHTML = `
      <div style="font-size:28px;font-weight:900;margin-bottom:8px;">${fmt(data.current_price)}</div>
      <div style="display:flex;gap:16px;margin-bottom:12px;">
        <div><span class="text-xs">1W</span> <span class="${pnlClass(data.week_change_pct)}">${fmtPct(data.week_change_pct)}</span></div>
        <div><span class="text-xs">1M</span> <span class="${pnlClass(data.month_change_pct)}">${fmtPct(data.month_change_pct)}</span></div>
        <div><span class="text-xs">Volatility</span> <span>${data.volatility_annualized?.toFixed(1)}%</span></div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <span style="color:${trendColor};font-weight:700;text-transform:uppercase;">▲ ${data.trend}</span>
        <span class="tag">RSI ${data.rsi}</span>
        <span class="tag">SMA20 ${fmt(data.sma20)}</span>
      </div>
    `;
    document.getElementById('order-symbol').value = symbol;
  } else {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><p>${data.error || 'Could not load quote'}</p></div>`;
  }
}

// ===== ANALYZE =====
let currentAnalysis = null;
let currentSignalId = null;

async function analyzeSymbol() {
  const symbol = document.getElementById('analyze-symbol').value.toUpperCase().trim();
  if(!symbol) { showToast('Enter a symbol', 'error'); return; }
  
  const resultEl = document.getElementById('analysis-result');
  const scanEl = document.getElementById('scan-results');
  scanEl.style.display = 'none';
  resultEl.style.display = 'none';
  
  showToast(`Analyzing ${symbol} with AI agent...`, 'info');
  
  const data = await apiCall('aiAgent', { action: 'analyze_symbol', symbol });
  if(data.error) { showToast('Analysis failed: ' + data.error, 'error'); return; }
  
  currentAnalysis = data.analysis;
  currentSignalId = data.signal_id;
  
  // Signal Summary
  const a = data.analysis;
  const ind = a.technical_indicators || {};
  const trendIcon = a.signal_type === 'BUY' ? '🟢' : a.signal_type === 'sell' ? '🔴' : '🟡';
  
  document.getElementById('signal-summary').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      <div style="font-size:32px;font-weight:900;">${a.symbol}</div>
      <div>${signalBadge(a.signal_type)}</div>
      <div class="tag">${a.confidence}% confidence</div>
    </div>
    <div class="grid-3" style="margin-bottom:12px;">
      <div><div class="stat-label">Entry Price</div><div style="font-size:18px;font-weight:700;">${fmt(a.entry_price)}</div></div>
      <div><div class="stat-label">Target</div><div style="font-size:18px;font-weight:700;color:var(--green);">${fmt(a.target_price)}</div></div>
      <div><div class="stat-label">Stop Loss</div><div style="font-size:18px;font-weight:700;color:var(--red);">${fmt(a.stop_loss)}</div></div>
    </div>
    <div><div class="stat-label">Risk Score</div>
      <div style="height:8px;background:var(--bg3);border-radius:4px;margin-top:4px;overflow:hidden;">
        <div style="width:${a.risk_score}%;background:${a.risk_score<30?'#00e676':a.risk_score<60?'#ffd600':'#ff1744'};height:100%;"></div>
      </div>
      <div class="text-xs" style="margin-top:4px;">${a.risk_score}/100 — ${a.risk_score<30?'Low Risk':a.risk_score<60?'Medium Risk':'High Risk'}</div>
    </div>
    <div class="mt16"><div class="stat-label">Bars Analyzed</div><div class="text-xs">${data.bars_analyzed} daily candles</div></div>
  `;
  
  document.getElementById('signal-reasoning').textContent = a.reasoning || 'No reasoning available';
  
  // Indicators
  document.getElementById('indicators-grid').innerHTML = [
    { label: 'RSI (14)', value: ind.rsi, unit: '', color: ind.rsi > 70 ? 'var(--red)' : ind.rsi < 30 ? 'var(--green)' : 'var(--text)', sub: ind.rsi > 70 ? 'Overbought' : ind.rsi < 30 ? 'Oversold' : 'Neutral' },
    { label: 'MACD', value: ind.macd_line?.toFixed(3), unit: '', color: ind.macd_line > ind.macd_signal ? 'var(--green)' : 'var(--red)', sub: ind.macd_histogram > 0 ? 'Bullish' : 'Bearish' },
    { label: 'BB %B', value: ind.bb_pct_b, unit: '', color: ind.bb_pct_b > 0.9 ? 'var(--red)' : ind.bb_pct_b < 0.1 ? 'var(--green)' : 'var(--text)', sub: `Upper: ${fmt(ind.bb_upper)}` },
    { label: 'SMA 20', value: fmt(ind.sma20), unit: '', color: 'var(--text)', sub: a.entry_price > ind.sma20 ? '▲ Price above' : '▼ Price below' },
    { label: 'SMA 50', value: fmt(ind.sma50), unit: '', color: 'var(--text)', sub: a.entry_price > ind.sma50 ? '▲ Price above' : '▼ Price below' },
    { label: 'VWAP', value: fmt(ind.vwap), unit: '', color: 'var(--text)', sub: a.entry_price > ind.vwap ? '▲ Above VWAP' : '▼ Below VWAP' },
    { label: 'Volume Ratio', value: ind.volume_ratio + 'x', unit: '', color: ind.volume_ratio > 1.5 ? 'var(--green)' : 'var(--text)', sub: ind.volume_ratio > 1.5 ? 'High volume' : 'Normal volume' },
    { label: 'Pattern', value: ind.candle_pattern?.replace(/_/g,' '), unit: '', color: ['hammer','bullish_engulfing','strong_bullish'].includes(ind.candle_pattern) ? 'var(--green)' : ['shooting_star','bearish_engulfing','strong_bearish'].includes(ind.candle_pattern) ? 'var(--red)' : 'var(--text)', sub: ''},
    { label: 'ATR', value: fmt(ind.atr), unit: '', color: 'var(--text)', sub: 'Avg True Range' },
  ].map(i => `<div class="indicator"><div class="indicator-label">${i.label}</div><div class="indicator-value" style="color:${i.color};font-size:15px;">${i.value}</div>${i.sub ? `<div class="indicator-sub">${i.sub}</div>` : ''}</div>`).join('');
  
  // Load chart data
  await loadAnalysisChart(a.symbol);
  
  document.getElementById('approve-signal-btn').style.display = a.signal_type !== 'HOLD' ? 'inline-block' : 'none';
  resultEl.style.display = 'block';
}

async function loadAnalysisChart(symbol) {
  const data = await apiCall('alpacaAccount', { action: 'get_bars', symbol, timeframe: '1Day', limit: 60 });
  const bars = data.bars?.bars || [];
  if(!bars.length) return;
  
  const ctx = document.getElementById('analysisChart').getContext('2d');
  const existing = Chart.getChart(ctx);
  if(existing) existing.destroy();
  
  const labels = bars.map(b => new Date(b.t).toLocaleDateString());
  const closes = bars.map(b => b.c);
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: symbol,
        data: closes,
        borderColor: '#00d4ff',
        backgroundColor: 'rgba(0,212,255,0.05)',
        borderWidth: 2,
        fill: true,
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.raw) } } },
      scales: {
        x: { grid: { color: 'rgba(30,45,74,0.5)' }, ticks: { color: '#475569', maxTicksLimit: 10, font: { size: 10 } } },
        y: { grid: { color: 'rgba(30,45,74,0.5)' }, ticks: { color: '#475569', callback: (v) => fmt(v), font: { size: 10 } } }
      }
    }
  });
}

async function approveCurrentSignal() {
  if(!currentAnalysis) return;
  if(currentSignalId) await updateSignalStatus(currentSignalId, 'approved');
  showToast(`Signal for ${currentAnalysis.symbol} approved! You can now execute the trade.`, 'success');
  document.getElementById('order-symbol').value = currentAnalysis.symbol;
  document.getElementById('order-qty').value = '10';
  setOrderSide(currentAnalysis.signal_type === 'BUY' ? 'buy' : 'sell');
  showPage('trade');
}

async function rejectCurrentSignal() {
  if(currentSignalId) await updateSignalStatus(currentSignalId, 'rejected');
  showToast('Signal rejected', 'error');
  document.getElementById('analysis-result').style.display = 'none';
}

async function scanWatchlist() {
  showToast('Scanning watchlist...', 'info');
  const symbols = state.watchlist.filter(w => w.active).map(w => w.symbol);
  if(!symbols.length) { showToast('Add symbols to watchlist first', 'error'); return; }
  
  const data = await apiCall('aiAgent', { action: 'scan_watchlist', symbols });
  const scanEl = document.getElementById('scan-results');
  const analysisEl = document.getElementById('analysis-result');
  analysisEl.style.display = 'none';
  
  if(data.results) {
    document.getElementById('scan-table').innerHTML = `<table><thead><tr><th>Symbol</th><th>Signal</th><th>Confidence</th><th>Entry</th><th>Target</th><th>Stop</th><th>RSI</th><th>Trend</th><th>Action</th></tr></thead><tbody>` +
      data.results.map(r => r.error ? `<tr><td>${r.symbol}</td><td colspan="8" style="color:var(--red);">${r.error}</td></tr>` : `<tr>
        <td><strong>${r.symbol}</strong></td>
        <td>${signalBadge(r.signal_type)}</td>
        <td>${r.confidence}%</td>
        <td>${fmt(r.entry_price)}</td>
        <td class="pos">${fmt(r.target_price)}</td>
        <td class="neg">${fmt(r.stop_loss)}</td>
        <td style="color:${r.technical_indicators?.rsi>70?'#ff1744':r.technical_indicators?.rsi<30?'#00e676':'#e2e8f0'}">${r.technical_indicators?.rsi}</td>
        <td><span class="tag">${r.technical_indicators?.price_change_pct > 0 ? '▲' : '▼'} ${r.technical_indicators?.price_change_pct?.toFixed(2)}%</span></td>
        <td><button class="btn btn-ghost btn-sm" onclick="document.getElementById('analyze-symbol').value='${r.symbol}';analyzeSymbol()">Detail</button></td>
      </tr>`).join('') + '</tbody></table>';
    scanEl.style.display = 'block';
    showToast(`Scanned ${data.scanned} symbols`, 'success');
  }
}

// ===== WATCHLIST =====
async function loadWatchlist() {
  try {
    const data = await apiCall('aiAgent', { action: 'get_watchlist' });
    state.watchlist = data.watchlist || [];
  } catch(e) { state.watchlist = []; }
  renderWatchlist();
  renderWatchlistMini();
}

function renderWatchlist() {
  const el = document.getElementById('watchlist-table');
  if(!state.watchlist.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">👁</div><p>No symbols in watchlist. Add some to get started.</p></div>'; return; }
  el.innerHTML = `<table><thead><tr><th>Symbol</th><th>Name</th><th>Asset Class</th><th>Sector</th><th>Priority</th><th>Active</th><th>Notes</th><th>Actions</th></tr></thead><tbody>` +
    state.watchlist.map(w => `<tr>
      <td><strong>${w.symbol}</strong></td>
      <td>${w.name || '—'}</td>
      <td><span class="tag">${w.asset_class || 'stock'}</span></td>
      <td>${w.sector || '—'}</td>
      <td class="priority-${w.priority}">${w.priority || '—'}</td>
      <td>${w.active ? '✅' : '⬜'}</td>
      <td style="font-size:11px;color:var(--text2);">${w.notes || '—'}</td>
      <td><div class="btn-group">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('analyze-symbol').value='${w.symbol}';showPage('analyze');analyzeSymbol()">Analyze</button>
        <button class="btn btn-danger btn-sm" onclick="removeFromWatchlist('${w.id}')">✕</button>
      </div></td>
    </tr>`).join('') + '</tbody></table>';
}

function renderWatchlistMini() {
  const el = document.getElementById('watchlist-mini');
  if(!state.watchlist.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">👁</div><p>No watchlist symbols</p></div>'; return; }
  el.innerHTML = state.watchlist.slice(0,6).map(w => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
      <div><span class="priority-${w.priority}">●</span> <strong style="font-size:13px;">${w.symbol}</strong> <span class="tag">${w.asset_class || 'stock'}</span></div>
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('analyze-symbol').value='${w.symbol}';showPage('analyze');analyzeSymbol()" style="font-size:10px;padding:3px 6px;">Analyze</button>
    </div>`).join('');
}

function openAddWatchlistModal() { openModal('modal-watchlist'); }

async function addToWatchlist() {
  const symbol = document.getElementById('wl-symbol').value.toUpperCase().trim();
  const name = document.getElementById('wl-name').value.trim();
  const asset_class = document.getElementById('wl-asset').value;
  const sector = document.getElementById('wl-sector').value.trim();
  const priority = document.getElementById('wl-priority').value;
  const notes = document.getElementById('wl-notes').value.trim();
  if(!symbol) { showToast('Symbol required', 'error'); return; }
  
  await apiCall('aiAgent', { action: 'add_watchlist', symbol, name, asset_class, sector, notes });
  
  showToast(`${symbol} added to watchlist`, 'success');
  closeModal('modal-watchlist');
  loadWatchlist();
}

async function removeFromWatchlist(id) {
  await apiCall('aiAgent', { action: 'delete_watchlist', item_id: id });
  showToast('Removed from watchlist', 'success');
  loadWatchlist();
}

async function closePosition(symbol) {
  if(!confirm(`Close ${symbol} position?`)) return;
  const data = await apiCall('alpacaTrade', { action: 'close_position', symbol });
  if(data.order) { showToast(`${symbol} position closed!`, 'success'); loadPositions(); }
  else showToast('Failed: ' + JSON.stringify(data.error), 'error');
}

async function closeAllPositions() {
  if(!confirm('Close ALL positions?')) return;
  const data = await apiCall('alpacaTrade', { action: 'close_all_positions' });
  showToast('All positions closed', 'success');
  loadPositions();
}

// ===== AGENTS =====
const AGENTS = [
  { name: 'MarketIntelligence', icon: '🌐', desc: 'Market conditions & macro', color: '#00d4ff' },
  { name: 'TechnicalAnalysis', icon: '📈', desc: 'RSI, MACD, BB, VWAP', color: '#00e676' },
  { name: 'QuantStrategy', icon: '🧮', desc: 'Statistical strategies', color: '#7c3aed' },
  { name: 'OptionsStrategy', icon: '🎯', desc: 'Options flow & Greeks', color: '#ff6d00' },
  { name: 'RiskManagement', icon: '🛡', desc: 'Position sizing & limits', color: '#ff1744' },
  { name: 'TradeExecution', icon: '⚡', desc: 'Smart order routing', color: '#ffd600' },
  { name: 'PortfolioManager', icon: '💼', desc: 'Allocation & hedging', color: '#00bfa5' },
  { name: 'LearningOptimizer', icon: '🧠', desc: 'Reinforcement learning', color: '#ec4899' },
];

function renderAgentsMini() {
  const el = document.getElementById('agents-mini');
  el.innerHTML = AGENTS.slice(0,4).map(a => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:16px;">${a.icon}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.name}</div>
        <div style="height:3px;background:var(--bg3);border-radius:2px;margin-top:4px;"><div style="width:${Math.random()*40+40}%;background:${a.color};height:100%;border-radius:2px;"></div></div>
      </div>
      <span style="font-size:10px;color:var(--green);">●</span>
    </div>`).join('');
}

function renderAgentsGrid() {
  const el = document.getElementById('agents-grid');
  el.innerHTML = AGENTS.map(a => `
    <div class="agent-card">
      <div style="font-size:24px;margin-bottom:8px;">${a.icon}</div>
      <div class="agent-name" style="color:${a.color};">${a.name}</div>
      <div class="agent-status">${a.desc}</div>
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:6px;">
        <div style="width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 4px var(--green);"></div>
        <span style="font-size:10px;color:var(--text2);">Standby</span>
      </div>
      <div class="agent-bar"><div class="agent-bar-fill" style="width:${Math.floor(Math.random()*30+50)}%;background:${a.color};"></div></div>
    </div>`).join('');
}

async function loadAgentLogs() {
  try {
    const data = await apiCall('aiAgent', { action: 'get_agent_logs' });
    state.agentLogs = data.logs || [];
  } catch(e) { state.agentLogs = []; }
  renderAgentsGrid();
  
  const el = document.getElementById('agent-logs-table');
  if(!state.agentLogs.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">🤖</div><p>No agent activity yet. Run an analysis to see logs.</p></div>'; return; }
  el.innerHTML = `<table><thead><tr><th>Time</th><th>Agent</th><th>Action</th><th>Symbol</th><th>Confidence</th><th>Duration</th><th>Status</th><th>Reasoning</th></tr></thead><tbody>` +
    state.agentLogs.map(l => `<tr>
      <td style="font-size:11px;">${new Date(l.created_date).toLocaleString()}</td>
      <td><span style="font-size:11px;font-weight:600;">${l.agent_name || '—'}</span></td>
      <td><span class="tag">${l.action || '—'}</span></td>
      <td><strong>${l.symbol || '—'}</strong></td>
      <td>${l.confidence ? l.confidence + '%' : '—'}</td>
      <td>${l.duration_ms ? l.duration_ms + 'ms' : '—'}</td>
      <td>${statusBadge(l.status || 'success')}</td>
      <td style="font-size:11px;color:var(--text2);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${l.reasoning || ''}">${l.reasoning || '—'}</td>
    </tr>`).join('') + '</tbody></table>';
}

// ===== TRADE LOGS =====
async function loadTradeLogs() {
  try {
    const data = await apiCall('aiAgent', { action: 'get_trade_logs' });
    state.tradeLogs = data.trades || [];
  } catch(e) { state.tradeLogs = []; }
  
  const el = document.getElementById('trade-logs-table');
  if(!state.tradeLogs.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">📝</div><p>No trades executed yet. Place your first paper trade to see logs here.</p></div>'; return; }
  el.innerHTML = `<table><thead><tr><th>Time</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Type</th><th>Price</th><th>Filled At</th><th>P&L</th><th>Status</th><th>Broker ID</th></tr></thead><tbody>` +
    state.tradeLogs.map(t => `<tr>
      <td style="font-size:11px;">${new Date(t.created_date).toLocaleString()}</td>
      <td><strong>${t.symbol || '—'}</strong></td>
      <td>${signalBadge(t.side?.toUpperCase())}</td>
      <td>${t.quantity || '—'}</td>
      <td><span class="tag">${t.order_type || '—'}</span></td>
      <td>${fmt(t.price_submitted)}</td>
      <td>${t.price_filled ? fmt(t.price_filled) : '—'}</td>
      <td class="${pnlClass(t.pnl || 0)}">${t.pnl ? fmt(t.pnl) : '—'}</td>
      <td>${statusBadge(t.status)}</td>
      <td style="font-size:10px;color:var(--text3);">${t.broker_order_id?.substring(0,8) || '—'}</td>
    </tr>`).join('') + '</tbody></table>';
}

// ===== RISK SETTINGS =====
async function loadRiskSettings() {
  try {
    const data = await apiCall('aiAgent', { action: 'get_risk_settings' });
    const s = data.settings;
    if(s) {
      document.getElementById('rs-max-daily-loss').value = s.max_daily_loss_pct || 3;
      document.getElementById('rs-max-position').value = s.max_position_size_pct || 10;
      document.getElementById('rs-max-exposure').value = s.max_portfolio_exposure_pct || 80;
      document.getElementById('rs-max-drawdown').value = s.max_drawdown_pct || 15;
      document.getElementById('rs-max-trades').value = s.max_trades_per_day || 10;
      document.getElementById('rs-stop-loss').value = s.stop_loss_pct || 2;
      document.getElementById('rs-trailing-stop').value = s.trailing_stop_pct || 1.5;
      document.getElementById('rs-min-confidence').value = s.min_confidence_threshold || 65;
      document.getElementById('rs-mode').value = s.automation_mode || 'human_approval';
      document.getElementById('rs-paper').checked = s.paper_mode !== false;
      document.getElementById('rs-kill').checked = s.kill_switch || false;
    }
  } catch(e) {}
}

async function saveRiskSettings() {
  const payload = {
    max_daily_loss_pct: parseFloat(document.getElementById('rs-max-daily-loss').value),
    max_position_size_pct: parseFloat(document.getElementById('rs-max-position').value),
    max_portfolio_exposure_pct: parseFloat(document.getElementById('rs-max-exposure').value),
    max_drawdown_pct: parseFloat(document.getElementById('rs-max-drawdown').value),
    max_trades_per_day: parseInt(document.getElementById('rs-max-trades').value),
    stop_loss_pct: parseFloat(document.getElementById('rs-stop-loss').value),
    trailing_stop_pct: parseFloat(document.getElementById('rs-trailing-stop').value),
    min_confidence_threshold: parseFloat(document.getElementById('rs-min-confidence').value),
    automation_mode: document.getElementById('rs-mode').value,
    paper_mode: document.getElementById('rs-paper').checked,
    kill_switch: document.getElementById('rs-kill').checked,
    active: true,
    allowed_asset_classes: ['stock', document.getElementById('ac-etf').checked ? 'etf' : null, document.getElementById('ac-option').checked ? 'option' : null].filter(Boolean),
  };
  
  try {
    const existing = await apiCall('aiAgent', { action: 'get_risk_settings' });
    await apiCall('aiAgent', {
      action: 'save_risk_settings',
      settings_id: existing.settings?.id || null,
      settings_data: payload,
    });
    showToast('Risk settings saved!', 'success');
  } catch(e) { showToast('Failed to save: ' + e.message, 'error'); }
}

// ===== KILL SWITCH =====
async function killSwitch() {
  if(!confirm('⚠️ EMERGENCY STOP: This will cancel ALL open orders and close ALL positions. Are you sure?')) return;
  showToast('🚨 Kill switch activated!', 'error');
  await apiCall('alpacaTrade', { action: 'cancel_all_orders' });
  await apiCall('alpacaTrade', { action: 'close_all_positions' });
  showToast('All orders cancelled and positions closed', 'success');
  refreshAll();
}

// ===== PORTFOLIO PAGE =====
async function loadPortfolio() {
  await Promise.all([loadAccount(), loadPositions(), loadPortfolioChart()]);
}

// ===== REFRESH =====
async function refreshAll() {
  document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
  await Promise.all([loadAccount(), loadPositions(), loadPortfolioChart()]);
  renderAgentsMini();
  await renderRecentSignals();
  await loadWatchlist();
  showToast('Dashboard refreshed', 'info');
}

// ===== INIT =====
async function init() {
  // Show dashboard first so the page isn't blank
  showPage('overview');

  // Load data
  await loadWatchlist();
  await loadAccount();
  await loadPositions();
  renderAgentsMini();
  await loadPortfolioChart();
  await renderRecentSignals();
  
  // Auto-refresh every 60s
  setInterval(async () => {
    await loadAccount();
    await loadPositions();
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
  }, 60000);
}

init();
