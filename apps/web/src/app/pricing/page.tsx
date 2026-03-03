"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface Plan {
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  popular?: boolean;
  features: string[];
  cta: string;
  ctaVariant: "default" | "outline";
}

// ============================================================================
// PLANS DATA
// ============================================================================

const plans: Plan[] = [
  {
    name: "Starter",
    description: "For indie developers and small projects",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      "Up to 3 agents",
      "10,000 executions/month",
      "7-day data retention",
      "Basic alerting",
      "Community support",
    ],
    cta: "Get Started Free",
    ctaVariant: "outline",
  },
  {
    name: "Growth",
    description: "For growing teams with production workloads",
    monthlyPrice: 149,
    yearlyPrice: 124,
    popular: true,
    features: [
      "Up to 25 agents",
      "100,000 executions/month",
      "30-day data retention",
      "Advanced alerting (Slack, PagerDuty)",
      "Team collaboration (5 seats)",
      "Priority support",
      "Custom dashboards",
    ],
    cta: "Start Free Trial",
    ctaVariant: "default",
  },
  {
    name: "Professional",
    description: "For enterprises with compliance requirements",
    monthlyPrice: 499,
    yearlyPrice: 415,
    features: [
      "Unlimited agents",
      "Unlimited executions",
      "90-day data retention",
      "SSO & SAML",
      "SOC 2 compliance",
      "Unlimited team seats",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    ctaVariant: "outline",
  },
];

// ============================================================================
// FEATURE COMPARISON
// ============================================================================

const featureCategories = [
  {
    name: "Usage",
    features: [
      { name: "Agents", starter: "3", growth: "25", professional: "Unlimited" },
      { name: "Executions/month", starter: "10K", growth: "100K", professional: "Unlimited" },
      { name: "Data retention", starter: "7 days", growth: "30 days", professional: "90 days" },
    ],
  },
  {
    name: "Features",
    features: [
      { name: "Real-time monitoring", starter: true, growth: true, professional: true },
      { name: "Cost tracking", starter: true, growth: true, professional: true },
      { name: "Trace analysis", starter: true, growth: true, professional: true },
      { name: "Alert rules", starter: "3", growth: "25", professional: "Unlimited" },
      { name: "Custom dashboards", starter: false, growth: true, professional: true },
      { name: "API access", starter: false, growth: true, professional: true },
    ],
  },
  {
    name: "Team & Security",
    features: [
      { name: "Team seats", starter: "1", growth: "5", professional: "Unlimited" },
      { name: "SSO/SAML", starter: false, growth: false, professional: true },
      { name: "Audit logs", starter: false, growth: true, professional: true },
      { name: "SOC 2 compliance", starter: false, growth: false, professional: true },
    ],
  },
  {
    name: "Support",
    features: [
      { name: "Community support", starter: true, growth: true, professional: true },
      { name: "Email support", starter: false, growth: true, professional: true },
      { name: "Priority support", starter: false, growth: true, professional: true },
      { name: "Dedicated CSM", starter: false, growth: false, professional: true },
      { name: "SLA guarantee", starter: false, growth: false, professional: true },
    ],
  },
];

// ============================================================================
// COMPONENTS
// ============================================================================

function FeatureValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="h-4 w-4 text-emerald-500 mx-auto" />
    ) : (
      <span className="text-zinc-600">—</span>
    );
  }
  return <span className="text-sm">{value}</span>;
}

function PricingCard({ 
  plan, 
  isYearly 
}: { 
  plan: Plan; 
  isYearly: boolean;
}) {
  const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
  const savings = plan.monthlyPrice > 0 
    ? Math.round((1 - plan.yearlyPrice / plan.monthlyPrice) * 100)
    : 0;

  return (
    <Card className={cn(
      "relative flex flex-col",
      plan.popular 
        ? "border-primary shadow-lg shadow-primary/10" 
        : "border-zinc-800"
    )}>
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
            <Sparkles className="h-3 w-3" />
            Most Popular
          </span>
        </div>
      )}
      <CardHeader className="pb-4">
        <h3 className="text-xl font-semibold">{plan.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="mb-6">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">
              ${price}
            </span>
            {plan.monthlyPrice > 0 && (
              <span className="text-muted-foreground">/mo</span>
            )}
          </div>
          {isYearly && savings > 0 && (
            <p className="text-xs text-emerald-500 mt-1">
              Save {savings}% with annual billing
            </p>
          )}
          {plan.monthlyPrice === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Free forever
            </p>
          )}
        </div>

        <ul className="space-y-3 flex-1 mb-6">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              {feature}
            </li>
          ))}
        </ul>

        <Button 
          variant={plan.ctaVariant} 
          className="w-full"
          size="lg"
        >
          {plan.cta}
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            AgentOps<span className="text-primary">.</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Simple, transparent pricing
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Start free and scale as you grow. No hidden fees.
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-3 mt-8">
              <span className={cn(
                "text-sm",
                !isYearly ? "text-foreground" : "text-muted-foreground"
              )}>
                Monthly
              </span>
              <Switch
                checked={isYearly}
                onCheckedChange={setIsYearly}
                aria-label="Toggle annual billing"
              />
              <span className={cn(
                "text-sm",
                isYearly ? "text-foreground" : "text-muted-foreground"
              )}>
                Annual
              </span>
              {isYearly && (
                <span className="ml-2 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                  Save 17%
                </span>
              )}
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <PricingCard key={plan.name} plan={plan} isYearly={isYearly} />
            ))}
          </div>

          {/* Feature Comparison */}
          <div className="mt-24">
            <h2 className="text-2xl font-bold text-center mb-8">Compare plans</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-4 pr-4 font-medium">Features</th>
                    <th className="text-center py-4 px-4 font-medium w-32">Starter</th>
                    <th className="text-center py-4 px-4 font-medium w-32 bg-primary/5">Growth</th>
                    <th className="text-center py-4 px-4 font-medium w-32">Professional</th>
                  </tr>
                </thead>
                <tbody>
                  {featureCategories.map((category) => (
                    <>
                      <tr key={category.name} className="border-b border-zinc-800">
                        <td 
                          colSpan={4} 
                          className="pt-6 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                          {category.name}
                        </td>
                      </tr>
                      {category.features.map((feature) => (
                        <tr key={feature.name} className="border-b border-zinc-800/50">
                          <td className="py-3 pr-4 text-sm">{feature.name}</td>
                          <td className="py-3 px-4 text-center">
                            <FeatureValue value={feature.starter} />
                          </td>
                          <td className="py-3 px-4 text-center bg-primary/5">
                            <FeatureValue value={feature.growth} />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <FeatureValue value={feature.professional} />
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FAQ or CTA */}
          <div className="mt-24 text-center">
            <h2 className="text-2xl font-bold mb-3">Questions?</h2>
            <p className="text-muted-foreground mb-6">
              Our team is happy to help you find the right plan.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="mailto:hello@agentops.ai">
                <Button variant="outline">Contact Sales</Button>
              </Link>
              <Link href="/docs">
                <Button variant="ghost">Read Documentation</Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-8 mt-16">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span>© 2026 AgentOps. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link href="/docs" className="hover:text-foreground">Docs</Link>
            <Link href="/status" className="hover:text-foreground">Status</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
