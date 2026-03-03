"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle, Loader2, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/layout/footer";

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
