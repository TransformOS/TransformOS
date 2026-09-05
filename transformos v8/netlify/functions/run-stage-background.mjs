// ── RUN STAGE (BACKGROUND) — generates one stage.
// Netlify treats any function whose filename ends in "-background"
// as a background function: it returns 202 immediately and may run
// for up to 15 minutes. That is what allows a proper-length output
// instead of the 2,500-token summaries the synchronous version was
// forced to produce.

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {})
});

/* ═══ MODEL AND LENGTH PER STAGE ═══
   Cost difference across a full run is roughly £2.
   Quality difference on the judgement-heavy stages is not marginal. */
// max_tokens is a shared ceiling for reasoning AND written output.
// Stage 8 originally failed with stop_reason=max_tokens and only
// thinking blocks returned: the model used its whole budget reasoning
// and had nothing left to write with. The synthesis-heavy stages
// therefore need substantially more headroom than the early ones.
// Stages listed here generate in two passes and are joined. This
// removes the output ceiling rather than raising it: each pass has a
// full token budget, and the second pass receives the first as context
// so the document stays continuous.
const SPLIT_AT = {
  1: 'SECTION 8',
  4: 'SECTION 4',
  6: 'SECTION 5',
  7: 'SECTION 5',
  8: 'SECTION 6'
};

const STAGE_CONFIG = {
  1: { model: 'claude-opus-5',    max_tokens: 24000, research: 8 },
  2: { model: 'claude-opus-5',    max_tokens: 20000, research: 4 },
  3: { model: 'claude-sonnet-5',  max_tokens: 20000, research: 0 },
  4: { model: 'claude-opus-5',    max_tokens: 24000, research: 8 },
  5: { model: 'claude-sonnet-5',  max_tokens: 22000, research: 4 },
  6: { model: 'claude-opus-5',    max_tokens: 24000, research: 0 },
  7: { model: 'claude-opus-5',    max_tokens: 28000, research: 3 },
  8: { model: 'claude-opus-5',    max_tokens: 32000, research: 0 }
};

const SYSTEM_PROMPT = `You are TransformOS, an enterprise transformation operating system built on thirty years of building, growing and transforming businesses.

STANDARDS — not optional:
- Run every framework the section calls for, in full. Never condense, never sample, never write "for brevity". If a section asks for twelve sub-sections, produce twelve.
- Direct and commercially sharp. No consultant waffle. Lead with the answer.
- Distinguish evidenced fact from professional judgement explicitly. Where a figure is an estimate rather than a provided number, say so in the text.
- Where evidence is thin, still complete the analysis using best available information and reasoned professional judgement, and label it as such. Never leave a section blank for lack of sources.
- Volunteer where the analysis could be wrong and where a plan could fail. This is the most credible thing in any document.
- British English throughout.
- Use markdown headings and tables so the output renders directly.

EXTERNAL DUE DILIGENCE:
Where web search is available to you, use it properly before forming conclusions. Research the organisation itself — its website, its published accounts and filings, its leadership, its recent announcements. Research what is being said about it publicly: reviews, press coverage, customer and employee commentary, sector commentary. Research the market it operates in: size, direction of travel, named competitors and how they position, regulatory and funding movements, and anything happening now that changes the picture.

Bring what you find into the analysis rather than reporting it separately. Cite the source in the text where a finding rests on it. Where public information contradicts what the organisation has told you, say so plainly — that gap is often the most valuable finding in the document. Where you searched and found nothing, say that too; absence of public presence is itself a finding.

You are producing one stage of an eight-stage engagement. Prior stages are supplied as established findings — build on them and stay consistent. Do not contradict earlier findings without flagging that you are doing so and why.`;

