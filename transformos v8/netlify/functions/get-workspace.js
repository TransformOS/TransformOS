// ── GET WORKSPACE — returns company, documents and stage status.
// Also used for polling while a stage generates.

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

  const company_id = (event.queryStringParameters || {}).company_id;
  const light = (event.queryStringParameters || {}).light === '1';

  if (!company_id) return reply(400, { error: 'company_id is required' });

  try {
    const { data: company, error: cErr } = await supabase
      .from('companies').select('*').eq('id', company_id).single();

    if (cErr || !company) return reply(404, { error: 'Workspace not found' });

    // light=1 is used for polling — omits the large output_content field
    const stageCols = light
      ? 'stage_number, stage_name, status, model_used, completed_at'
      : 'stage_number, stage_name, status, output_content, model_used, input_tokens, output_tokens, error_message, completed_at';

    const { data: stages } = await supabase
      .from('transformation_stages')
      .select(stageCols)
      .eq('company_id', company_id)
      .order('stage_number', { ascending: true });

    const { data: documents } = await supabase
      .from('documents')
      .select('id, file_name, document_type, file_size, created_at')
      .eq('company_id', company_id)
      .order('created_at', { ascending: true });

    return reply(200, {
      success: true,
      company,
      stages: stages || [],
      documents: documents || []
    });

  } catch (error) {
    console.error('Get workspace error:', error.message);
    return reply(500, { error: 'Could not load workspace', detail: error.message });
  }
};
