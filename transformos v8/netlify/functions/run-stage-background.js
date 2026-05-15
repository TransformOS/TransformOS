// ── BACKGROUND FUNCTION — no timeout limit
// Must be named with -background suffix OR exported as background
// Netlify detects this via the filename: run-stage-bg.js
// We use a workaround: set status to 'generating' immediately,
// then do the work, then save. Client polls check-stage-status.

const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const STAGE_PROMPTS = {
  1: `You are a senior management consultant with 20+ years experience. Produce a comprehensive Business Diagnostic report. Be direct, evidence-based, commercially rigorous. No fluff. No consultant-speak.

Structure EXACTLY as follows:

SECTION 1: BUSINESS OVERVIEW
Company name, sector, revenue scale, headcount, what the business does (2-3 plain English sentences), key facts.

SECTION 2: EXECUTIVE SUMMARY
5 paragraphs: (1) current state in plain language, (2) market context, (3) the critical constraint — the single most important thing holding it back, (4) the biggest opportunity, (5) recommended strategic focus.

SECTION 3: BUSINESS MODEL CANVAS
Customer Segments, Value Propositions, Channels, Customer Relationships, Revenue Streams, Key Resources, Key Activities, Key Partnerships, Cost Structure. End with: Model Type, Revenue Predictability (High/Med/Low), Scalability (High/Med/Low), Top 2 Model Vulnerabilities.

SECTION 4: COMMERCIAL HEALTH ASSESSMENT
Score 1-5 with evidence and recommended actions for: Lead Generation, Sales Process, Conversion Rate, Pricing Strategy, Customer Retention, Revenue Quality. Overall Commercial Health Rating.

SECTION 5: FINANCIAL HEALTH ASSESSMENT
Revenue trend, gross margin vs sector benchmark, cost structure analysis, cash position, working capital, key financial risks. Overall Financial Health Rating: Strong/Stable/Vulnerable/Critical.

SECTION 6: OPERATIONAL CAPABILITY ASSESSMENT
Score 1-5 with evidence for: Delivery Quality, Process Maturity, Technology Utilisation, Capacity Management, Quality Control. Key bottlenecks. Top 3 operational priorities.

SECTION 7: PEOPLE & ORGANISATION
Leadership team completeness, key person dependencies, capability gaps, culture indicators. People Health Rating.

SECTION 8: SWOT ANALYSIS
4-6 specific, evidence-based bullets for each: Strengths, Weaknesses, Opportunities, Threats.

SECTION 9: CRITICAL CONSTRAINT
The single most important thing holding this business back. Root cause. Downstream impact if not addressed. State it plainly — do not soften it.

SECTION 10: TOP 10 PRIORITY RECOMMENDATIONS
Ranked 1-10 by impact. Each: action, why it matters, owner role, timeline (Immediate/30/90 days/6 months), expected impact.

SECTION 11: DELOITTE TOM — CURRENT STATE BASELINE
Score each dimension (High/Med/Low gap, Yes/No priority):
Strategy & Direction | Operating Model & Structure | Processes & Capabilities | People & Organisation | Technology & Data | Governance & Controls | Culture & Behaviours | Customer Experience
Top 3 TOM priorities. Critical question this business must resolve.

SECTION 12: VALUATION MULTIPLIER ASSESSMENT
Score out of 10 for each of 25 factors across 5 categories:
FINANCIAL QUALITY: EBITDA quality, Add-backs, Margins, Financial MI, Debtor Days
COMMERCIAL STRENGTH: Revenue model, Pricing, Customer quality, Contracts, Network, Competitive advantage, Partnerships
SCALE & GROWTH: Scale, Diversification, Market trends, Size, Age
PEOPLE & ORGANISATION: Team depth, Org design, HR book, Process maturity, Metrics
BRAND & REPUTATION: Brand strength, Reputation, Tech/IP

Total /250. Normalised score /10. Rating: Premium(8.5+)/Strong(7-8.4)/Market Rate(5.5-6.9)/Discounted(4-5.4)/Distressed(<4).
Top 5 multiplier improvement opportunities with current score, target score, action.
Multiplier Verdict: 3-4 sentences on current valuation story and what would move the multiple most.`,

  2: `You are a senior strategist. Build a Road to 2030 vision document.

SECTION 1: STRATEGIC BASELINE — current state summary, the gap, the burning platform (why change is not optional)
SECTION 2: THE 2030 AMBITION — headline ambition statement, revenue target, market position target, what success looks like
SECTION 3: THE GROWTH THESIS — core strategic logic, 3-4 strategic bets, key assumptions, what must be true
SECTION 4: STRATEGIC PILLARS — 3-4 pillars each with name, rationale, key initiatives, 2030 success metrics
SECTION 5: MILESTONE MAP — 2026 foundations, 2027 acceleration, 2028 scale, 2029 optimisation, 2030 destination
SECTION 6: CRITICAL SUCCESS FACTORS — 5-7 things that must go right, why critical, what puts each at risk
SECTION 7: STRATEGIC RISKS — top 5 risks with likelihood H/M/L, impact H/M/L, mitigation
SECTION 8: THE LEADERSHIP CHALLENGE — what must change at leadership level, mindset shift required, capability gaps to close

Bold, specific, commercially grounded. Should inspire and challenge in equal measure.`,

  3: `You are an Operations Director. Produce an Operational Excellence report.

SECTION 1: OPERATIONAL HEALTH SUMMARY — maturity score 1-5, top 3 strengths, top 3 weaknesses
SECTION 2: QUICK WINS — 8 specific improvements in 90 days. Each: what, why, how, owner, effort L/M/H, impact
SECTION 3: PROCESS IMPROVEMENT PRIORITIES — top 5 processes. Each: current state, target, gap, approach, timeline, metric
SECTION 4: TECHNOLOGY & SYSTEMS GAPS — stack assessment, critical gaps, recommendations with approximate cost
SECTION 5: CAPACITY & RESOURCE ANALYSIS — utilisation, bottlenecks, recommended changes (hire/restructure/outsource/automate)
SECTION 6: OPERATIONAL ROADMAP — Month 1-3, 4-6, 7-9, 10-12 actions
SECTION 7: OPERATIONAL KPI DASHBOARD — 10-15 KPIs with baseline, target, frequency, owner

Every recommendation executable without external consultants.`,

  4: `You are a Chief Commercial Officer. Identify Strategic Opportunities.

SECTION 1: OPPORTUNITY LANDSCAPE — top 3-5 market opportunities, timing argument for each
SECTION 2: OPPORTUNITY DEEP-DIVES — top 5 opportunities. Each: description, market size, strategic fit, revenue potential Y1/Y3, investment required, key risks, verdict: Pursue Now/Plan Next Quarter/Monitor/Avoid
SECTION 3: ANSOFF MATRIX — opportunities across all 4 quadrants with risk level and recommended priority
SECTION 4: OPPORTUNITY PRIORITISATION — score all: Revenue Potential, Strategic Fit, Feasibility, Speed to Value, Competitive Advantage (1-5 each). Ranked list.
SECTION 5: GO-TO-MARKET — top 2 opportunities: target customer, value proposition, channel, pricing, sales motion, 90-day launch plan
SECTION 6: STRATEGIC PARTNERSHIPS — 3-5 opportunities with partner profile, deal structure, approach`,

  5: `You are a strategy consultant. Apply the Models Master framework.

SECTION 1: PORTER'S FIVE FORCES — each force: assessment, score 1-5, strategic implication. Overall industry attractiveness verdict.
SECTION 2: MCKINSEY 7S — each element: current state, alignment gaps, recommendations. Alignment score 1-10. Key misalignments.
SECTION 3: BALANCED SCORECARD — 4 perspectives, 3-4 KPIs each with baseline, target, initiative to close gap
SECTION 4: BCG GROWTH-SHARE MATRIX — products/services mapped across Stars/Cash Cows/Question Marks/Dogs with investment recommendation
SECTION 5: VALUE CHAIN ANALYSIS — primary and support activities, effectiveness 1-5, where value created and where it leaks
SECTION 6: PESTLE ANALYSIS — each factor: observations, impact H/M/L, strategic response
SECTION 7: STRATEGIC SYNTHESIS — 3 most important cross-framework insights, single clearest strategic direction`,

  6: `You are a Growth Director. Build a 36-month Roadmap for Growth.

SECTION 1: GROWTH THESIS — growth story, revenue baseline, 36-month target, 3 primary growth drivers
SECTION 2: STRATEGIC PRIORITIES — 5-7 priorities with rationale, success metrics, interdependencies
SECTION 3: 36-MONTH ROADMAP — Q by Q Year 1, half-year Years 2-3. Each: initiatives, revenue milestones, capability milestones, investment, risks
SECTION 4: INITIATIVE REGISTER — all initiatives: owner, dates, investment, revenue impact, priority Critical/High/Medium
SECTION 5: RESOURCE PLAN — headcount, capital, technology by year. Total investment requirement.
SECTION 6: REVENUE MODEL — revenue by stream Y1-Y3, base/upside/downside cases, key assumptions
SECTION 7: MILESTONE & METRICS FRAMEWORK — 10 key milestones, monthly metrics, success at 12/24/36 months`,

  7: `You are building the Business Case for this transformation.

SECTION 1: EXECUTIVE SUMMARY — recommendation, investment required, expected return, payback period, risk rating
SECTION 2: STRATEGIC CONTEXT — why necessary, cost of inaction, opportunity being addressed
SECTION 3: INVESTMENT REQUIRED — Y1/Y2/Y3 by category: People, Technology, Operations, Commercial, Governance. Totals.
SECTION 4: FINANCIAL PROJECTIONS — revenue and EBITDA Base/Upside/Downside Y1-Y3. ROI, NPV at 10%, payback period.
SECTION 5: BENEFITS REALISATION — quantified financial benefits, unquantified strategic benefits, benefits timeline
SECTION 6: RISK REGISTER — top 10 risks: likelihood H/M/L, impact H/M/L, risk score, mitigation, owner
SECTION 7: SENSITIVITY ANALYSIS — revenue 50% of forecast, costs 20% higher, key talent loss — impact on ROI
SECTION 8: RECOMMENDATION & NEXT STEPS — clear recommendation, conditions, immediate actions, decision required from board`,

  8: `You are a CFO building Financial Models for this transformation.

SECTION 1: FINANCIAL BASELINE — revenue, margin, EBITDA, cash, key ratios vs sector benchmark
SECTION 2: 3-YEAR P&L FORECAST — Base/Upside/Downside: Revenue, Gross Profit, EBITDA, PBT, PAT with margins
SECTION 3: CASH FLOW PROJECTIONS — monthly Y1, quarterly Y2-Y3. Working capital, capex, financing requirements.
SECTION 4: INVESTMENT & FUNDING PLAN — total by year and category, funding sources, funding gap analysis
SECTION 5: KEY FINANCIAL ASSUMPTIONS — all major assumptions with justification
SECTION 6: BREAK-EVEN ANALYSIS — fixed costs, contribution margin, break-even revenue, safety margin
SECTION 7: SCENARIO ANALYSIS — Base/Upside/Downside with key variables and trigger points between scenarios
SECTION 8: FINANCIAL KPI DASHBOARD — 15 KPIs: current value, Y1 target, Y3 target, frequency, owner
SECTION 9: VALUATION IMPLICATIONS — current EV range, Y3 value base case, value drivers, exit multiple range`
};

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const token = (event.headers.authorization || '').replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorised' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { stage_number, company_id } = body;

  try {
    const { data: company } = await supabase
      .from('companies').select('*')
      .eq('id', company_id).eq('user_id', user.id).single();

    if (!company) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Company not found' }) };

    // SET STATUS TO 'generating' IMMEDIATELY so client knows it started
    await supabase.from('transformation_stages')
      .update({ status: 'generating', output_content: null })
      .eq('company_id', company_id).eq('stage_number', stage_number);

    const { data: priorStages } = await supabase
      .from('transformation_stages').select('stage_number, stage_name, output_content')
      .eq('company_id', company_id).eq('status', 'complete')
      .order('stage_number', { ascending: true });

    const { data: documents } = await supabase
      .from('documents').select('file_name, document_type')
      .eq('company_id', company_id);

    let context = `COMPANY: ${company.company_name || 'Not provided'}
SECTOR: ${company.sector || 'Not specified'}
EMPLOYEES: ${company.employee_count || 'Not specified'}
ANNUAL REVENUE: ${company.annual_revenue || 'Not specified'}
WEBSITE: ${company.website || 'Not specified'}
TRANSFORMATION GOAL: ${company.transformation_goal || 'Not specified'}
DOCUMENTS UPLOADED: ${documents?.length > 0 ? documents.map(d => `${d.file_name} (${d.document_type})`).join(', ') : 'None — base analysis on intake profile only, flag where documents would sharpen the assessment'}`;

    if (priorStages?.length > 0) {
      context += '\n\nPRIOR STAGE OUTPUTS — TREAT AS PRIMARY EVIDENCE:\n';
      priorStages.forEach(s => {
        context += `\n${'='.repeat(50)}\nSTAGE ${s.stage_number}: ${s.stage_name.toUpperCase()}\n${'='.repeat(50)}\n${s.output_content || ''}\n`;
      });
    }

    // CALL ANTHROPIC — no timeout concern with background function
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: `${context}\n\n${'='.repeat(50)}\nYOUR TASK — STAGE ${stage_number}\n${'='.repeat(50)}\n${STAGE_PROMPTS[stage_number]}\n\nIMPORTANT: Produce a comprehensive, detailed report. Every section is required. Be specific to this company — use the data provided throughout. This is a board-level document.`
      }]
    });

    const output = message.content[0].text;

    // SAVE COMPLETE OUTPUT
    await supabase.from('transformation_stages')
      .update({ status: 'complete', output_content: output, completed_at: new Date().toISOString() })
      .eq('company_id', company_id).eq('stage_number', stage_number);

    // UNLOCK NEXT STAGE
    if (stage_number < 8) {
      await supabase.from('transformation_stages')
        .update({ status: 'in_progress' })
        .eq('company_id', company_id).eq('stage_number', stage_number + 1);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (error) {
    console.error('Background stage error:', error.message);
    await supabase.from('transformation_stages')
      .update({ status: 'error' })
      .eq('company_id', company_id).eq('stage_number', stage_number);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