const STAGE_PROMPTS = {
  1: `Produce a Business Diagnostic report:
SECTION 1: BUSINESS OVERVIEW — company details, what it does, brief history.
SECTION 2: EXECUTIVE SUMMARY — current state, market context, critical constraint, biggest opportunity, recommended focus.
SECTION 3: BUSINESS MODEL CANVAS — all 9 elements. End with Model Type, Revenue Predictability, Scalability, Vulnerabilities.
SECTION 4: COMMERCIAL HEALTH — score 1-5: Lead Generation, Sales Process, Conversion, Pricing, Retention, Revenue Quality. Each: score, evidence, red flags, actions.
SECTION 5: FINANCIAL HEALTH — revenue trend, gross margin vs sector benchmark, cost structure, cash position, key risks. Rating: Strong/Stable/Vulnerable/Critical.
SECTION 6: OPERATIONAL CAPABILITY — score 1-5: Delivery, Process Maturity, Technology, Capacity, Quality. Each: score, evidence, bottlenecks, actions.
SECTION 7: PEOPLE & ORGANISATION — leadership completeness, key person dependencies, capability gaps, culture. People Health Rating.
SECTION 8: SWOT ANALYSIS — 4-6 bullets each.
SECTION 9: CRITICAL CONSTRAINT — the single most important thing holding this business back. State it plainly.
SECTION 10: TOP 10 PRIORITY RECOMMENDATIONS — ranked by impact. Each: action, why it matters, owner, timeline, expected impact.
SECTION 11: TOM CURRENT STATE BASELINE — score each (High/Med/Low gap): Strategy & Direction, Operating Model, Processes & Capabilities, People & Organisation, Technology & Data, Governance & Controls, Culture & Behaviours, Customer Experience. Top 3 TOM priorities.
SECTION 12: VALUATION MULTIPLIER SNAPSHOT — score /10: Financial Quality, Commercial Strength, Scale & Growth, People & Organisation, Brand & Reputation. Total /50. Rating: Premium/Strong/Market Rate/Discounted/Distressed. Top 3 improvements.
SECTION 13: EXTERNAL DUE DILIGENCE — researched, not assumed. Cover: what the organisation says about itself publicly and how that matches the intake; public reputation and sentiment (reviews, press, employee and customer commentary); named competitor comparison with how each positions and prices; market size and direction of travel; regulatory, funding or sector movements that change the picture. Cite sources. Flag any gap between the public record and what you were told.
SECTION 14: EVIDENCE & CONFIDENCE — what is directly evidenced, what is professional estimate, what could not be assessed, and what a document you were not given would have resolved.`,

  2: `Build a Road to 2030 vision document:
SECTION 1: STRATEGIC BASELINE — where we are, the gap, the burning platform
SECTION 2: THE 2030 AMBITION — headline statement, revenue target, market position
SECTION 3: THE GROWTH THESIS — core logic, 3-4 strategic bets, key assumptions
SECTION 4: STRATEGIC PILLARS — 3-4 pillars with rationale, initiatives, 2030 metrics
SECTION 5: MILESTONE MAP — 2026 foundation through 2030 destination
SECTION 6: CRITICAL SUCCESS FACTORS — 5-7 things that must go right
SECTION 7: STRATEGIC RISKS — top 5 with likelihood, impact, mitigation
SECTION 8: THE LEADERSHIP CHALLENGE — what must change at leadership level
SECTION 9: WHY THIS MIGHT NOT HAPPEN — the three most likely reasons this trajectory is not achieved`,

  3: `Produce an Operational Excellence report:
SECTION 1: OPERATIONAL HEALTH SUMMARY — maturity score 1-5, top 3 strengths, top 3 weaknesses
SECTION 2: QUICK WINS — 8 improvements executable in 90 days. Each: what, why, how, owner, effort, impact
SECTION 3: PROCESS IMPROVEMENT PRIORITIES — top 5 processes. Each: current state, target state, approach, timeline, metric
SECTION 4: TECHNOLOGY & SYSTEMS GAPS — stack assessment, critical gaps, recommendations
SECTION 5: CAPACITY & RESOURCE ANALYSIS — utilisation, bottlenecks, recommended changes
SECTION 6: OPERATIONAL ROADMAP — months 1-3, 4-6, 7-9, 10-12
SECTION 7: OPERATIONAL KPI DASHBOARD — 10 KPIs with baseline, target, frequency, owner
Every recommendation must be executable by the management team without consultants.`,

  4: `Identify and evaluate Strategic Opportunities:
SECTION 0: MARKET RESEARCH — search before you assess. Current market size and growth, named competitors and their positioning, live funding streams, grants, contracts or policy movements the organisation could act on, and what is changing in the sector right now. Cite sources and dates. Timing arguments must rest on something you found, not something you assumed.
SECTION 1: OPPORTUNITY LANDSCAPE — top 3-5 market opportunities and the timing argument
SECTION 2: OPPORTUNITY DEEP-DIVES — top 5. Each: description, market size, strategic fit, revenue Y1/Y3, investment, risks, verdict (Pursue Now/Plan/Monitor/Avoid)
SECTION 3: ANSOFF MATRIX — mapped across all 4 quadrants with risk and priority
SECTION 4: PRIORITISATION — score each: Revenue Potential, Strategic Fit, Feasibility, Speed to Value, Competitive Advantage (1-5)
SECTION 5: GO-TO-MARKET — for the top 2: target customer, value proposition, channel, pricing, sales motion, 90-day launch plan
SECTION 6: STRATEGIC PARTNERSHIPS — 3-5 with deal structure and approach
SECTION 7: THE CONVICTION BET — the single opportunity most deserving of resource, and the honest case against it`,

  5: `Apply the Models Master framework:
SECTION 1: PORTER'S FIVE FORCES — each force: assessment, score 1-5, implication. Overall industry attractiveness.
SECTION 2: MCKINSEY 7S — each element: current state, alignment gaps, recommendations. Alignment score 1-10.
SECTION 3: BALANCED SCORECARD — 4 perspectives, 3-4 KPIs each with baseline, target, initiative.
SECTION 4: BCG GROWTH-SHARE MATRIX — products/segments mapped, with investment recommendation.
SECTION 5: VALUE CHAIN ANALYSIS — primary and support activities, effectiveness 1-5, where value is created and where it leaks.
SECTION 6: PESTLE — each factor: observations, impact H/M/L, strategic response.
SECTION 7: TRANSFORMOS TOM+ — all 11 dimensions scored 1-5: the 8 standard dimensions plus Commercial Performance, Financial Sustainability, Innovation & Future Readiness. Current, target, gap, priority.
SECTION 8: STRATEGIC SYNTHESIS — 3 most important insights, clearest strategic direction, and where frameworks converge. Convergence across multiple frameworks is the most reliable signal.`,

  6: `Build a 36-month Roadmap for Growth:
SECTION 1: GROWTH THESIS — growth story, revenue baseline, 36-month target, 3 primary drivers
SECTION 2: STRATEGIC PRIORITIES — 5-7 with rationale, success metrics, interdependencies
SECTION 3: 36-MONTH ROADMAP — quarterly for Year 1, half-yearly Years 2-3. Each: initiatives, revenue milestones, capability milestones, investment, risks
SECTION 4: INITIATIVE REGISTER — all initiatives with owner, timeline, investment, revenue impact, priority
SECTION 5: RESOURCE PLAN — headcount, capital, technology investment by year
SECTION 6: REVENUE MODEL — by stream Y1-Y3, key assumptions, base/upside/downside
SECTION 7: MILESTONE & METRICS FRAMEWORK — 10 milestones, monthly metrics, success at 12/24/36 months
SECTION 8: THE CHALLENGE PANEL — pressure-test the plan: capability check, execution difficulty check, focus check, revenue link check. Where does this plan break?`,

  7: `Build the Business Case:
SECTION 1: EXECUTIVE SUMMARY — recommendation, investment, expected return, payback, risk rating
SECTION 2: STRATEGIC CONTEXT — why necessary, cost of inaction, opportunity, alignment to 2030
SECTION 3: INVESTMENT REQUIRED — Y1/Y2/Y3 by category: People, Technology, Operations, Commercial, Governance
SECTION 4: FINANCIAL PROJECTIONS — revenue and EBITDA for Base/Upside/Downside Y1-Y3. ROI, NPV, payback.
SECTION 5: BENEFITS REALISATION — quantified financial benefits, strategic benefits, timeline
SECTION 6: RISK REGISTER — top 10 with likelihood, impact, score, mitigation, owner
SECTION 7: SENSITIVITY ANALYSIS — revenue at 50% of forecast, costs 20% higher, key talent loss
SECTION 8: WHAT WOULD MAKE THIS WRONG — the honest case against your own numbers. What is excluded, which variable is most sensitive, what has not been tested, what competitor response is unmodelled.
SECTION 9: RECOMMENDATION & NEXT STEPS
All figures must reconcile with the roadmap and diagnostic. Show the inputs for any derived number.`,

  8: `Build the Financial Models:
SECTION 1: FINANCIAL BASELINE — revenue, margin, EBITDA, cash, key ratios vs sector benchmark
SECTION 2: 3-YEAR P&L FORECAST — Base/Upside/Downside: Revenue, COGS, Gross Profit, OpEx, EBITDA, PBT, PAT
SECTION 3: CASH FLOW PROJECTIONS — monthly Y1, quarterly Y2-Y3. Drivers, working capital, capex, financing needs
SECTION 4: INVESTMENT & FUNDING PLAN — by year and category, funding sources, funding gap
SECTION 5: KEY ASSUMPTIONS — every major assumption stated with justification
SECTION 6: BREAK-EVEN ANALYSIS — fixed costs, contribution margin, break-even revenue, safety margin
SECTION 7: SCENARIO ANALYSIS — Base, Upside, Downside with key variables and trigger points
SECTION 8: FINANCIAL KPI DASHBOARD — 15 KPIs with current, Y1 target, Y3 target, frequency, owner
SECTION 9: VALUATION IMPLICATIONS — current EV range, Y3 value base case, value drivers, exit multiple range
SECTION 10: MODEL ASSUMPTIONS & LIMITATIONS — what is evidenced, what is assumed, what this model does not cover
Every figure must reconcile with the business case. Show workings for derived numbers.`
};

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

