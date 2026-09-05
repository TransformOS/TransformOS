// ── PUBLISH PORTAL — flips a client portal live or back to draft,
// and generates a portal code the first time it is published.

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type'
};
const reply = (statusCode, payload) => ({ statusCode, headers, body: JSON.stringify(payload) });

function makeCode(name) {
  const stem = (name || 'CLIENT').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'TOS';
  const year = new Date().getFullYear();
  const salt = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  return `${stem}-${year}-${salt}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { error: 'Invalid JSON' }); }

  const { company_id, live } = body;
  if (!company_id) return reply(400, { error: 'company_id required' });

  try {
    const { data: company } = await supabase
      .from('companies').select('id, company_name, portal_code').eq('id', company_id).single();
    if (!company) return reply(404, { error: 'Company not found' });

    const update = { portal_live: !!live };
    if (live && !company.portal_code) update.portal_code = makeCode(company.company_name);

    const { data, error } = await supabase
      .from('companies').update(update).eq('id', company_id)
      .select('portal_code, portal_live').single();

    if (error) throw new Error(error.message);
    return reply(200, { success: true, ...data });

  } catch (err) {
    console.error('Publish portal error:', err.message);
    return reply(500, { error: err.message });
  }
};
