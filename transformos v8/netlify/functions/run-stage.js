const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const STAGE_PROMPTS = {
  1: `You are a senior management consultant. Produce a Business Diagnostic report using this exact structure. Be direct, evidence-based, commercially rigorous. No fluff.

SECTION 1: BUSINESS OVERVIEW
Company details, what it does, brief history.

SECTION 2: EXECUTIVE SUMMARY
Current state, market context, critical constraint, biggest opportunity, recommended focus.

SECTION 3: BUSINESS MODEL CANVAS
All 9 elements. End with Model Type, Revenue Predictability, Scalability, Vulnerabilities.

SECTION 4: COMMERCIAL HEALTH
Score 1-5: Lead Generation, Sales Process, Conversion, Pricing, Retention, Revenue Quality. Each: score, evidence, red flags, actions.

SECTION 5: FINANCIAL HEALTH
Revenue trend, gross margin vs sector benchmark, cost structure, cash position, key risks. Overall rating: Strong/Stable/Vulnerable/Critical.

SECTION 6: OPERATIONAL CAPABILITY
Score 1-5: Delivery, Process Maturity, Technology, Capacity, Quality. Each: score, evidence, bottlenecks, actions.

SECTION 7: PEOPLE & ORGANISATION
Leadership completeness, key person dependencies, capability gaps, culture. People Health Rating.

SECTION 8: SWOT ANALYSIS
4-6 bullets each: Strengths, Weaknesses, Opportunities, Threats.

SECTION 9: CRITICAL CONSTRAINT
The single most important thing holding this business back. State it plainly.

SECTION 10: TOP 10 PRIORITY RECOMMENDATIONS
Ranked by impact. Each: action, why it matters, owner, timeline, expected impact.

SECTION 11: TOM CURRENT STATE BASELINE
Score each (High/Med/Low gap): Strategy & Direction, Operating Model, Processes & Capabilities, People & Organisation, Technology & Data, Governance & Controls, Culture & Behaviours, Customer Experience. Top 3 TOM priorities.

SECTION 12: VALUATION MULTIPLIER SNAPSHOT
Score out of 10: Financial Quality, Commercial Strength, Scale & Growth, People & Organisation, Brand & Reputation. Total /50. Rating: Premium/Strong/Market Rate/Discounted/Distressed. Top 3 improvement opportunities.`,

  2: `You are a senior strategist. Build a Road to 2030 vision document using this structure:

SECTION 1: STRATEGIC BASELINE — where we are today, the gap, the burning platform
SECTION 2: THE 2030 AMBITION — headline statement, revenue target, market position
SECTION 3: THE GROWTH THESIS — core strategic logic, 3-4 strategic bets, key assumptions
SECTION 4: STRATEGIC PILLARS — 3-4 pillars, each with name, rationale, initiatives, 2030 metrics
SECTION 5: MILESTONE MAP — 2026 foundation, 2027 acceleration, 2028 scale, 2029 optimise, 2030 destination
SECTION 6: CRITICAL SUCCESS FACTORS — 5-7 things that must go right
SECTION 7: STRATEGIC RISKS — top 5 risks with likelihood, impact, mitigation
SECTION 8: THE LEADERSHIP CHALLENGE — what must change at leadership level

Be bold and specific. This document should inspire and challenge in equal measure.`,

  3: `You are an Operations Director. Produce an Operational Excellence report:

SECTION 1: OPERATIONAL HEALTH SUMMARY — maturity score 1-5, top 3 strengths, top 3 weaknesses
SECTION 2: QUICK WINS — 8 specific improvements executable in 90 days. Each: what, why, how, owner, effort, impact
SECTION 3: PROCESS IMPROVEMENT PRIORITIES — top 5 processes to redesign. Each: current state, target state, approach, timeline, metric
SECTION 4: TECHNOLOGY & SYSTEMS GAPS — current stack assessment, critical gaps, recommendations
SECTION 5: CAPACITY & RESOURCE ANALYSIS — utilisation, bottlenecks, recommended changes
SECTION 6: OPERATIONAL ROADMAP — month 1-3, 4-6, 7-9, 10-12 actions
SECTION 7: OPERATIONAL KPI DASHBOARD — 10 KPIs with baseline, target, frequency, owner

Every recommendation must be executable by the management team without consultants.`,

  4: `You are a Chief Commercial Officer. Identify and evaluate Strategic Opportunities:

SECTION 1: OPPORTUNITY LANDSCAPE — top 3-5 market opportunities and timing argument
SECTION 2: OPPORTUNITY DEEP-DIVES — top 5 opportunities. Each: description, market size, strategic fit, revenue potential Y1/Y3, investment required, risks, verdict (Pursue Now/Plan/Monitor/Avoid)
SECTION 3: ANSOFF MATRIX — opportunities mapped across all 4 quadrants with risk and priority
SECTION 4: OPPORTUNITY PRIORITISATION — score all opportunities: Revenue Potential, Strategic Fit, Feasibility, Speed to Value, Competitive Advantage (each 1-5)
SECTION 5: GO-TO-MARKET — for top 2 opportunities: target customer, value proposition, channel, pricing, sales motion, 90-day launch plan
SECTION 6: STRATEGIC PARTNERSHIPS — 3-5 partnership opportunities with deal structure and approach`,

  5: `You are a strategy consultant. Apply the Models Master framework:

SECTION 1: PORTER'S FIVE FORCES — each force: assessment, score 1-5, strategic implication. Overall industry attractiveness.
SECTION 2: MCKINSEY 7S — each element: current state, alignment gaps, recommendations. 7S alignment score 1-10.
SECTION 3: BALANCED SCORECARD — 4 perspectives, 3-4 KPIs each with baseline, target, initiative.
SECTION 4: BCG GROWTH-SHARE MATRIX — map products/segments across Stars, Cash Cows, Question Marks, Dogs with investment recommendation.
SECTION 5: VALUE CHAIN ANALYSIS — primary and support activities, effectiveness 1-5, where value is created and where it leaks.
SECTION 6: PESTLE ANALYSIS — each factor: observations, impact H/M/L, strategic response.
SECTION 7: STRATEGIC SYNTHESIS — 3 most important insights, single clearest strategic direction.`,

  6: `You are a Growth Director. Build a 36-month Roadmap for Growth:

SECTION 1: GROWTH THESIS — core growth story, revenue baseline, 36-month target, 3 primary growth drivers
SECTION 2: STRATEGIC PRIORITIES — 5-7 priorities with rationale, success metrics, interdependencies
SECTION 3: 36-MONTH ROADMAP — Q by Q for Year 1, half-year for Years 2-3. Each period: initiatives, revenue milestones, capability milestones, investment, risks
SECTION 4: INITIATIVE REGISTER — all initiatives with owner, timeline, investment, revenue impact, priority
SECTION 5: RESOURCE PLAN — headcount, capital, technology investment by year
SECTION 6: REVENUE MODEL — revenue by stream Y1-Y3, key assumptions, base/upside/downside
SECTION 7: MILESTONE & METRICS FRAMEWORK — 10 key milestones, monthly metrics, success definition at 12/24/36 months`,

  7: `You are building the Business Case for this transformation:

SECTION 1: EXECUTIVE SUMMARY — recommendation, investment required, expected return, payback period, risk rating
SECTION 2: STRATEGIC CONTEXT — why necessary, cost of inaction, opportunity, alignment to 2030
SECTION 3: INVESTMENT REQUIRED — Y1/Y2/Y3 by category: People, Technology, Operations, Commercial, Governance
SECTION 4: FINANCIAL PROJECTIONS — revenue and EBITDA for Base/Upside/Downside cases Y1-Y3. ROI, NPV, payback.
SECTION 5: BENEFITS REALISATION — quantified financial benefits, strategic benefits, benefits timeline
SECTION 6: RISK REGISTER — top 10 risks with likelihood, impact, score, mitigation, owner
SECTION 7: SENSITIVITY ANALYSIS — impact of revenue 50% of forecast, costs 20% higher, key talent loss
SECTION 8: RECOMMENDATION & NEXT STEPS — clear recommendation, conditions, immediate actions, decision required`,

  8: `You are a CFO building Financial Models for this transformation:

SECTION 1: FINANCIAL BASELINE — current revenue, margin, EBITDA, cash, key ratios vs sector benchmark
SECTION 2: 3-YEAR P&L FORECAST — Base/Upside/Downside: Revenue, COGS, Gross Profit, OpEx, EBITDA, PBT, PAT
SECTION 3: CASH FLOW PROJECTIONS — monthly Y1, quarterly Y2-Y3. Key drivers, working capital, capex, financing needs
SECTION 4: INVESTMENT & FUNDING PLAN — total investment by year and category, funding sources, funding gap
SECTION 5: KEY ASSUMPTIONS — all major assumptions explicitly stated with justification
SECTION 6: BREAK-EVEN ANALYSIS — fixed costs, contribution margin, break-even revenue, safety margin
SECTION 7: SCENARIO ANALYSIS — Base, Upside, Downside cases with key variables and trigger points
SECTION 8: FINANCIAL KPI DASHBOARD — 15 KPIs with current value, Y1 target, Y3 target, frequency, owner
SECTION 9: VALUATION IMPLICATIONS — current EV range, Y3 value in base case, value drivers, exit multiple range`
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
REVENUE: ${company.annual_revenue || 'Not specified'}
WEBSITE: ${company.website || 'Not specified'}
GOAL: ${company.transformation_goal || 'Not specified'}
DOCUMENTS: ${documents?.length > 0 ? documents.map(d => d.file_name).join(', ') : 'None uploaded'}`;

    if (priorStages?.length > 0) {
      context += '\n\nPRIOR ANALYSIS:\n';
      priorStages.forEach(s => {
        // Truncate prior stage outputs to avoid token overload
        const truncated = s.output_content ? s.output_content.substring(0, 1500) + '...[continues]' : '';
        context += `\nSTAGE ${s.stage_number} — ${s.stage_name}:\n${truncated}\n`;
      });
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      messages: [{
        role: 'user',
        content: `${context}\n\n---\nTASK — STAGE ${stage_number}:\n${STAGE_PROMPTS[stage_number]}`
      }]
    });

    const output = message.content[0].text;

    await supabase.from('transformation_stages')
      .update({ status: 'complete', output_content: output, completed_at: new Date().toISOString() })
      .eq('company_id', company_id).eq('stage_number', stage_number);

    if (stage_number < 8) {
      await supabase.from('transformation_stages')
        .update({ status: 'in_progress' })
        .eq('company_id', company_id).eq('stage_number', stage_number + 1);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, output }) };

  } catch (error) {
    console.error('Run stage error:', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Stage generation failed. Please try again.' }) };
  }
};
