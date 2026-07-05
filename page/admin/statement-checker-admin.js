const ADMIN_FIELDS = [
  { key: 'name',  label: 'Name',       required: true, guess: ['Name'] },
  { key: 'tsiwp', label: 'TSIWP Code', required: true, guess: ['TSIWP Code'] },
  { key: 'HLMT',           label: 'HLMT IFAR Code',    required: false, guess: ['HLMT IFAR Code'] },
  { key: 'GE',             label: 'GE IFAR Code',      required: false, guess: ['GE IFAR Code'] },
  { key: 'AIA',            label: 'AIA IFAR Code',     required: false, guess: ['AIA IFAR Code'] },
  { key: 'PruBSN',         label: 'PruBSN IFAR Code',  required: false, guess: ['PruBSN IFAR Code'] },
  { key: 'PruBSN-EB',      label: 'PruBSN-EB',         required: false, guess: ['PruBSN-EB'] },
  { key: 'Zurich',         label: 'Zurich IFAR Code',  required: false, guess: ['Zurich IFAR Code'] },
  { key: 'Etiqa',          label: 'Etiqa Takaful Code',required: false, guess: ['Etiqa Takaful Code'] },
  { key: 'Takaful Ikhlas', label: 'Takaful Ikhlas Code',required: false, guess: ['Takaful Ikhlas Code'] },
];

const COL_LABELS = {
  'HLMT': 'HLMT IFAR Code', 'GE': 'GE IFAR Code', 'AIA': 'AIA IFAR Code',
  'PruBSN': 'PruBSN IFAR Code', 'PruBSN-EB': 'PruBSN-EB', 'Zurich': 'Zurich IFAR Code',
  'Etiqa': 'Etiqa Takaful Code', 'Takaful Ikhlas': 'Takaful Ikhlas Code',
};

const adminState = {
  headerRowIdx: -1,
  headers: [],
  dataRows: [],
  mapping: {},
  stagedIFARData: null,
  opStats: {},
  tsiwpStats: { uniqueNames: 0, totalCodes: 0 },
  parsedAgents: [],
};

function toggleAdmin() {
  const overlay = document.getElementById('admin-overlay');
  overlay.classList.toggle('open');
  if (overlay.classList.contains('open')) renderIFARStats();
}

function closeAdminIfOutside(e) {
  if (e.target === document.getElementById('admin-overlay')) toggleAdmin();
}

// Honest per-operator agent count: distinct TSIWP codes in the live lookup.
// (TSIWP code is the stable agent identifier; the O→0/uppercase/numeric
// variants stored alongside each real code all point to the same TSIWP,
// so counting distinct TSIWP values ignores those generated duplicates.)
function renderIFARStats() {
  const ops = Object.keys(IFAR_LOOKUP_DATA);
  const statsEl = document.getElementById('ifar-stats');
  const colors = ['#1F3864','#2d4f8a','#3d6bc4','#1a9e5c','#c07a10','#d63b3b','#6b4fbb','#0f6e56'];
  statsEl.innerHTML = ops.map((op, i) => {
    const uniqueAgents = new Set(Object.values(IFAR_LOOKUP_DATA[op]).map(v => v.tsiwp)).size;
    return `<div class="ifar-stat">
      <div class="sv" style="color:${colors[i % colors.length]}">${uniqueAgents}</div>
      <div class="sl">${op}</div>
    </div>`;
  }).join('');
}

function adminLog(msg, type = 'ok') {
  const log = document.getElementById('admin-log');
  document.getElementById('admin-log-section').style.display = 'block';
  const line = document.createElement('div');
  line.className = 'log-' + type;
  line.textContent = '› ' + msg;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function adminGoToPhase(n) {
  document.querySelectorAll('.admin-phase').forEach((el, i) => el.classList.toggle('active', i === n));
  document.querySelectorAll('.admin-step-dot').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i < n) el.classList.add('done');
    if (i === n) el.classList.add('active');
  });
}

// ── Phase 0 → 1: Upload & parse raw sheet ───────────────────────────────
function handleAdminUpload(input) {
  const file = input.files[0];
  if (!file) return;

  document.getElementById('admin-log-section').style.display = 'block';
  document.getElementById('admin-log').innerHTML = '';
  document.getElementById('admin-save-confirm').style.display = 'none';
  adminState.stagedIFARData = null;

  adminLog(`Reading: ${file.name}`);

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      adminLog(`Sheets found: ${wb.SheetNames.join(', ')}`);

      if (!wb.SheetNames.includes('Master List')) {
        adminLog('ERROR: "Master List" sheet not found!', 'err');
        return;
      }

      const ws = wb.Sheets['Master List'];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(raw.length, 10); i++) {
        const rowStr = raw[i].join('|');
        if (rowStr.includes('Name') && rowStr.includes('TSIWP')) { headerRowIdx = i; break; }
      }
      if (headerRowIdx < 0) {
        adminLog('ERROR: Could not find header row (needs "Name" and "TSIWP" columns)', 'err');
        return;
      }

      const headers = raw[headerRowIdx].map(h => String(h).replace(/\n|\r/g, ' ').replace(/\s+/g, ' ').trim());
      const dataRows = raw.slice(headerRowIdx + 1).filter(r => r.some(c => String(c).trim()));

      adminState.headerRowIdx = headerRowIdx;
      adminState.headers = headers;
      adminState.dataRows = dataRows;
      adminState.mapping = {};

      adminLog(`Header row found at row ${headerRowIdx + 1}`);
      adminLog(`Data rows: ${dataRows.length}`);
      adminLog('✓ File parsed — review raw preview', 'ok');

      renderAdminRawPreview();
      adminGoToPhase(1);
    } catch(err) {
      adminLog('ERROR: ' + err.message, 'err');
    }
  };
  reader.readAsArrayBuffer(file);
}

