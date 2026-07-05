const SUPABASE_URL = 'https://wufkxhehnvlckuonxonp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_en5LDl7Yrk9pLQmKubdwQw_bPcdKbwE';

window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getIFARLookupFromSupabase(operator) {
  const { data, error } = await window.supabase
    .from('ifar_codes')
    .select('ifar_code, adviser_name, tsiwp_code')
    .eq('operator', operator);

  if (error) {
    console.error('Supabase IFAR retrieval error:', error);
    alert('Failed to retrieve IFAR data from Supabase.');
    return {};
  }

  const lookup = {};

  data.forEach(row => {
    const code = String(row.ifar_code || '').trim();
    if (!code) return;

    const val = {
      name: row.adviser_name || '',
      tsiwp: row.tsiwp_code || ''
    };

    lookup[code] = val;
    lookup[code.toUpperCase()] = val;
    lookup[code.toUpperCase().replace(/O/g, '0')] = val;

    const num = String(parseFloat(code));
    if (!isNaN(parseFloat(code))) lookup[num] = val;
  });

  return lookup;
}