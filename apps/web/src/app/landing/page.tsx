"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { 
  ArrowRight, 
  BarChart3, 
  Bell, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Eye, 
  GitBranch, 
  Layers, 
  LineChart, 
  Play, 
  Shield, 
  Sparkles, 
  Terminal, 
  Zap 
} from "lucide-react";

const features = [
  {
    icon: Eye,
    title: "Real-time Observability",
    description: "Watch every LLM call, tool execution, and decision in real-time with sub-second latency."
  },
  {
    icon: DollarSign,
    title: "Cost Intelligence",
    description: "Track spend per agent, model, and session. Set budgets and get alerts before overspending."
  },
  {
    icon: Shield,
    title: "Incident Detection",
    description: "Auto-detect failures, hallucinations, and anomalies before they impact users."
  },
  {
    icon: BarChart3,
    title: "Performance Analytics",
    description: "P50/P95 latencies, success rates, and trends across all your AI agents."
  },
  {
    icon: Bell,
    title: "Smart Alerting",
    description: "Slack, PagerDuty, webhooks — get notified the moment something goes wrong."
  },
  {
    icon: Layers,
    title: "Multi-Framework Support",
    description: "Works with LangChain, AutoGPT, CrewAI, custom agents, and any LLM provider."
  }
];

const metrics = [
  { value: "99.9%", label: "Uptime SLA" },
  { value: "<100ms", label: "Avg Latency" },
  { value: "50M+", label: "Events/Day" },
  { value: "500+", label: "Companies" }
];

const testimonials = [
  {
    quote: "AgentOps Observer cut our debugging time by 80%. We can now trace any issue back to the exact prompt in seconds.",
    author: "Sarah Chen",
    role: "Head of AI, TechCorp",
    avatar: "SC"
  },
  {
    quote: "The cost tracking alone paid for itself in the first week. We identified $50k/month in wasted API calls.",
    author: "Marcus Johnson",
    role: "CTO, AI Startup",
    avatar: "MJ"
  },
  {
    quote: "Finally, production-grade observability for AI agents. It's like Datadog but actually understands LLMs.",
    author: "Elena Rodriguez",
    role: "VP Engineering, Enterprise Co",
    avatar: "ER"
  }
];

