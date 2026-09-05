// ── BUILD SUMMARY — reads every completed stage and produces the
// structured overview the client portal renders as charts, headline
// metrics and per-stage summaries. Output is strict JSON so the
// front end can draw from it rather than parsing prose.

const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type'
};
const reply = (s, p) => ({ statusCode: s, headers, body: JSON.stringify(p) });

const SPEC = `Return ONLY valid JSON. No preamble, no markdown fences, no commentary.

{
  "headline": "One sentence, under 20 words, stating the single most important finding. Direct and commercially sharp.",
  "narrative": "Two to three short paragraphs a chief executive would read first. What the analysis found, what it means, what happens next. Plain prose, no headings.",
  "metrics": [
    { "label": "Short label, 2-4 words", "value": "The figure as displayed, e.g. £13.1m or 81%", "note": "One short line of context", "tone": "good | bad | neutral" }
  ],
  "charts": [
    {
      "title": "Chart title",
      "type": "bar | donut | trajectory",
      "note": "One line explaining what the chart shows",
      "series": [ { "label": "Series label", "value": 0, "display": "£8.05m", "highlight": true } ]
    }
  ],
  "findings": [
    { "title": "Short finding title", "detail": "Two or three sentences.", "stage": 1 }
  ],
  "stages": [
    {
      "stage_number": 1,
      "headline": "One sentence capturing what this stage concluded",
      "summary": "Three or four sentences summarising the stage for someone who will not read all of it.",
      "metrics": [ { "label": "Short label", "value": "Figure" } ]
    }
  ]
}

RULES
- 4 to 6 metrics. Only figures that actually appear in the analysis. Never invent a number.
- 2 to 4 charts. "bar" for comparisons across categories, "donut" for a single proportion of a whole (series must be exactly two entries: the part and the remainder), "trajectory" for a figure over time. "value" must be a plain number; "display" is what the reader sees.
- 4 to 6 findings, each tied to the stage it came from.
- One entry in "stages" for every stage supplied, in order.
- "tone" is "bad" for risk or exposure, "good" for strength, "neutral" otherwise.
- British English. No consultant waffle.`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { error: 'Invalid JSON' }); }

  const { company_id } = body;
  if (!company_id) return reply(400, { error: 'company_id required' });

  try {
    const { data: company } = await supabase
      .from('companies').select('*').eq('id', company_id).single();
    if (!company) return reply(404, { error: 'Company not found' });

    const { data: stages } = await supabase
      .from('transformation_stages')
      .select('stage_number, stage_name, output_content')
      .eq('company_id', company_id).eq('status', 'complete')
      .order('stage_number', { ascending: true });

    if (!stages || stages.length === 0) return reply(400, { error: 'No completed stages to summarise' });

    const per = Math.floor(320000 / stages.length);
    const corpus = stages.map(s =>
      `───── STAGE ${s.stage_number} — ${s.stage_name} ─────\n${(s.output_content || '').slice(0, per)}`
    ).join('\n\n');

    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 12000,
      system: 'You produce structured JSON summaries of completed transformation engagements. You output JSON and nothing else.',
      messages: [{
        role: 'user',
        content: `ORGANISATION: ${company.company_name}\nSECTOR: ${company.sector || 'Not specified'}\nTURNOVER: ${company.annual_revenue || 'Not specified'}\nEMPLOYEES: ${company.employee_count || 'Not specified'}\n\n${corpus}\n\n═══════════════\n${SPEC}`
      }]
    });

    let raw = (message.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

    let summary;
    try { summary = JSON.parse(raw); }
    catch (e) {
      const first = raw.indexOf('{'), last = raw.lastIndexOf('}');
      if (first === -1 || last === -1) throw new Error('Model did not return JSON');
      summary = JSON.parse(raw.slice(first, last + 1));
    }

    await supabase.from('companies')
      .update({ portal_summary: summary, summary_built_at: new Date().toISOString() })
      .eq('id', company_id);

    await supabase.from('usage_log').insert({
      company_id, event_type: 'summary', model_used: 'claude-opus-5',
      input_tokens: message.usage?.input_tokens, output_tokens: message.usage?.output_tokens
    });

    return reply(200, { success: true, summary });

  } catch (err) {
    console.error('Build summary error:', err.message);
    return reply(500, { error: err.message });
  }
};