function renderAdminRawPreview() {
  document.getElementById('admin-header-row-num').textContent = adminState.headerRowIdx + 1;
  const headers = adminState.headers;
  const preview = adminState.dataRows.slice(0, 15);
  const table = document.getElementById('admin-raw-preview-table');
  table.innerHTML = `
    <thead><tr><th style="width:36px;text-align:center">#</th>${headers.map(h => `<th>${h || '&nbsp;'}</th>`).join('')}</tr></thead>
    <tbody>${preview.map((row, idx) => `
      <tr>
        <td style="text-align:center;font-family:'DM Mono',monospace;color:var(--muted);font-size:11px">${idx+1}</td>
        ${headers.map((_, i) => `<td>${row[i] !== undefined ? row[i] : ''}</td>`).join('')}
      </tr>`).join('')}
    </tbody>`;
}

// ── Phase 1 → 2: Column check / mapping ─────────────────────────────────
function buildAdminColumnCheck() {
  const headers = adminState.headers;
  const tbody = document.getElementById('admin-mapping-tbody');
  tbody.innerHTML = ADMIN_FIELDS.map(f => {
    const auto = headers.find(h => f.guess.some(g => g.toLowerCase() === h.toLowerCase())) || '';
    adminState.mapping[f.key] = auto;
    const safeId = 'admin-map-' + f.key.replace(/[^a-zA-Z0-9]/g, '_');
    return `
      <tr>
        <td><strong>${f.label}</strong>${f.required ? '<span class="required-dot"></span>' : ''}</td>
        <td>
          <select id="${safeId}" onchange="adminState.mapping['${f.key}']=this.value">
            <option value="">— Not in this file —</option>
            ${headers.map(h => `<option value="${h}" ${h === auto ? 'selected' : ''}>${h}</option>`).join('')}
          </select>
        </td>
      </tr>`;
  }).join('');
  adminGoToPhase(2);
}

// ── Phase 2 → 3: Parse using confirmed mapping, compute summary ─────────
function buildAdminSummary() {
  const m = adminState.mapping;
  if (!m.name)  { alert('Please map the "Name" column before continuing.'); return; }
  if (!m.tsiwp) { alert('Please map the "TSIWP Code" column before continuing.'); return; }

  const headers  = adminState.headers;
  const dataRows = adminState.dataRows;
  const nameIdx  = headers.indexOf(m.name);
  const tsiwpIdx = headers.indexOf(m.tsiwp);

  // TSIWP / Name card
  const tsiwpNames = new Set();
  let tsiwpTotal = 0;
  for (const row of dataRows) {
    const name  = String(row[nameIdx] || '').trim();
    const tsiwp = String(row[tsiwpIdx] || '').trim();
    if (!tsiwp || tsiwp === 'nan') continue;
    tsiwpTotal++;
    if (name) tsiwpNames.add(name);
  }
  adminState.tsiwpStats = { uniqueNames: tsiwpNames.size, totalCodes: tsiwpTotal };

  // Per-agent rows, for the parsed-data preview table
  const parsedAgents = [];
  for (const row of dataRows) {
    const name  = String(row[nameIdx] || '').trim();
    const tsiwp = String(row[tsiwpIdx] || '').trim();
    if (!name && !tsiwp) continue;
    const codes = {};
    for (const op of OPERATOR_KEYS) {
      const colName = m[op];
      const colIdx = colName ? headers.indexOf(colName) : -1;
      codes[op] = colIdx >= 0 ? String(row[colIdx] || '').trim() : '';
    }
    parsedAgents.push({ name, tsiwp, codes });
  }
  adminState.parsedAgents = parsedAgents;

  // Per-operator lookups (only for operators mapped in this file) + stats
  const result = {};
  const opStats = {};
  for (const op of OPERATOR_KEYS) {
    const colName = m[op];
    if (!colName) { opStats[op] = null; continue; }

    const colIdx = headers.indexOf(colName);
    const lookup = {};
    const names = new Set();
    let total = 0;

    for (const row of dataRows) {
      const name  = String(row[nameIdx] || '').trim();
      const code  = String(row[colIdx] || '').trim();
      const tsiwp = String(row[tsiwpIdx] || '').trim();
      if (!name || !code || code === 'nan') continue;

      total++;
      names.add(name);

      lookup[code] = { name, tsiwp };
      const norm = code.toUpperCase().replace(/O/g, '0');
      if (norm !== code) lookup[norm] = { name, tsiwp };
      const num = String(parseFloat(code));
      if (!isNaN(parseFloat(code)) && num !== code) lookup[num] = { name, tsiwp };
    }

    result[op] = lookup;
    opStats[op] = { uniqueNames: names.size, totalCodes: total };
  }

  adminState.stagedIFARData = result;
  adminState.opStats = opStats;

  renderAdminSummaryCards();
  renderAdminParsedPreview();
  adminGoToPhase(3);
}

