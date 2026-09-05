// ── RUN MODELS (BACKGROUND) — the Models Master library.
// Generates any selected strategic model against the company's full
// evidence base and stores it as structured data so the portal can
// render it as the actual framework rather than as prose.
//
// Models accumulate: run two now, come back and run six more later.

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

/* ═══════════════════════════════════════════════════════════
   THE CATALOGUE
   render types:
     grid      — labelled boxes (canvases)
     matrix    — 2x2 with plotted items
     forces    — a centre with rated forces around it
     scored    — items with a score out of a max (renders as bars/spider)
     quadrants — four named boxes with lists
     table     — headers and rows
     ladder    — ordered stages or horizons
   ═══════════════════════════════════════════════════════════ */
export const CATALOGUE = [
  // ── Business model & value
  { key:'bmc',            name:'Business Model Canvas',            cat:'Business Model',   type:'grid',      brief:'The nine building blocks: Key Partners, Key Activities, Key Resources, Value Propositions, Customer Relationships, Channels, Customer Segments, Cost Structure, Revenue Streams.' },
  { key:'lean_canvas',    name:'Lean Canvas',                      cat:'Business Model',   type:'grid',      brief:'Problem, Solution, Key Metrics, Unique Value Proposition, Unfair Advantage, Channels, Customer Segments, Cost Structure, Revenue Streams.' },
  { key:'vpc',            name:'Value Proposition Canvas',         cat:'Business Model',   type:'grid',      brief:'Customer Jobs, Pains, Gains against Products & Services, Pain Relievers, Gain Creators. Assess fit.' },
  { key:'jtbd',           name:'Jobs To Be Done',                  cat:'Business Model',   type:'table',     brief:'The functional, emotional and social jobs customers hire this organisation to do, with current satisfaction and unmet need.' },
  { key:'revenue_model',  name:'Revenue Model Analysis',           cat:'Business Model',   type:'table',     brief:'Each revenue stream: type, predictability, margin, concentration risk, scalability.' },
  { key:'unit_economics', name:'Unit Economics',                   cat:'Business Model',   type:'scored',    brief:'CAC, LTV, LTV:CAC, payback period, contribution margin, churn. State clearly where figures are estimated.' },
  { key:'platform',       name:'Platform vs Pipeline Assessment',  cat:'Business Model',   type:'table',     brief:'Whether the organisation operates as a pipeline or platform, and what a platform model would require.' },

  // ── Strategy & market
  { key:'ansoff',         name:'Ansoff Matrix',                    cat:'Strategy',         type:'matrix',    brief:'Market Penetration, Product Development, Market Development, Diversification. Plot real initiatives, note which quadrants are empty.' },
  { key:'porters5',       name:"Porter's Five Forces",             cat:'Strategy',         type:'forces',    brief:'Buyer power, supplier power, threat of new entrants, threat of substitutes, competitive rivalry. Rate each 1-5.' },
  { key:'generic_strat',  name:"Porter's Generic Strategies",      cat:'Strategy',         type:'matrix',    brief:'Cost leadership, differentiation, focus. Where the organisation actually sits versus where it claims to sit.' },
  { key:'bcg',            name:'BCG Growth-Share Matrix',          cat:'Strategy',         type:'matrix',    brief:'Stars, Cash Cows, Question Marks, Dogs. Plot products or segments with investment recommendation.' },
  { key:'ge_mckinsey',    name:'GE-McKinsey Nine-Box',             cat:'Strategy',         type:'matrix',    brief:'Market attractiveness against competitive strength, nine cells, with invest/hold/harvest verdicts.' },
  { key:'blue_ocean',     name:'Blue Ocean ERRC Grid',             cat:'Strategy',         type:'quadrants', brief:'Eliminate, Reduce, Raise, Create. Be specific and commercially uncomfortable where warranted.' },
  { key:'three_horizons', name:'Three Horizons',                   cat:'Strategy',         type:'ladder',    brief:'H1 defend the core, H2 build emerging business, H3 create viable options. Allocate initiatives and effort.' },
  { key:'vrio',           name:'VRIO Analysis',                    cat:'Strategy',         type:'table',     brief:'Each resource or capability: Valuable, Rare, Inimitable, Organised. Verdict on competitive implication.' },
  { key:'core_comp',      name:'Core Competence Analysis',         cat:'Strategy',         type:'table',     brief:'What the organisation is genuinely distinctive at, tested against customer value, breadth of application and imitability.' },
  { key:'value_chain',    name:'Value Chain Analysis',             cat:'Strategy',         type:'ladder',    brief:'Primary and support activities, effectiveness 1-5, where value is created and where it leaks.' },
  { key:'moat',           name:'Economic Moat Assessment',         cat:'Strategy',         type:'scored',    brief:'Network effects, switching costs, cost advantage, intangibles, efficient scale. Score each and give the verdict.' },
  { key:'scenarios',      name:'Scenario Planning',                cat:'Strategy',         type:'matrix',    brief:'Two critical uncertainties as axes, four named scenarios, implications and early warning indicators for each.' },
  { key:'game_theory',    name:'Competitive Response Analysis',    cat:'Strategy',         type:'table',     brief:'For each major move available: likely competitor response, timing, and the organisation\'s counter.' },

  // ── Environment
  { key:'pestle',         name:'PESTLE Analysis',                  cat:'Environment',      type:'scored',    brief:'Political, Economic, Social, Technological, Legal, Environmental. Observations, impact H/M/L scored 1-5, strategic response.' },
  { key:'swot',           name:'SWOT Analysis',                    cat:'Environment',      type:'quadrants', brief:'Strengths, Weaknesses, Opportunities, Threats. Evidence-based, no filler.' },
  { key:'tows',           name:'TOWS Matrix',                      cat:'Environment',      type:'quadrants', brief:'SO, WO, ST, WT strategies — what to actually do with the SWOT.' },
  { key:'stakeholder',    name:'Stakeholder Power-Interest Grid',  cat:'Environment',      type:'matrix',    brief:'Plot named stakeholders by power and interest, with engagement approach for each.' },
  { key:'market_sizing',  name:'TAM SAM SOM',                      cat:'Environment',      type:'ladder',    brief:'Total, serviceable and obtainable market with the reasoning and sources behind each figure.' },
  { key:'competitor',     name:'Competitor Comparison',            cat:'Environment',      type:'table',     brief:'Named competitors compared on positioning, pricing, scale, strengths and vulnerabilities.' },
  { key:'disruption',     name:'Disruption Risk Assessment',       cat:'Environment',      type:'scored',    brief:'Where AI, new entrants, regulation or changing behaviour threaten the model. Score likelihood and impact.' },

  // ── Operating model & organisation
  { key:'tom_plus',       name:'TransformOS TOM+',                 cat:'Operating Model',  type:'scored',    brief:'All eleven dimensions: the eight standard TOM dimensions plus Commercial Performance, Financial Sustainability, and Innovation & Future Readiness. Current and target, scored 1-5.' },
  { key:'mck7s',          name:'McKinsey 7S',                      cat:'Operating Model',  type:'scored',    brief:'Strategy, Structure, Systems, Shared Values, Skills, Style, Staff. Alignment scored 1-5 with gaps named.' },
  { key:'capability',     name:'Capability Maturity Assessment',   cat:'Operating Model',  type:'scored',    brief:'Each core capability scored 1-5 for current maturity against required maturity.' },
  { key:'process_map',    name:'Core Process Assessment',          cat:'Operating Model',  type:'ladder',    brief:'The end-to-end process, stage by stage, with bottlenecks, cycle time and failure points.' },
  { key:'raci',           name:'RACI Matrix',                      cat:'Operating Model',  type:'table',     brief:'Key decisions and activities against roles: Responsible, Accountable, Consulted, Informed. Flag gaps and overlaps.' },
  { key:'span_layers',    name:'Span and Layers Analysis',         cat:'Operating Model',  type:'table',     brief:'Reporting layers, spans of control, and where the structure is too flat or too deep.' },
  { key:'org_design',     name:'Organisation Design Options',      cat:'Operating Model',  type:'table',     brief:'Functional, divisional, matrix and hybrid options assessed against this organisation\'s strategy.' },
  { key:'tech_stack',     name:'Technology Stack Assessment',      cat:'Operating Model',  type:'scored',    brief:'Each system layer scored for fitness, integration, risk and cost.' },
  { key:'automation',     name:'Automation Opportunity Map',       cat:'Operating Model',  type:'matrix',    brief:'Processes plotted by effort against impact, with the automation approach for each.' },
  { key:'data_maturity',  name:'Data Maturity Assessment',         cat:'Operating Model',  type:'scored',    brief:'Collection, quality, governance, analysis, and use in decisions. Scored 1-5 each.' },

  // ── Financial
  { key:'valuation',      name:'Valuation Multiplier Assessment',  cat:'Financial',        type:'scored',    brief:'Twenty-five value factors across financial quality, commercial strength, scale, people and brand. Score each and give the multiple implication.' },
  { key:'dupont',         name:'DuPont Analysis',                  cat:'Financial',        type:'ladder',    brief:'Return on equity decomposed into margin, asset turnover and leverage, with what each is telling you.' },
  { key:'break_even',     name:'Break-Even Analysis',              cat:'Financial',        type:'table',     brief:'Fixed costs, contribution margin, break-even revenue and margin of safety.' },
  { key:'cash_conversion',name:'Cash Conversion Cycle',            cat:'Financial',        type:'ladder',    brief:'Debtor days, stock days, creditor days, and the working capital implication.' },
  { key:'cost_structure', name:'Cost Structure Analysis',          cat:'Financial',        type:'table',     brief:'Fixed against variable, by category, with operating leverage and where cost can actually be removed.' },
  { key:'scenario_fin',   name:'Financial Sensitivity Analysis',   cat:'Financial',        type:'table',     brief:'Base, upside and downside against the variables that actually move the outcome.' },
  { key:'funding_options',name:'Funding Options Assessment',       cat:'Financial',        type:'table',     brief:'Debt, equity, grant, social investment and retained earnings assessed for this organisation.' },

  // ── Growth & customer
  { key:'growth_loops',   name:'Growth Loops',                     cat:'Growth',           type:'ladder',    brief:'The mechanisms by which growth compounds, and where each loop currently leaks.' },
  { key:'funnel',         name:'Customer Funnel Analysis',         cat:'Growth',           type:'ladder',    brief:'Each stage from awareness to advocacy, with conversion, drop-off and the biggest leak.' },
  { key:'journey',        name:'Customer Journey Map',             cat:'Growth',           type:'ladder',    brief:'Stage by stage: what the customer does, feels, and where the experience breaks.' },
  { key:'segmentation',   name:'Customer Segmentation',            cat:'Growth',           type:'table',     brief:'Each segment: size, value, needs, profitability and strategic priority.' },
  { key:'pricing',        name:'Pricing Strategy Assessment',      cat:'Growth',           type:'table',     brief:'Current approach against cost-plus, value-based and competitive benchmarks. Where price is being left on the table.' },
  { key:'kraljic',        name:'Kraljic Purchasing Matrix',        cat:'Growth',           type:'matrix',    brief:'Supply items by profit impact and supply risk, with the sourcing strategy for each.' },

  // ── Change & delivery
  { key:'lippitt',        name:'Lippitt-Knoster Change Model',     cat:'Change',           type:'scored',    brief:'Vision, Skills, Incentives, Resources, Action Plan — each scored, with the specific failure symptom if missing.' },
  { key:'kotter',         name:"Kotter's Eight Steps",             cat:'Change',           type:'ladder',    brief:'Each step assessed for readiness in this organisation, with what must happen first.' },
  { key:'adkar',          name:'ADKAR Readiness',                  cat:'Change',           type:'scored',    brief:'Awareness, Desire, Knowledge, Ability, Reinforcement scored across the organisation.' },
  { key:'force_field',    name:'Force Field Analysis',             cat:'Change',           type:'quadrants', brief:'Driving forces against restraining forces, each weighted, with the net verdict.' },
  { key:'greiner',        name:'Greiner Growth Model',             cat:'Change',           type:'ladder',    brief:'Which growth phase the organisation is in and which crisis it is heading into.' },
  { key:'risk_register',  name:'Risk Register',                    cat:'Change',           type:'table',     brief:'Top risks with likelihood, impact, score, mitigation and owner.' },
  { key:'moscow',         name:'MoSCoW Prioritisation',            cat:'Change',           type:'quadrants', brief:'Must have, Should have, Could have, Won\'t have — applied to the initiatives on the table.' },
  { key:'impact_effort',  name:'Impact-Effort Matrix',             cat:'Change',           type:'matrix',    brief:'Initiatives plotted by impact against effort: quick wins, major projects, fill-ins, thankless tasks.' },
  { key:'balanced_sc',    name:'Balanced Scorecard',               cat:'Change',           type:'table',     brief:'Financial, Customer, Internal Process, Learning & Growth — objectives, measures, targets, initiatives.' },
  { key:'okrs',           name:'OKR Framework',                    cat:'Change',           type:'ladder',    brief:'Three to five objectives with measurable key results for the next twelve months.' }
];

