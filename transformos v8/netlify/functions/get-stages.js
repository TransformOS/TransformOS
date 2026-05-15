// ── GET STAGES — returns all transformation stages for the authenticated user's company
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

  const token = (event.headers.authorization || '').replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorised' }) };

  try {
    // Get company
    const { data: company } = await supabase
      .from('companies')
      .select('id, product_type')
      .eq('user_id', user.id)
      .single();

    if (!company) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Company not found' }) };

    // Get stages
    const { data: stages } = await supabase
      .from('transformation_stages')
      .select('stage_number, stage_name, status, completed_at, output_content')
      .eq('company_id', company.id)
      .order('stage_number', { ascending: true });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ stages: stages || [], company_id: company.id })
    };

  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
