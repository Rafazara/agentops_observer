"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Copy,
  Terminal,
  Code2,
  Loader2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useApiKeys } from "@/lib/hooks";

// ============================================================================
// CONFETTI COMPONENT (no external dependency)
// ============================================================================

function Confetti() {
  const colors = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e"];
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 2 + Math.random() * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * 360,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute w-3 h-3 animate-confetti-fall"
          style={{
            left: `${piece.left}%`,
            top: "-20px",
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            transform: `rotate(${piece.rotation}deg)`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// TYPES
// ============================================================================

type Step = 1 | 2 | 3;
type SdkTab = "python" | "typescript" | "langchain" | "openai";

// ============================================================================
// CODE SNIPPETS
// ============================================================================

const getInstallCommand = (tab: SdkTab) => {
  switch (tab) {
    case "python":
    case "langchain":
    case "openai":
      return "pip install agentops-sdk";
    case "typescript":
      return "npm install @agentops/sdk";
  }
};

const getCodeSnippet = (tab: SdkTab, apiKey: string) => {
  const key = apiKey || "YOUR_API_KEY";
  
  switch (tab) {
    case "python":
      return `from agentops import trace, init

# Initialize the SDK
init(api_key="${key}")

@trace
def my_agent(prompt: str) -> str:
    """Your agent logic here"""
    response = call_llm(prompt)
    return response

# All LLM calls inside @trace are automatically logged`;
    
    case "typescript":
      return `import { init, trace } from "@agentops/sdk";

// Initialize the SDK
init({ apiKey: "${key}" });

const myAgent = trace(async (prompt: string) => {
  // Your agent logic here
  const response = await callLLM(prompt);
  return response;
});

// All LLM calls inside trace() are automatically logged`;
    
    case "langchain":
      return `from agentops import init
from agentops.integrations.langchain import AgentOpsCallback

# Initialize the SDK
init(api_key="${key}")

# Add to your LangChain agent
agent = create_react_agent(llm, tools)
agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    callbacks=[AgentOpsCallback()]  # Auto-traces everything
)`;
    
    case "openai":
      return `from agentops import init, trace
import openai

# Initialize the SDK - auto-patches OpenAI
init(api_key="${key}")

@trace
def my_agent(prompt: str) -> str:
    # OpenAI calls are automatically logged
    response = openai.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content`;
  }
};

// ============================================================================
// COMPONENTS
// ============================================================================

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 rounded-full transition-all duration-300",
            i + 1 === current
              ? "w-8 bg-primary"
              : i + 1 < current
              ? "w-2 bg-primary"
              : "w-2 bg-zinc-700"
          )}
        />
      ))}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-8 gap-1.5 text-xs"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Copy
        </>
      )}
    </Button>
  );
}

function CodeBlock({ code, language = "python" }: { code: string; language?: string }) {
  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
      <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-x-auto">
        <code className="text-sm font-mono text-zinc-300">{code}</code>
      </pre>
      <div className="absolute bottom-2 right-2 text-[10px] uppercase text-zinc-600 font-medium">
        {language}
      </div>
    </div>
  );
}

function PulsingDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

