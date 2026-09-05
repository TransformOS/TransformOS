// ── GET MODELS — returns the catalogue plus this company's model runs.
// Used by the operator console (picker) and the client portal (render).

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type'
};
const reply = (s, p) => ({ statusCode: s, headers, body: JSON.stringify(p) });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const q = event.queryStringParameters || {};
  const company_id = q.company_id;
  const portal_code = (q.code || '').trim().toUpperCase();

  try {
    let id = company_id;

    if (!id && portal_code) {
      const { data: c } = await supabase.from('companies')
        .select('id, portal_live').eq('portal_code', portal_code).single();
      if (!c || !c.portal_live) return reply(404, { error: 'Not found' });
      id = c.id;
    }

    if (!id) return reply(400, { error: 'company_id or code required' });

    const { data: models } = await supabase.from('company_models')
      .select('model_key, model_name, category, render_type, status, payload, narrative, error, completed_at')
      .eq('company_id', id)
      .order('category', { ascending: true });

    return reply(200, { success: true, models: models || [] });

  } catch (err) {
    console.error('Get models error:', err.message);
    return reply(500, { error: err.message });
  }
};
