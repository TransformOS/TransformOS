// ── RESET STAGE — resets a stage to not_started so it can be re-run
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const token = (event.headers.authorization || '').replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorised' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { stage_number, company_id } = body;

  try {
    // Verify company belongs to user
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('id', company_id)
      .eq('user_id', user.id)
      .single();

    if (!company) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Company not found' }) };

    // Reset stage
    await supabase
      .from('transformation_stages')
      .update({
        status: 'not_started',
        output_content: null,
        completed_at: null
      })
      .eq('company_id', company_id)
      .eq('stage_number', stage_number);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
