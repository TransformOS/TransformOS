// ── SAVE INTAKE — saves company details + uploaded files to Supabase
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

  // Verify JWT token
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorised' }) };

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid session' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { company_data, files } = body;

  try {
    // ── UPDATE COMPANY RECORD
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .update({
        company_name:    company_data.company_name,
        sector:          company_data.sector,
        employee_count:  company_data.headcount,
        annual_revenue:  company_data.turnover,
        website:         company_data.website,
        primary_contact: company_data.user_name,
        contact_email:   company_data.email,
        contact_phone:   company_data.phone || '',
        transformation_goal: company_data.objective,
        updated_at:      new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (companyError) throw new Error(companyError.message);

    // ── UPLOAD FILES TO SUPABASE STORAGE
    const uploadedDocs = [];
    if (files && files.length > 0) {
      for (const file of files) {
        // Convert base64 to buffer
        const buffer = Buffer.from(file.data, 'base64');
        const filePath = `${user.id}/${Date.now()}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('company-documents')
          .upload(filePath, buffer, {
            contentType: file.mimeType || 'application/octet-stream',
            upsert: false
          });

        if (!uploadError) {
          // Save document record
          const { data: doc } = await supabase.from('documents').insert({
            company_id:    company.id,
            document_type: file.category || 'general',
            file_name:     file.name,
            file_path:     filePath,
            file_size:     buffer.length
          }).select().single();

          uploadedDocs.push(doc);
        }
      }
    }

    // ── INITIALISE TRANSFORMATION STAGES (if full transformation)
    if (company.product_type === 'full_transformation') {
      const stages = [
        { stage_number: 1, stage_name: 'Business Diagnostic' },
        { stage_number: 2, stage_name: 'Road to 2030' },
        { stage_number: 3, stage_name: 'Operational Excellence' },
        { stage_number: 4, stage_name: 'Strategic Opportunities' },
        { stage_number: 5, stage_name: 'Models Master' },
        { stage_number: 6, stage_name: 'Roadmap for Growth' },
        { stage_number: 7, stage_name: 'Business Case' },
        { stage_number: 8, stage_name: 'Financial Models' }
      ];

      // Only insert if not already created
      const { data: existing } = await supabase
        .from('transformation_stages')
        .select('id')
        .eq('company_id', company.id);

      if (!existing || existing.length === 0) {
        await supabase.from('transformation_stages').insert(
          stages.map(s => ({ ...s, company_id: company.id, status: 'not_started' }))
        );
      }
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        company_id: company.id,
        documents_saved: uploadedDocs.length
      })
    };

  } catch (error) {
    console.error('Save intake error:', error.message);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: 'Failed to save intake data. Please try again.' })
    };
  }
};
