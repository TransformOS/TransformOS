// ── SAVE INTAKE — creates the company record, no login required.
// Identity is a generated UUID returned to the browser and kept in
// localStorage. Files are uploaded separately, one per request, by
// upload-document.js — nothing large ever travels through here.

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const VALID_CODES = [
  'DIAG-2026', 'INVEST-2026', 'EXIT-2026', 'BOARD-2026',
  'TRANSFORM-2026', 'STABLE-2026', 'STABLE-SINGLE',
  'TRANSFORMOS-FULL', 'PILOT-2026'
];

// Which codes get the full eight-stage production line
const FULL_TRANSFORMATION_CODES = ['TRANSFORM-2026', 'TRANSFORMOS-FULL', 'PILOT-2026'];

const STAGES = [
  { stage_number: 1, stage_name: 'Business Diagnostic' },
  { stage_number: 2, stage_name: 'Road to 2030' },
  { stage_number: 3, stage_name: 'Operational Excellence' },
  { stage_number: 4, stage_name: 'Strategic Opportunities' },
  { stage_number: 5, stage_name: 'Models Master' },
  { stage_number: 6, stage_name: 'Roadmap for Growth' },
  { stage_number: 7, stage_name: 'Business Case' },
  { stage_number: 8, stage_name: 'Financial Models' }
];

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const reply = (statusCode, payload) => ({
  statusCode, headers, body: JSON.stringify(payload)
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { error: 'Invalid JSON' }); }

  const { access_code, company_data } = body;

  const code = (access_code || '').trim().toUpperCase();
  if (!VALID_CODES.includes(code)) {
    return reply(403, { error: 'Access code not recognised' });
  }
  if (!company_data || !company_data.company_name) {
    return reply(400, { error: 'Company name is required' });
  }

  const productType = FULL_TRANSFORMATION_CODES.includes(code)
    ? 'full_transformation'
    : 'diagnostic';

  try {
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        access_code:         code,
        product_type:        productType,
        company_name:        company_data.company_name || null,
        sector:              company_data.sector || null,
        employee_count:      company_data.headcount || null,
        annual_revenue:      company_data.turnover || null,
        website:             company_data.website || null,
        business_stage:      company_data.stage || null,
        geography:           company_data.geography || null,
        ownership:           company_data.ownership || null,
        transformation_goal: company_data.objective || null,
        challenges:          company_data.challenges || null,
        tech_stack:          company_data.tech_stack || null,
        social:              company_data.social || null,
        context:             company_data.context || null,
        primary_contact:     company_data.user_name || null,
        contact_email:       company_data.email || null,
        contact_phone:       company_data.phone || null
      })
      .select()
      .single();

    if (companyError) throw new Error(companyError.message);

    // Every engagement gets all eight stage records. A diagnostic-only
    // client simply never runs stages 2-8; the rows cost nothing and
    // mean an upgrade needs no migration.
    const { error: stageError } = await supabase
      .from('transformation_stages')
      .insert(STAGES.map(s => ({
        ...s,
        company_id: company.id,
        status: s.stage_number === 1 ? 'in_progress' : 'not_started'
      })));

    if (stageError) throw new Error(stageError.message);

    await supabase.from('usage_log').insert({
      company_id: company.id,
      event_type: 'intake'
    });

    return reply(200, {
      success: true,
      company_id: company.id,
      product_type: productType,
      company_name: company.company_name
    });

  } catch (error) {
    console.error('Save intake error:', error.message);
    return reply(500, { error: 'Failed to save intake data.', detail: error.message });
  }
};