const SHAPES = {
  grid: `"cells": [ { "label": "Box name", "items": ["point", "point"], "note": "One line of assessment" } ]`,
  matrix: `"axes": { "x": { "label": "X axis name", "low": "low end", "high": "high end" }, "y": { "label": "Y axis name", "low": "low end", "high": "high end" } }, "items": [ { "label": "Item", "x": 0.7, "y": 0.3, "quadrant": "Quadrant name", "note": "Why it sits here" } ]`,
  forces: `"centre": "The organisation or market", "forces": [ { "label": "Force name", "rating": "Very High | High | Moderate | Low", "score": 4, "note": "Two sentences of assessment" } ]`,
  scored: `"items": [ { "label": "Dimension", "score": 3, "target": 5, "max": 5, "note": "Assessment and evidence" } ]`,
  quadrants: `"quadrants": [ { "label": "Quadrant name", "items": ["point", "point"] } ]`,
  table: `"headers": ["Column", "Column"], "rows": [ ["cell", "cell"] ]`,
  ladder: `"steps": [ { "label": "Stage name", "value": "Figure or status if relevant", "note": "Assessment" } ]`
};

function spec(model) {
  return `Return ONLY valid JSON. No preamble, no markdown fences, no commentary.

{
  "headline": "One sentence, under 20 words, stating what this model reveals about this organisation.",
  "narrative": "Three to five short paragraphs interpreting the model. What it shows, what it means commercially, and what to do about it. Plain prose, no headings.",
  ${SHAPES[model.type]},
  "confidence": "One or two sentences distinguishing what is evidenced from what is professional judgement in this model."
}

MODEL: ${model.name}
WHAT IT REQUIRES: ${model.brief}

RULES
- Populate the model fully. Every box, force, quadrant or dimension the framework calls for must be present.
- Use the organisation's real figures, names, segments and competitors from the evidence. Never use placeholders.
- Where the evidence does not support a cell, say so in that cell rather than inventing content.
- Scores are integers. Matrix positions are decimals between 0 and 1.
- Be commercially direct. No consultant waffle.
- British English.`;
}

