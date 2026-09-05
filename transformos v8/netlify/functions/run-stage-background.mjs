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
const STAGE_CONFIG = {
  1: { model: 'claude-opus-5',    max_tokens: 16000, research: 10 },
  2: { model: 'claude-opus-5',    max_tokens: 12000, research: 4  },
  3: { model: 'claude-sonnet-5',  max_tokens: 12000, research: 0  },
  4: { model: 'claude-opus-5',    max_tokens: 14000, research: 10 },
  5: { model: 'claude-sonnet-5',  max_tokens: 14000, research: 5  },
  6: { model: 'claude-opus-5',    max_tokens: 14000, research: 0  },
  7: { model: 'claude-opus-5',    max_tokens: 14000, research: 3  },
  8: { model: 'claude-opus-5',    max_tokens: 16000, research: 0  }
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

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 }); }

  const { company_id, stage_number, extra_context } = body;
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

    const request = {
      model: config.model,
      max_tokens: config.max_tokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `${context}\n\n═══════════════\nTASK — STAGE ${stage_number}:\n${STAGE_PROMPTS[stage_number]}` }]
    };

    // Server-side web search. Anthropic runs the searches and returns
    // the results inline, so no tool-use loop is needed here.
    if (config.research > 0) {
      request.tools = [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: config.research
      }];
    }

    const message = await anthropic.messages.create(request);

    const output = (message.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    if (!output.trim()) throw new Error('Empty response from model');

    await supabase.from('transformation_stages')
      .update({
        status: 'complete',
        output_content: output,
        model_used: config.model,
        input_tokens: message.usage?.input_tokens,
        output_tokens: message.usage?.output_tokens,
        completed_at: new Date().toISOString()
      })
      .eq('company_id', company_id).eq('stage_number', stage_number);

    await supabase.from('usage_log').insert({
      company_id,
      event_type: 'stage',
      model_used: config.model,
      input_tokens: message.usage?.input_tokens,
      output_tokens: message.usage?.output_tokens
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