function summaryCardHTML(label, uniqueNames, totalCodes) {
  const mismatch = uniqueNames !== totalCodes;
  return `<div class="col-summary-card">
    <div class="csc-title">${label}</div>
    <div class="csc-row"><span class="csc-lbl">No. of IFAR Names</span><span class="csc-num">${uniqueNames}</span></div>
    <div class="csc-row"><span class="csc-lbl">Total No. of Codes</span><span class="csc-num ${mismatch ? 'mismatch' : ''}">${totalCodes}</span></div>
  </div>`;
}

function renderAdminSummaryCards() {
  const grid = document.getElementById('admin-col-summary-grid');
  const cards = [];

  const t = adminState.tsiwpStats;
  cards.push(summaryCardHTML('TSIWP Code', t.uniqueNames, t.totalCodes));

  for (const [op, label] of Object.entries(COL_LABELS)) {
    const s = adminState.opStats[op];
    if (!s) {
      cards.push(`<div class="col-summary-card">
        <div class="csc-title">${label}</div>
        <div class="csc-row"><span class="csc-lbl">Not in this file</span></div>
      </div>`);
    } else {
      cards.push(summaryCardHTML(label, s.uniqueNames, s.totalCodes));
    }
  }
  grid.innerHTML = cards.join('');
}

function renderAdminParsedPreview() {
  const preview = adminState.parsedAgents.slice(0, 10);
  const table = document.getElementById('admin-parsed-preview-table');
  table.innerHTML = `
    <thead><tr><th>Name</th><th>TSIWP</th>${OPERATOR_KEYS.map(o => `<th>${o}</th>`).join('')}</tr></thead>
    <tbody>${preview.map(a => `
      <tr>
        <td>${a.name || '—'}</td><td>${a.tsiwp || '—'}</td>
        ${OPERATOR_KEYS.map(o => `<td>${a.codes[o] || '—'}</td>`).join('')}
      </tr>`).join('')}
    </tbody>`;
}

// ── Phase 3: Save (replace live data + persist via download) ────────────
function saveAdminDatabase() {
  if (!adminState.stagedIFARData) return;

  // Only operators present/mapped in the uploaded file are replaced —
  // any operator left unmapped keeps its existing data untouched.
  for (const [op, lookup] of Object.entries(adminState.stagedIFARData)) {
    IFAR_LOOKUP_DATA[op] = lookup;
  }
  adminLog('✓ Live data replaced for this session', 'ok');

  function downloadIFARDatabaseJSON() {
  const dataStr = JSON.stringify(newIFARData, null, 2);

  const blob = new Blob([dataStr], {
    type: "application/json"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ifar_database.json";
  a.click();

  URL.revokeObjectURL(a.href);

  adminLog("✓ ifar_database.json downloaded. Replace the old file in /database/", "ok");
}

  document.getElementById('admin-save-confirm').style.display = 'flex';
  renderIFARStats();
}

function downloadUpdatedHTML() {
  adminLog('Generating updated HTML file...');

  const currentHTML = document.documentElement.outerHTML;
  const newDataStr = JSON.stringify(IFAR_LOOKUP_DATA);
  const updated = currentHTML.replace(
    /const IFAR_LOOKUP_DATA = \{[\s\S]*?\};(\s*\n)/,
    `const IFAR_LOOKUP_DATA = ${newDataStr};\n`
  );

  if (updated === currentHTML) {
    adminLog('ERROR: Could not locate IFAR_LOOKUP_DATA in source. Try re-downloading manually.', 'err');
    return;
  }

  const dated = updated.replace(
    'const IFAR_LOOKUP_DATA =',
    `/* IFAR DB updated: ${new Date().toISOString().slice(0,10)} */\nconst IFAR_LOOKUP_DATA =`
  );

  const blob = new Blob([dated], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Statement_Checker.html';
  a.click();
  URL.revokeObjectURL(a.href);

  adminLog('✓ Statement_Checker.html downloaded — replace it on GitHub', 'ok');
}

// Render stats on page load
