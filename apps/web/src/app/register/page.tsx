"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle, Loader2, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/layout/footer";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// SVG Icons for OAuth providers
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    organization_name: "",
    organization_slug: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register } = useAuth();
  const router = useRouter();
  
  const passwordRequirements = [
    { label: "At least 8 characters", met: formData.password.length >= 8 },
    { label: "Contains a number", met: /\d/.test(formData.password) },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(formData.password) },
  ];
  
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      
      // Auto-generate slug from organization name
      if (name === "organization_name") {
        updated.organization_slug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      }
      
      return updated;
    });
  }
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    
    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    if (!passwordRequirements.every((r) => r.met)) {
      setError("Password does not meet requirements");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        organization_name: formData.organization_name,
        organization_slug: formData.organization_slug,
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Logo */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <span className="text-2xl font-bold tracking-tight">AgentOps</span>
            </div>
            <p className="text-muted-foreground text-sm">Create your account</p>
          </div>
        
        {/* Form */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
                required
                autoComplete="name"
                className={cn(
                  "w-full px-3 py-2 rounded-lg border bg-zinc-900 text-sm",
                  "border-zinc-800 focus:border-primary focus:ring-1 focus:ring-primary",
                  "outline-none transition-colors placeholder:text-muted-foreground"
                )}
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Work Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@company.com"
                required
                autoComplete="email"
                className={cn(
                  "w-full px-3 py-2 rounded-lg border bg-zinc-900 text-sm",
                  "border-zinc-800 focus:border-primary focus:ring-1 focus:ring-primary",
                  "outline-none transition-colors placeholder:text-muted-foreground"
                )}
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="organization_name" className="text-sm font-medium">
                Organization Name
              </label>
              <input
                id="organization_name"
                name="organization_name"
                type="text"
                value={formData.organization_name}
                onChange={handleChange}
                placeholder="Acme Inc"
                required
                className={cn(
                  "w-full px-3 py-2 rounded-lg border bg-zinc-900 text-sm",
                  "border-zinc-800 focus:border-primary focus:ring-1 focus:ring-primary",
                  "outline-none transition-colors placeholder:text-muted-foreground"
                )}
              />
              {formData.organization_slug && (
                <p className="text-xs text-muted-foreground">
                  Your workspace URL: <span className="text-foreground">{formData.organization_slug}.agentops.ai</span>
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className={cn(
                    "w-full px-3 py-2 pr-10 rounded-lg border bg-zinc-900 text-sm",
                    "border-zinc-800 focus:border-primary focus:ring-1 focus:ring-primary",
                    "outline-none transition-colors placeholder:text-muted-foreground"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              {/* Password requirements */}
              <div className="space-y-1.5 pt-1">
                {passwordRequirements.map((req) => (
                  <div
                    key={req.label}
                    className={cn(
                      "flex items-center gap-2 text-xs",
                      req.met ? "text-emerald-500" : "text-muted-foreground"
                    )}
                  >
                    <Check className={cn("h-3 w-3", !req.met && "opacity-0")} />
                    {req.label}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className={cn(
                  "w-full px-3 py-2 rounded-lg border bg-zinc-900 text-sm",
                  "border-zinc-800 focus:border-primary focus:ring-1 focus:ring-primary",
                  "outline-none transition-colors placeholder:text-muted-foreground",
                  formData.confirmPassword &&
                    formData.password !== formData.confirmPassword &&
                    "border-red-500"
                )}
              />
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "w-full py-2.5 rounded-lg text-sm font-medium transition-all",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center justify-center gap-2"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-zinc-900/50 px-2 text-muted-foreground">or continue with</span>
            </div>
          </div>
          
          {/* OAuth Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={`${API_URL}/api/auth/oauth/google`}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                "bg-zinc-800 hover:bg-zinc-700 border border-zinc-700",
                "text-foreground"
              )}
            >
              <GoogleIcon className="h-4 w-4" />
              Google
            </a>
            <a
              href={`${API_URL}/api/auth/oauth/github`}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                "bg-zinc-800 hover:bg-zinc-700 border border-zinc-700",
                "text-foreground"
              )}
            >
              <GitHubIcon className="h-4 w-4" />
              GitHub
            </a>
          </div>
          
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
        
        <p className="text-center text-xs text-muted-foreground">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
          {" "}and{" "}
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>.
        </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