function Step1Install({ 
  apiKey, 
  onNext 
}: { 
  apiKey: string; 
  onNext: () => void;
}) {
  const [selectedTab, setSelectedTab] = useState<SdkTab>("python");
  const installCmd = getInstallCommand(selectedTab);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-4">
          <Terminal className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold">Install the SDK</h2>
        <p className="text-muted-foreground mt-2">
          Takes about 30 seconds — one command gets you started
        </p>
      </div>

      {/* SDK Tabs */}
      <div className="flex justify-center gap-2">
        {(["python", "typescript", "langchain", "openai"] as const).map((tab) => (
          <Button
            key={tab}
            variant={selectedTab === tab ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedTab(tab)}
            className="capitalize"
          >
            {tab === "langchain" ? "LangChain" : tab === "openai" ? "OpenAI" : tab}
          </Button>
        ))}
      </div>

      {/* Install Command */}
      <Card className="border-zinc-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Install Command
            </span>
            <CopyButton text={installCmd} />
          </div>
          <code className="text-lg font-mono text-emerald-400">{installCmd}</code>
        </CardContent>
      </Card>

      {/* API Key */}
      <Card className="border-zinc-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Your API Key
            </span>
            <CopyButton text={apiKey} />
          </div>
          <code className="text-lg font-mono text-zinc-300">
            {apiKey || "No API key found — create one in Settings"}
          </code>
        </CardContent>
      </Card>

      <div className="flex justify-center pt-4">
        <Button onClick={onNext} size="lg" className="gap-2">
          Next: Instrument Your Agent
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Step2Instrument({ 
  apiKey, 
  onNext, 
  onBack 
}: { 
  apiKey: string; 
  onNext: () => void; 
  onBack: () => void;
}) {
  const [selectedTab, setSelectedTab] = useState<SdkTab>("python");
  const code = getCodeSnippet(selectedTab, apiKey);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-4">
          <Code2 className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold">Instrument Your First Agent</h2>
        <p className="text-muted-foreground mt-2">
          Add the @trace decorator — about 2 minutes
        </p>
      </div>

      {/* SDK Tabs */}
      <div className="flex justify-center gap-2">
        {(["python", "typescript", "langchain", "openai"] as const).map((tab) => (
          <Button
            key={tab}
            variant={selectedTab === tab ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedTab(tab)}
            className="capitalize"
          >
            {tab === "langchain" ? "LangChain" : tab === "openai" ? "OpenAI" : tab}
          </Button>
        ))}
      </div>

      {/* Code Snippet */}
      <CodeBlock 
        code={code} 
        language={selectedTab === "typescript" ? "typescript" : "python"} 
      />

      <div className="flex justify-center gap-3 pt-4">
        <Button variant="outline" onClick={onBack} size="lg" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} size="lg" className="gap-2">
          I&apos;ve Added the Code
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Step3Waiting({ 
  onBack, 
  onSkip,
  onSuccess,
}: { 
  onBack: () => void; 
  onSkip: () => void;
  onSuccess: () => void;
}) {
  const [isSuccess, setIsSuccess] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Simulate waiting for first execution (in real app, use WebSocket)
  useEffect(() => {
    // Check for real executions via polling or WebSocket
    // For demo, we'll just provide manual controls
  }, []);

  const handleTestSuccess = useCallback(() => {
    setIsSuccess(true);
    setShowConfetti(true);
    setTimeout(() => {
      onSuccess();
    }, 3000);
  }, [onSuccess]);

  if (isSuccess) {
    return (
      <div className="space-y-6 animate-fade-in text-center">
        {showConfetti && <Confetti />}
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/20 mb-4">
          <Sparkles className="h-8 w-8 text-emerald-400" />
        </div>
        <h2 className="text-3xl font-semibold">🎉 Your First Agent is Live!</h2>
        <p className="text-muted-foreground">
          Execution received — redirecting to dashboard...
        </p>
        <div className="flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-4">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
        <h2 className="text-2xl font-semibold">Waiting for First Execution...</h2>
        <p className="text-muted-foreground mt-2">
          Run your instrumented agent and we&apos;ll detect it automatically
        </p>
      </div>

      {/* Waiting Animation */}
      <Card className="border-zinc-800 border-dashed">
        <CardContent className="p-8 flex flex-col items-center justify-center">
          <PulsingDots />
          <p className="text-sm text-muted-foreground mt-4">
            Listening for incoming executions...
          </p>
        </CardContent>
      </Card>

      {/* Debug: Manual success trigger for demos */}
      <div className="text-center">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleTestSuccess}
          className="text-xs"
        >
          (Demo: Simulate execution received)
        </Button>
      </div>

      <div className="flex justify-center gap-3 pt-4">
        <Button variant="outline" onClick={onBack} size="lg" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button variant="ghost" onClick={onSkip} size="lg" className="gap-2">
          <SkipForward className="h-4 w-4" />
          Skip — Use Demo Data
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const { data: apiKeysData } = useApiKeys();
  
  // Get the first API key if available
  const apiKey = apiKeysData?.[0]?.key_prefix 
    ? `${apiKeysData[0].key_prefix}...` 
    : "";

  const handleComplete = () => {
    localStorage.setItem("agentops_onboarding_complete", "true");
    router.push("/dashboard");
  };

  const handleSkip = () => {
    localStorage.setItem("agentops_onboarding_skipped", "true");
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-semibold tracking-tight">
            AgentOps<span className="text-primary">.</span>
          </Link>
          <StepIndicator current={step} total={3} />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {step === 1 && (
            <Step1Install 
              apiKey={apiKey} 
              onNext={() => setStep(2)} 
            />
          )}
          {step === 2 && (
            <Step2Instrument 
              apiKey={apiKey}
              onNext={() => setStep(3)} 
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step3Waiting 
              onBack={() => setStep(2)}
              onSkip={handleSkip}
              onSuccess={handleComplete}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span>Step {step} of 3</span>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="hover:text-foreground transition-colors">
              Documentation
            </Link>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Skip Setup
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
