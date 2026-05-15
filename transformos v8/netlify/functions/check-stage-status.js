// ── CHECK STAGE STATUS — client polls this every 3 seconds
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

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

  const { stage_number, company_id } = event.queryStringParameters || {};

  try {
    const { data: stage } = await supabase
      .from('transformation_stages')
      .select('status, output_content, completed_at')
      .eq('company_id', company_id)
      .eq('stage_number', parseInt(stage_number))
      .single();

    if (!stage) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Stage not found' }) };

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        status: stage.status,
        output: stage.status === 'complete' ? stage.output_content : null,
        completed_at: stage.completed_at
      })
    };

  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
