// ── GET PORTAL — serves a finished client portal by passcode.
// Public-facing. Only returns completed stages, and only when the
// engagement has been marked live by the operator. The company UUID
// is never exposed, so a portal code cannot be used to drive the
// admin workspace.

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const reply = (statusCode, payload) => ({ statusCode, headers, body: JSON.stringify(payload) });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const raw = (event.queryStringParameters || {}).code || '';
  const code = raw.trim().toUpperCase();

  if (!code || code.length < 4) return reply(400, { error: 'Access code required' });

  try {
    const { data: company, error } = await supabase
      .from('companies')
      .select('id, company_name, sector, annual_revenue, employee_count, website, portal_live, created_at')
      .eq('portal_code', code)
      .single();

    if (error || !company) return reply(404, { error: 'Access code not recognised' });

    if (!company.portal_live) {
      return reply(423, { error: 'This portal is being prepared and is not yet available.' });
    }

    const { data: stages } = await supabase
      .from('transformation_stages')
      .select('stage_number, stage_name, output_content, completed_at')
      .eq('company_id', company.id)
      .eq('status', 'complete')
      .order('stage_number', { ascending: true });

    if (!stages || stages.length === 0) {
      return reply(423, { error: 'This portal is being prepared and is not yet available.' });
    }

    return reply(200, {
      success: true,
      company: {
        company_name: company.company_name,
        sector: company.sector,
        annual_revenue: company.annual_revenue,
        employee_count: company.employee_count,
        website: company.website,
        prepared: company.created_at
      },
      stages
    });

  } catch (err) {
    console.error('Get portal error:', err.message);
    return reply(500, { error: 'Could not load portal' });
  }
};