const comparisonFeatures = [
  { feature: "Real-time execution tracing", agentops: true, others: false },
  { feature: "LLM-native cost tracking", agentops: true, others: false },
  { feature: "Auto incident detection", agentops: true, others: false },
  { feature: "Multi-agent correlation", agentops: true, others: false },
  { feature: "< 1% performance overhead", agentops: true, others: false },
  { feature: "SOC2 / HIPAA ready", agentops: true, others: true }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--bg-primary))]">
      {/* Navigation */}
      <nav className="border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-primary))]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-[hsl(var(--text-primary))]">AgentOps Observer</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors">Pricing</a>
            <a href="#testimonials" className="text-sm text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors">Customers</a>
            <Link href="/login" className="text-sm text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors">Log In</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="outline" size="sm">
                <Play className="w-4 h-4 mr-2" />
                Live Demo
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-[hsl(var(--accent-primary))] hover:bg-[hsl(var(--accent-primary))]/90">
                Start Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--accent-primary))]/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 py-24 md:py-32 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--accent-primary))]/10 border border-[hsl(var(--accent-primary))]/20 text-[hsl(var(--accent-primary))] text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Trusted by 500+ AI teams
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-[hsl(var(--text-primary))] leading-tight mb-6">
              Observability for{" "}
              <span className="bg-gradient-to-r from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))] bg-clip-text text-transparent">
                AI Agents
              </span>{" "}
              in Production
            </h1>
            <p className="text-xl text-[hsl(var(--text-secondary))] mb-8 max-w-2xl mx-auto">
              Monitor, debug, and optimize your AI agents with real-time tracing, 
              cost analytics, and smart alerts. Go from blind to brilliant in minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="bg-[hsl(var(--accent-primary))] hover:bg-[hsl(var(--accent-primary))]/90 text-lg px-8">
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  <Play className="w-5 h-5 mr-2" />
                  View Live Demo
                </Button>
              </Link>
            </div>
            <p className="text-sm text-[hsl(var(--text-muted))] mt-4">
              No credit card required · 14-day free trial · Setup in 5 minutes
            </p>
          </div>
        </div>

        {/* Floating metrics */}
        <div className="max-w-5xl mx-auto px-6 pb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {metrics.map((metric, i) => (
              <div key={i} className="text-center p-6 rounded-xl bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))]">
                <div className="text-3xl font-bold text-[hsl(var(--accent-primary))]">{metric.value}</div>
                <div className="text-sm text-[hsl(var(--text-muted))] mt-1">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="bg-[hsl(var(--bg-surface))] border-y border-[hsl(var(--border-subtle))]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[hsl(var(--text-primary))] mb-4">
              AI Agents Are a Black Box in Production
            </h2>
            <p className="text-lg text-[hsl(var(--text-secondary))] max-w-2xl mx-auto">
              Traditional APM tools weren't built for LLMs. You need observability that understands 
              prompts, completions, tool calls, and the unique failure modes of AI systems.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-[hsl(var(--bg-primary))] border-[hsl(var(--border-subtle))] text-center">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-full bg-[hsl(var(--error))]/10 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-6 h-6 text-[hsl(var(--error))]" />
                </div>
                <h3 className="font-semibold text-[hsl(var(--text-primary))] mb-2">Hours Lost Debugging</h3>
                <p className="text-sm text-[hsl(var(--text-muted))]">
                  Without proper tracing, finding the root cause of an agent failure can take hours instead of seconds.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[hsl(var(--bg-primary))] border-[hsl(var(--border-subtle))] text-center">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-full bg-[hsl(var(--error))]/10 flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-6 h-6 text-[hsl(var(--error))]" />
                </div>
                <h3 className="font-semibold text-[hsl(var(--text-primary))] mb-2">Runaway Costs</h3>
                <p className="text-sm text-[hsl(var(--text-muted))]">
                  A single infinite loop or verbose prompt can burn through your LLM budget before you notice.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[hsl(var(--bg-primary))] border-[hsl(var(--border-subtle))] text-center">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-full bg-[hsl(var(--error))]/10 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-6 h-6 text-[hsl(var(--error))]" />
                </div>
                <h3 className="font-semibold text-[hsl(var(--text-primary))] mb-2">Silent Failures</h3>
                <p className="text-sm text-[hsl(var(--text-muted))]">
                  Hallucinations and edge cases go unnoticed until customers complain — damaging trust.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[hsl(var(--text-primary))] mb-4">
            Everything You Need to Ship AI with Confidence
          </h2>
          <p className="text-lg text-[hsl(var(--text-secondary))] max-w-2xl mx-auto">
            Purpose-built for AI agent observability. No hacks, no workarounds.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <Card key={i} className="bg-[hsl(var(--bg-surface))] border-[hsl(var(--border-subtle))] hover:border-[hsl(var(--accent-primary))]/50 transition-colors">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-[hsl(var(--accent-primary))]/10 flex items-center justify-center mb-3">
                  <feature.icon className="w-5 h-5 text-[hsl(var(--accent-primary))]" />
                </div>
                <CardTitle className="text-[hsl(var(--text-primary))]">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-[hsl(var(--text-secondary))]">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Integration Section */}
      <section className="bg-[hsl(var(--bg-surface))] border-y border-[hsl(var(--border-subtle))]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-[hsl(var(--text-primary))] mb-4">
                One Line of Code. Full Visibility.
              </h2>
              <p className="text-lg text-[hsl(var(--text-secondary))] mb-6">
                Integrate in under 5 minutes with our lightweight SDK. Works with every major 
                AI framework and LLM provider.
              </p>
              <div className="space-y-3">
                {["LangChain & LangGraph", "OpenAI & Anthropic", "AutoGPT & CrewAI", "Custom Python agents"].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))]" />
                    <span className="text-[hsl(var(--text-primary))]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[hsl(var(--bg-primary))] rounded-xl border border-[hsl(var(--border-subtle))] p-6 font-mono text-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--error))]" />
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--warning))]" />
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--success))]" />
                <span className="text-[hsl(var(--text-muted))] ml-2">agent.py</span>
              </div>
              <pre className="text-[hsl(var(--text-secondary))] overflow-x-auto">
                <code>{`import agentops

# Initialize with your API key
agentops.init(api_key="ao_xxx")

# Your agent code works unchanged
agent = MyAgent()
result = agent.run(task)

# That's it! Full tracing enabled.`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[hsl(var(--text-primary))] mb-4">
            Built for AI, Not Retrofitted
          </h2>
          <p className="text-lg text-[hsl(var(--text-secondary))] max-w-2xl mx-auto">
            See how AgentOps Observer compares to traditional APM tools.
          </p>
        </div>
        <div className="max-w-3xl mx-auto">
          <div className="bg-[hsl(var(--bg-surface))] rounded-xl border border-[hsl(var(--border-subtle))] overflow-hidden">
            <div className="grid grid-cols-3 border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated))]">
              <div className="p-4 text-sm font-medium text-[hsl(var(--text-muted))]">Feature</div>
              <div className="p-4 text-sm font-medium text-[hsl(var(--accent-primary))] text-center">AgentOps</div>
              <div className="p-4 text-sm font-medium text-[hsl(var(--text-muted))] text-center">Others</div>
            </div>
            {comparisonFeatures.map((row, i) => (
              <div key={i} className="grid grid-cols-3 border-b border-[hsl(var(--border-subtle))] last:border-0">
                <div className="p-4 text-sm text-[hsl(var(--text-primary))]">{row.feature}</div>
                <div className="p-4 text-center">
                  {row.agentops ? (
                    <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))] mx-auto" />
                  ) : (
                    <span className="text-[hsl(var(--text-muted))]">—</span>
                  )}
                </div>
                <div className="p-4 text-center">
                  {row.others ? (
                    <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))] mx-auto" />
                  ) : (
                    <span className="text-[hsl(var(--text-muted))]">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="bg-[hsl(var(--bg-surface))] border-y border-[hsl(var(--border-subtle))]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[hsl(var(--text-primary))] mb-4">
              Loved by AI Teams Worldwide
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, i) => (
              <Card key={i} className="bg-[hsl(var(--bg-primary))] border-[hsl(var(--border-subtle))]">
                <CardContent className="pt-6">
                  <p className="text-[hsl(var(--text-secondary))] mb-6 italic">
                    "{testimonial.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))] flex items-center justify-center text-white text-sm font-medium">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-medium text-[hsl(var(--text-primary))]">{testimonial.author}</div>
                      <div className="text-sm text-[hsl(var(--text-muted))]">{testimonial.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[hsl(var(--text-primary))] mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-[hsl(var(--text-secondary))]">
            Start free, scale as you grow. No surprises.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Free Tier */}
          <Card className="bg-[hsl(var(--bg-surface))] border-[hsl(var(--border-subtle))]">
            <CardHeader>
              <CardTitle className="text-[hsl(var(--text-primary))]">Starter</CardTitle>
              <CardDescription>For side projects and experimentation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[hsl(var(--text-primary))]">$0</span>
                <span className="text-[hsl(var(--text-muted))]">/month</span>
              </div>
              <ul className="space-y-3 mb-6">
                {["10K events/month", "7-day retention", "Basic tracing", "Community support"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[hsl(var(--text-secondary))]">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <Button variant="outline" className="w-full">Get Started</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Pro Tier */}
          <Card className="bg-[hsl(var(--bg-surface))] border-[hsl(var(--accent-primary))] relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[hsl(var(--accent-primary))] text-white text-xs font-medium rounded-full">
              Most Popular
            </div>
            <CardHeader>
              <CardTitle className="text-[hsl(var(--text-primary))]">Pro</CardTitle>
              <CardDescription>For growing AI teams</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[hsl(var(--text-primary))]">$99</span>
                <span className="text-[hsl(var(--text-muted))]">/month</span>
              </div>
              <ul className="space-y-3 mb-6">
                {["1M events/month", "30-day retention", "Full tracing + alerts", "Slack integration", "Priority support"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[hsl(var(--text-secondary))]">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <Button className="w-full bg-[hsl(var(--accent-primary))] hover:bg-[hsl(var(--accent-primary))]/90">
                  Start Free Trial
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Enterprise Tier */}
          <Card className="bg-[hsl(var(--bg-surface))] border-[hsl(var(--border-subtle))]">
            <CardHeader>
              <CardTitle className="text-[hsl(var(--text-primary))]">Enterprise</CardTitle>
              <CardDescription>For large-scale deployments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[hsl(var(--text-primary))]">Custom</span>
              </div>
              <ul className="space-y-3 mb-6">
                {["Unlimited events", "1-year retention", "SSO & RBAC", "SOC2 / HIPAA", "Dedicated support"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[hsl(var(--text-secondary))]">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full">Contact Sales</Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-br from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))]">
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Stop Flying Blind with Your AI Agents
          </h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Join 500+ companies who trust AgentOps Observer to keep their AI systems 
            reliable, cost-efficient, and production-ready.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="bg-white text-[hsl(var(--accent-primary))] hover:bg-white/90 text-lg px-8">
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 text-lg px-8">
                View Live Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[hsl(var(--bg-primary))] border-t border-[hsl(var(--border-subtle))]">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-[hsl(var(--text-primary))]">AgentOps</span>
              </div>
              <p className="text-sm text-[hsl(var(--text-muted))]">
                Production-grade observability for AI agents.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-[hsl(var(--text-primary))] mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-[hsl(var(--text-muted))]">
                <li><a href="#features" className="hover:text-[hsl(var(--text-primary))]">Features</a></li>
                <li><a href="#pricing" className="hover:text-[hsl(var(--text-primary))]">Pricing</a></li>
                <li><Link href="/" className="hover:text-[hsl(var(--text-primary))]">Demo</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-[hsl(var(--text-primary))] mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-[hsl(var(--text-muted))]">
                <li><a href="#" className="hover:text-[hsl(var(--text-primary))]">Documentation</a></li>
                <li><a href="#" className="hover:text-[hsl(var(--text-primary))]">API Reference</a></li>
                <li><a href="#" className="hover:text-[hsl(var(--text-primary))]">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-[hsl(var(--text-primary))] mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-[hsl(var(--text-muted))]">
                <li><a href="#" className="hover:text-[hsl(var(--text-primary))]">About</a></li>
                <li><a href="#" className="hover:text-[hsl(var(--text-primary))]">Careers</a></li>
                <li><a href="#" className="hover:text-[hsl(var(--text-primary))]">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[hsl(var(--border-subtle))] mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-[hsl(var(--text-muted))]">
              © 2025 AgentOps. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-[hsl(var(--text-muted))]">
              <a href="#" className="hover:text-[hsl(var(--text-primary))]">Privacy</a>
              <a href="#" className="hover:text-[hsl(var(--text-primary))]">Terms</a>
              <a href="#" className="hover:text-[hsl(var(--text-primary))]">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
