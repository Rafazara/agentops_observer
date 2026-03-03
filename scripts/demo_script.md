# AgentOps Observer - Investor Demo Script

**Duration:** 5 minutes  
**Goal:** Demonstrate the value proposition and core capabilities of AgentOps Observer

---

## Pre-Demo Setup (Before Meeting)

1. Open browser to `http://localhost:3002` (or production URL)
2. Login with demo credentials:
   - Email: `user1@demo.agentops.ai`
   - Password: `password123`
3. Ensure you're on the Dashboard page
4. Have second browser tab ready for the Executions page

---

## Demo Flow

### Opening Hook (30 seconds)

> *"Imagine you have 50 AI agents running in production. Each one costs money, can fail silently, and is essentially a black box. How do you know which ones are working well? Which ones are burning budget? AgentOps Observer gives you complete visibility."*

**Action:** Show the Dashboard overview

---

### Act 1: The Dashboard - "Command Center" (1 minute)

**Show:**
- **Top metrics** - Total executions, success rate, total cost, active agents
- **Real-time execution chart** - Point to the live updating graph
- **System status indicator** - "DEMO mode, all systems operational"

**Say:**
> *"This is your command center. At a glance, you can see every agent's performance. Notice the 94.9% success rate - that 5% failure rate represents potential issues we're actively monitoring."*

**Click:** The "Active Incidents" count (if any incidents exist)

---

### Act 2: Deep Dive - Execution Trace (1.5 minutes)

**Navigation:** Click "Executions" in sidebar

**Show:**
- **Execution list** with status badges (Running, Completed, Failed)
- **Real-time updates** - Point out any running executions
- **Cost per execution** column

**Say:**
> *"Every execution is tracked. See this one that cost $0.45? Let's see exactly why."*

**Action:** Click on any execution row to open detail view

**Show in Execution Detail:**
- **Trace timeline** - LLM calls, tool invocations, timing
- **Token usage breakdown** - Input vs output tokens
- **Cost attribution** - Which model calls were most expensive
- **Error details** (if failed execution)

**Say:**
> *"This is the X-ray vision you've never had before. We can see every LLM call, every tool invocation, exactly how long each step took, and precisely where the money went."*

---

### Act 3: Cost Intelligence (1 minute)

**Navigation:** Click "Costs" in sidebar

**Show:**
- **Cost summary cards** - Current spend, projected monthly
- **Cost by agent chart** - Which agents are most expensive
- **Model comparison** (if available)

**Say:**
> *"This is where we save you money. See this agent spending 3x more than others? Maybe it's using GPT-4 when GPT-3.5 would suffice. We give you the data to make that call."*

---

### Act 4: Incident Management (45 seconds)

**Navigation:** Click "Incidents" in sidebar

**Show:**
- **Active incidents** with severity badges
- **Incident timeline/history**
- **Affected agents**

**Say:**
> *"When something goes wrong, you know immediately. No more checking logs at 2 AM wondering why your agent stopped responding. The system alerts you and shows you exactly what failed."*

---

### The Close (15 seconds)

**Navigate back to:** Dashboard

**Say:**
> *"Every enterprise running AI agents needs this visibility. Without it, you're flying blind with a fleet of expensive, unpredictable systems. With AgentOps Observer, you're in control."*

---

## Handling Common Questions

### "How do you integrate with our existing agents?"

> *"We provide SDKs for Python and TypeScript. It's typically 3-5 lines of code to instrument an existing agent. We use OpenTelemetry under the hood, so if you're already using observability tools, it integrates seamlessly."*

**Show:** Settings → API Keys (demonstrate the SDK integration code snippet)

### "What about data security?"

> *"All data is encrypted in transit and at rest. We're SOC 2 compliant. You can also self-host if needed for maximum control. Check our Compliance section for audit logs."*

**Show:** Compliance page with audit log entries

### "What's the pricing model?"

> *"We charge based on the number of executions monitored. The free tier includes 10,000 executions/month. Enterprise plans include custom retention, SSO, and priority support."*

**Show:** Pricing page (if available in demo)

### "How does this compare to Langsmith/Langtrace?"

> *"We focus on production monitoring, not just development debugging. Our incident management, cost analytics, and alerting are built for teams running agents at scale in production. Plus, we're model-agnostic - works with any LLM provider."*

---

## Demo Tips

1. **Keep it moving** - Don't linger on any screen for more than 30 seconds
2. **Tell stories** - "Imagine this agent started failing at 3 AM..."
3. **Show, don't tell** - Click through the UI rather than describing it
4. **End on value** - Always return to the business impact (cost savings, uptime, visibility)
5. **Handle errors gracefully** - If API calls fail, say "This is demo mode - in production, you'd see live data from your actual agents"

---

## Backup Demo Flow (If API is Down)

If the API is unavailable:

1. Show the Login page and explain the authentication flow
2. Navigate to any page - the skeletons/loading states demonstrate good UX
3. Talk through the features using the sidebar navigation
4. Emphasize: "In production, each of these sections would be populated with your real agent data"

---

## Post-Demo Actions

1. Share the documentation link: `https://docs.agentops.ai`
2. Offer a trial account: "Would you like a sandbox environment to try with your own agents?"
3. Schedule a technical deep-dive: "Our engineering team can walk through the SDK integration"