async function buildSummary(company_id) {
  const { data: company } = await supabase
    .from('companies').select('*').eq('id', company_id).single();
  if (!company) throw new Error('Company not found');

  await supabase.from('companies')
    .update({ portal_summary: { status: 'building' }, summary_built_at: null })
    .eq('id', company_id);

  const { data: stages } = await supabase
    .from('transformation_stages')
    .select('stage_number, stage_name, output_content')
    .eq('company_id', company_id).eq('status', 'complete')
    .order('stage_number', { ascending: true });

  if (!stages || stages.length === 0) throw new Error('No completed stages to summarise');

  const per = Math.floor(120000 / stages.length);
  const corpus = stages.map(s =>
    `───── STAGE ${s.stage_number} — ${s.stage_name} ─────\n${(s.output_content || '').slice(0, per)}`
  ).join('\n\n');

  // Sonnet rather than Opus: this is structured extraction from text
  // that already exists, not judgement work. Roughly a third of the
  // cost, and a much smaller request against available credit.
  const message = await callClaude({
    model: 'claude-sonnet-5',
    max_tokens: 8000,
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
    if (first === -1 || last === -1) throw new Error('Model did not return JSON. stop_reason=' + (message.stop_reason || 'unknown'));
    summary = JSON.parse(raw.slice(first, last + 1));
  }

  await supabase.from('companies')
    .update({ portal_summary: summary, summary_built_at: new Date().toISOString() })
    .eq('id', company_id);
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 }); }

  const { company_id, stage_number, extra_context, mode } = body;

  // ── SUMMARY MODE — reuses this proven background function rather
  // than a separate one, so there is only one long-running path.
  if (mode === 'summary') {
    try {
      await buildSummary(company_id);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err) {
      console.error('Build summary error:', err.message);
      await supabase.from('companies')
        .update({ portal_summary: { status: 'failed', error: err.message } })
        .eq('id', company_id);
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  const config = STAGE_CONFIG[stage_number];

  if (!company_id || !config) {
    return new Response(JSON.stringify({ error: 'company_id and valid stage_number required' }), { status: 400 });
  }

  try {
    const { data: company } = await supabase
      .from('companies').select('*').eq('id', company_id).single();
    if (!company) throw new Error('Company not found');

    await supabase.from('transformation_stages')
      .update({ status: 'in_progress', started_at: new Date().toISOString(), error_message: null })
      .eq('company_id', company_id).eq('stage_number', stage_number);

    const { data: priorStages } = await supabase
      .from('transformation_stages')
      .select('stage_number, stage_name, output_content')
      .eq('company_id', company_id).eq('status', 'complete')
      .order('stage_number', { ascending: true });

    const { data: documents } = await supabase
      .from('documents').select('file_name, document_type').eq('company_id', company_id);

    let context = `COMPANY: ${company.company_name || 'Not provided'}
SECTOR: ${company.sector || 'Not specified'}
EMPLOYEES: ${company.employee_count || 'Not specified'}
TURNOVER: ${company.annual_revenue || 'Not specified'}
BUSINESS STAGE: ${company.business_stage || 'Not specified'}
GEOGRAPHY: ${company.geography || 'Not specified'}
OWNERSHIP: ${company.ownership || 'Not specified'}
WEBSITE: ${company.website || 'Not specified'}
PRIMARY OBJECTIVE: ${company.transformation_goal || 'Not specified'}
BIGGEST CHALLENGE: ${company.challenges || 'Not specified'}
TECH STACK: ${company.tech_stack || 'Not specified'}
ADDITIONAL CONTEXT: ${company.context || 'None provided'}`;

    if (documents?.length) {
      context += `\n\nDOCUMENTS SUPPLIED BY THE CLIENT (${documents.length}):\n`;
      context += documents.map(d => `- ${d.file_name} [${d.document_type}]`).join('\n');
      context += `\n\nDocument contents are not machine-readable in this pass. Treat the presence and type of these documents as evidence of what the organisation holds, and note where a document would resolve an open question.`;
    }

    if (extra_context && extra_context.trim()) {
      context += `\n\nADDITIONAL INFORMATION PROVIDED FOR THIS STAGE:\n${extra_context.trim()}`;
    }

    if (priorStages?.length) {
      context += '\n\n═══ PRIOR STAGE OUTPUTS — established findings ═══\n';
      const BUDGET = 300000;
      const per = Math.floor(BUDGET / priorStages.length);
      priorStages.forEach(s => {
        const full = s.output_content || '';
        const clipped = full.length > per ? full.slice(0, per) + '\n...[truncated]' : full;
        context += `\n───── STAGE ${s.stage_number} — ${s.stage_name} ─────\n${clipped}\n`;
      });
    }

    const basePrompt = STAGE_PROMPTS[stage_number];
    const userBase = `${context}\n\n═══════════════\nTASK — STAGE ${stage_number}:\n`;

    async function callModel(instruction, priorHalf) {
      const req = {
        model: config.model,
        max_tokens: config.max_tokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userBase + instruction + (priorHalf
          ? `\n\n═══ WHAT YOU HAVE ALREADY WRITTEN FOR THIS STAGE ═══\nContinue seamlessly from this. Do not repeat it, do not re-introduce the document, do not summarise it. Pick up exactly where it stops.\n\n${priorHalf}`
          : '') }]
      };
      if (config.research > 0 && !priorHalf) {
        req.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: config.research }];
      }

      let msg = await anthropic.messages.create(req);
      let turns = 0;
      while (msg.stop_reason === 'pause_turn' && turns < 5) {
        turns++;
        req.messages = [...req.messages, { role: 'assistant', content: msg.content }];
        msg = await anthropic.messages.create(req);
      }
      const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      return { text, msg };
    }

    let output = '';
    let message;
    let totalIn = 0, totalOut = 0;

    const splitMarker = SPLIT_AT[stage_number];

    if (splitMarker) {
      // ── PASS 1
      const firstInstruction = basePrompt +
        `\n\nIMPORTANT — THIS IS PART ONE OF TWO. Write everything up to but NOT including ${splitMarker}. Complete every section in that range in full depth. Do not summarise, do not skip ahead, and do not write a closing statement — the document continues in part two.`;
      const first = await callModel(firstInstruction, null);
      message = first.msg;
      totalIn += first.msg.usage?.input_tokens || 0;
      totalOut += first.msg.usage?.output_tokens || 0;

      if (!first.text.trim()) {
        throw new Error('Part one returned no text. stop_reason=' + (first.msg.stop_reason || 'unknown') +
          ', blocks=' + (first.msg.content || []).map(b => b.type).join('|'));
      }

      // ── PASS 2
      const tail = first.text.slice(-16000);
      const secondInstruction = basePrompt +
        `\n\nIMPORTANT — THIS IS PART TWO OF TWO. Part one covered everything before ${splitMarker}. Write ${splitMarker} onwards, completing every remaining section in full depth. Do not repeat earlier sections and do not re-introduce the document.`;
      const second = await callModel(secondInstruction, tail);
      totalIn += second.msg.usage?.input_tokens || 0;
      totalOut += second.msg.usage?.output_tokens || 0;

      output = first.text.trim() + '\n\n' + second.text.trim();
      if (second.msg.stop_reason === 'max_tokens') message = second.msg;

    } else {
      const only = await callModel(basePrompt, null);
      message = only.msg;
      output = only.text;
      totalIn = only.msg.usage?.input_tokens || 0;
      totalOut = only.msg.usage?.output_tokens || 0;

      if (!output.trim() && config.research > 0) {
        const retry = await callModel(basePrompt + '\n\nWrite the analysis now, in full.', null);
        output = retry.text;
        message = retry.msg;
      }
    }

    if (!output.trim()) {
      throw new Error(
        'Model returned no text. stop_reason=' + (message.stop_reason || 'unknown') +
        ', blocks=' + (message.content || []).map(b => b.type).join('|') +
        ', output_tokens=' + (message.usage?.output_tokens ?? 'n/a')
      );
    }

    if (message.stop_reason === 'max_tokens') {
      output += '\n\n---\n\n*This stage reached its output limit and may be incomplete. Regenerate to produce a full version.*';
    }

    await supabase.from('transformation_stages')
      .update({
        status: 'complete',
        output_content: output,
        model_used: config.model,
        input_tokens: totalIn,
        output_tokens: totalOut,
        completed_at: new Date().toISOString()
      })
      .eq('company_id', company_id).eq('stage_number', stage_number);

    await supabase.from('usage_log').insert({
      company_id,
      event_type: 'stage',
      model_used: config.model,
      input_tokens: totalIn,
      output_tokens: totalOut
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error) {
    console.error(`Stage ${stage_number} failed:`, error.message);
    await supabase.from('transformation_stages')
      .update({ status: 'failed', error_message: error.message })
      .eq('company_id', company_id).eq('stage_number', stage_number);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
