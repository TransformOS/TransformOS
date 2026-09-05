// ── BUILD SUMMARY (BACKGROUND) — reads every completed stage and
// produces the structured overview the client portal renders as
// charts, headline metrics and per-stage summaries.
//
// This runs as a Netlify background function: it returns 202 straight
// away and may run for up to 15 minutes. A synchronous function times
// out after about ten seconds, which is nowhere near long enough for
// Opus to read a full engagement and return structured JSON.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function callClaude(payload) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || ('Anthropic API error ' + res.status));
  return data;
}

const SPEC = `Return ONLY valid JSON. No preamble, no markdown fences, no commentary.

{
  "headline": "One sentence, under 20 words, stating the single most important finding. Direct and commercially sharp.",
  "narrative": "Two to three short paragraphs a chief executive would read first. What the analysis found, what it means, what happens next. Plain prose, no headings.",
  "metrics": [
    { "label": "Short label, 2-4 words", "value": "The figure as displayed, e.g. £13.1m or 81%", "note": "One short line of context", "tone": "good | bad | neutral" }
  ],
  "scores": {
    "note": "One line on what the scoring shows",
    "dimensions": [ { "label": "Dimension name", "current": 3, "target": 5 } ]
  },
  "trajectory": {
    "title": "Chart title",
    "unit": "£m",
    "note": "One line on what changes and why",
    "points": [ { "label": "FY25", "base": 13.1, "target": 13.1 } ]
  },
  "charts": [
    {
      "title": "Chart title",
      "type": "bar | donut",
      "note": "One line explaining what the chart shows",
      "series": [ { "label": "Series label", "value": 0, "display": "£8.05m", "highlight": true } ]
    }
  ],
  "model": {
    "note": "One line stating that these are modelling assumptions, not forecasts",
    "currency": "£",
    "streams": [ { "key": "core", "label": "Revenue stream name", "value": 8053247, "margin": 0.08, "atRisk": true } ],
    "fixed_costs": 1600000,
    "finance_costs": 555694,
    "cash": 360000,
    "headcount": 176,
    "target_revenue": 18000000,
    "target_label": "March 2029"
  },
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
- "scores": 6 to 11 dimensions taken from the operating model assessment in the analysis. "current" and "target" are 1-5. If the analysis has no such scoring, omit "scores" entirely.
- "trajectory": 4 to 6 points from the current year forward. "base" is the figure if nothing changes; "target" is the figure the plan aims for. Use the roadmap's own numbers. If the analysis gives no forward figures, omit "trajectory" entirely.
- 1 to 3 charts. "bar" for comparisons, "donut" for one proportion of a whole (exactly two series entries: the part first, then the remainder).
- "model": the numbers behind a simple scenario model. "streams" are the revenue lines with their real values and an estimated contribution margin between 0 and 1. "atRisk" is true for any stream dependent on a single buyer, contract or concentration risk identified in the analysis. Use real figures from the analysis; if revenue is not broken down, use one stream for total revenue. If the analysis contains no financial figures at all, omit "model" entirely.
- 4 to 6 findings, each tied to the stage it came from.
- One entry in "stages" for every stage supplied, in order.
- "tone" is "bad" for risk or exposure, "good" for strength, "neutral" otherwise.
- British English. No consultant waffle.`;


export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 }); }

  const { company_id } = body;
  if (!company_id) return new Response(JSON.stringify({ error: 'company_id required' }), { status: 400 });

  try {
    const { data: company } = await supabase
      .from('companies').select('*').eq('id', company_id).single();
    if (!company) throw new Error('Company not found');
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');

    await supabase.from('companies')
      .update({ summary_built_at: null, portal_summary: { status: 'building' } })
      .eq('id', company_id);

    const { data: stages } = await supabase
      .from('transformation_stages')
      .select('stage_number, stage_name, output_content')
      .eq('company_id', company_id).eq('status', 'complete')
      .order('stage_number', { ascending: true });

    if (!stages || stages.length === 0) throw new Error('No completed stages to summarise');

    const per = Math.floor(320000 / stages.length);
    const corpus = stages.map(s =>
      `───── STAGE ${s.stage_number} — ${s.stage_name} ─────\n${(s.output_content || '').slice(0, per)}`
    ).join('\n\n');

    const message = await callClaude({
      model: 'claude-opus-5',
      max_tokens: 16000,
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
      if (first === -1 || last === -1) {
        throw new Error('Model did not return JSON. stop_reason=' + (message.stop_reason || 'unknown'));
      }
      summary = JSON.parse(raw.slice(first, last + 1));
    }

    await supabase.from('companies')
      .update({ portal_summary: summary, summary_built_at: new Date().toISOString() })
      .eq('id', company_id);

    await supabase.from('usage_log').insert({
      company_id, event_type: 'summary', model_used: 'claude-opus-5',
      input_tokens: message.usage?.input_tokens, output_tokens: message.usage?.output_tokens
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    console.error('Build summary error:', err.message);
    await supabase.from('companies')
      .update({ portal_summary: { status: 'failed', error: err.message } })
      .eq('id', company_id);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
