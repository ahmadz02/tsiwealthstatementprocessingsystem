/* ============================================================================
   comm-data.js
   Shared data layer for the Certificate Commencement Date table.

   Role: load / save records keyed by Certificate Number, holding:
     - ifar_code            (reference, from ifar_database.js's registry)
     - ifar_name            (reference)
     - tsi_code             (separate internal code, own mapped column)
     - cert_number
     - commencement_date

   This is a DIFFERENT table from the IFAR registry (ifar_codes, looked up
   via getIFARLookupFromSupabase() inside supabase-data.js). Both tables
   live in the SAME Supabase project/URL (via the shared `supabase` client
   created in supabase-data.js), but this file never reads or writes the
   ifar_codes table — keeping them separate preserves data integrity: a
   bad comm-data upload can't corrupt the IFAR registry, and vice versa.

   Load order required in HTML:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="../assets/js/supabase-data.js"></script>  (defines `window.supabase`)
     <script src="../assets/js/comm-data.js"></script>      (this file)
   ============================================================================ */

const COMM_DATE_TABLE = 'comm_date';

// In-memory cache, keyed by normalised Certificate Number.
let CERT_DATE_DB = {};

// ── Normalisation helpers ───────────────────────────────────────────────────
function normCertNumber(s) {
  return String(s == null ? '' : s).trim().toUpperCase().replace(/\s+/g, '');
}
function certKey(certNumber) {
  return normCertNumber(certNumber);
}
function numericVariant(s) {
  const n = parseFloat(s);
  return isNaN(n) ? null : String(n);
}

// ── Load ─────────────────────────────────────────────────────────────────────
async function loadCertDateDB() {
  try {
    const { data, error } = await supabase
      .from(COMM_DATE_TABLE)
      .select('*');

    if (error) throw error;

    CERT_DATE_DB = {};
    data.forEach(row => {
      CERT_DATE_DB[row.cert_key] = {
        commencementDate: row.commencement_date,
        agentName: row.ifar_name,
        ifarCode: row.ifar_code,
        tsiCode: row.tsi_code,
        certNumber: row.cert_number,
      };
    });

    return { ok: true, count: data.length };
  } catch (err) {
    console.error('loadCertDateDB failed:', err);
    return { ok: false, error: err };
  }
}

// ── Save (upsert only — never deletes existing rows) ───────────────────────
// `records` is an object keyed by cert_key, same shape as CERT_DATE_DB.
async function saveCertDateDB(records) {
  const rows = Object.entries(records).map(([key, record]) => ({
    cert_key: key,
    cert_number: record.certNumber,
    commencement_date: record.commencementDate,
    ifar_code: record.ifarCode,
    ifar_name: record.agentName,
    tsi_code: record.tsiCode,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from(COMM_DATE_TABLE)
    .upsert(rows, { onConflict: 'cert_key' });

  if (error) throw error;

  // Update local cache with what we just saved
  for (const [key, record] of Object.entries(records)) {
    CERT_DATE_DB[key] = record;
  }

  return { ok: true, count: rows.length };
}

// ── Lookup (matching is based solely on Certificate Number) ────────────────
function lookupCommencementDate(certNumber) {
  const raw = String(certNumber == null ? '' : certNumber).trim();
  const normalized = normCertNumber(raw);

  const candidates = [normalized, raw];

  const numCert = numericVariant(raw);
  if (numCert) candidates.push(normCertNumber(numCert));

  // 1. Direct certificate-only key
  for (const k of candidates) {
    if (CERT_DATE_DB[k]) return CERT_DATE_DB[k];
  }

  // 2. Legacy format: IFARCODE||CERTNUMBER
  for (const [key, record] of Object.entries(CERT_DATE_DB)) {
    const keyCert = key.includes('||') ? key.split('||').pop() : key;

    if (candidates.includes(normCertNumber(keyCert))) return record;
    if (record.certNumber && candidates.includes(normCertNumber(record.certNumber))) return record;
  }

  return null;
}