const SYSTEM = `You are TransformOS, applying strategic models to a real organisation using its own evidence base. You output structured JSON and nothing else. You never invent figures, and you say plainly when the evidence does not support a conclusion.`;

async function buildContext(company_id) {
  const { data: company } = await supabase.from('companies').select('*').eq('id', company_id).single();
  if (!company) throw new Error('Company not found');

  const { data: docs } = await supabase.from('documents')
    .select('file_name, document_type, extracted_text').eq('company_id', company_id);

  const { data: stages } = await supabase.from('transformation_stages')
    .select('stage_number, stage_name, output_content')
    .eq('company_id', company_id).eq('status', 'complete')
    .order('stage_number', { ascending: true });

  let ctx = `ORGANISATION: ${company.company_name}
SECTOR: ${company.sector || 'Not specified'}
TURNOVER: ${company.annual_revenue || 'Not specified'}
EMPLOYEES: ${company.employee_count || 'Not specified'}
STAGE: ${company.business_stage || 'Not specified'}
GEOGRAPHY: ${company.geography || 'Not specified'}
OWNERSHIP: ${company.ownership || 'Not specified'}
OBJECTIVE: ${company.transformation_goal || 'Not specified'}
CHALLENGE: ${company.challenges || 'Not specified'}
CONTEXT: ${company.context || 'None provided'}`;

  const withText = (docs || []).filter(d => d.extracted_text && d.extracted_text.trim());
  if (withText.length) {
    const per = Math.floor(120000 / withText.length);
    ctx += `\n\n═══ DOCUMENT CONTENTS — PRIMARY EVIDENCE ═══\n`;
    withText.forEach(d => {
      ctx += `\n───── ${d.file_name} [${d.document_type}] ─────\n${d.extracted_text.slice(0, per)}\n`;
    });
  }

  if (stages?.length) {
    const per = Math.floor(140000 / stages.length);
    ctx += `\n\n═══ COMPLETED ANALYSIS ═══\n`;
    stages.forEach(s => {
      ctx += `\n───── STAGE ${s.stage_number} — ${s.stage_name} ─────\n${(s.output_content || '').slice(0, per)}\n`;
    });
  }

  return ctx;
}

