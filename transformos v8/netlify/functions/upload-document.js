// ── UPLOAD DOCUMENT — one file per request.
// This is the fix for the "something went wrong" failure: sending
// every document base64-encoded in a single POST exceeded the
// request size limit. One file at a time keeps every request small
// and gives the browser a per-file progress indicator.

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const MAX_BYTES = 4 * 1024 * 1024; // 4MB per file — safely inside function limits

const ALLOWED = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
  'image/png',
  'image/jpeg'
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

  const { company_id, file } = body;

  if (!company_id) return reply(400, { error: 'company_id is required' });
  if (!file || !file.data || !file.name) return reply(400, { error: 'file is required' });

  try {
    // Confirm the company exists before writing anything
    const { data: company, error: lookupError } = await supabase
      .from('companies').select('id').eq('id', company_id).single();

    if (lookupError || !company) return reply(404, { error: 'Company not found' });

    const buffer = Buffer.from(file.data, 'base64');

    if (buffer.length > MAX_BYTES) {
      return reply(413, {
        error: `${file.name} is larger than 4MB. Please split or compress it.`
      });
    }

    const mime = file.mimeType || 'application/octet-stream';
    if (!ALLOWED.includes(mime)) {
      return reply(415, { error: `${file.name}: file type not accepted.` });
    }

    // Strip anything awkward from the filename before it becomes a path
    const safeName = file.name.replace(/[^\w.\-]/g, '_').slice(0, 120);
    const filePath = `${company_id}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('company-documents')
      .upload(filePath, buffer, { contentType: mime, upsert: false });

    if (uploadError) throw new Error(uploadError.message);

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        company_id,
        document_type: file.category || 'General',
        file_name:     file.name,
        file_path:     filePath,
        file_size:     buffer.length
      })
      .select()
      .single();

    if (docError) throw new Error(docError.message);

    return reply(200, {
      success: true,
      document_id: doc.id,
      file_name: doc.file_name,
      file_size: doc.file_size
    });

  } catch (error) {
    console.error('Upload document error:', error.message);
    return reply(500, { error: `Upload failed for ${file?.name || 'file'}.`, detail: error.message });
  }
};
