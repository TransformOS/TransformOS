// ── AUTH FUNCTION — handles register + login via Supabase
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { action, email, password, name, access_code } = body;

  // ── REGISTER
  if (action === 'register') {
    // Validate access code
    const { data: codeData, error: codeError } = await supabase
      .from('access_codes')
      .select('*')
      .eq('code', access_code)
      .eq('used', false)
      .single();

    if (codeError || !codeData) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or already used access code.' }) };
    }

    // Create user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, access_code, product_type: codeData.product_type }
    });

    if (authError) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: authError.message }) };
    }

    // Mark access code as used
    await supabase
      .from('access_codes')
      .update({ used: true, used_by: authData.user.id, used_at: new Date().toISOString() })
      .eq('code', access_code);

    // Create company placeholder and fetch back with ID
    const { data: newCompany } = await supabase
      .from('companies')
      .insert({
        user_id: authData.user.id,
        company_name: '',
        access_code,
        product_type: codeData.product_type
      })
      .select()
      .single();

    // Sign them in to get a session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: signInError.message }) };
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        session: signInData.session,
        user: signInData.user,
        company: newCompany,
        product_type: codeData.product_type
      })
    };
  }

  // ── LOGIN
  if (action === 'login') {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid email or password.' }) };
    }

    // Get their company + product type
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', data.user.id)
      .single();

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        session: data.session,
        user: data.user,
        company,
        product_type: company?.product_type || 'business_diagnostic'
      })
    };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };
};