async function runModel(company_id, model, ctx) {
  await supabase.from('company_models').upsert({
    company_id, model_key: model.key, model_name: model.name,
    category: model.cat, render_type: model.type, status: 'running', error: null
  }, { onConflict: 'company_id,model_key' });

  const message = await callClaude({
    model: 'claude-opus-5',
    max_tokens: 10000,
    system: SYSTEM,
    messages: [{ role: 'user', content: `${ctx}\n\n═══════════════\n${spec(model)}` }]
  });

  let raw = (message.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch {
    const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
    if (a === -1 || b === -1) throw new Error('Model did not return JSON');
    parsed = JSON.parse(raw.slice(a, b + 1));
  }

  const narrative = parsed.narrative || '';
  delete parsed.narrative;

  await supabase.from('company_models').update({
    status: 'complete', payload: parsed, narrative,
    completed_at: new Date().toISOString(), error: null
  }).eq('company_id', company_id).eq('model_key', model.key);
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 }); }

  const { company_id, models } = body;
  if (!company_id || !Array.isArray(models) || !models.length) {
    return new Response(JSON.stringify({ error: 'company_id and models[] required' }), { status: 400 });
  }

  try {
    const ctx = await buildContext(company_id);
    let done = 0, failed = 0;

    for (const key of models) {
      const model = CATALOGUE.find(m => m.key === key);
      if (!model) continue;
      try {
        await runModel(company_id, model, ctx);
        done++;
      } catch (err) {
        console.error('Model failed:', key, err.message);
        await supabase.from('company_models').upsert({
          company_id, model_key: model.key, model_name: model.name,
          category: model.cat, render_type: model.type,
          status: 'failed', error: err.message
        }, { onConflict: 'company_id,model_key' });
        failed++;
      }
    }

    return new Response(JSON.stringify({ success: true, done, failed }), { status: 200 });

  } catch (err) {
    console.error('Run models error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
