"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Loader2, Mail, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/layout/footer";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Failed to send reset email");
      }
      
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Logo */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <span className="text-2xl font-bold tracking-tight">AgentOps</span>
            </div>
            <p className="text-muted-foreground text-sm">Reset your password</p>
          </div>
          
          {/* Form */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-6">
            {isSuccess ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Check your email</h3>
                  <p className="text-sm text-muted-foreground">
                    We've sent a 6-digit verification code to{" "}
                    <span className="text-foreground font-medium">{email}</span>.
                    Enter the code to reset your password.
                  </p>
                </div>
                <Link
                  href={`/reset-password?email=${encodeURIComponent(email)}`}
                  className={cn(
                    "w-full py-2.5 rounded-lg text-sm font-medium transition-all",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    "flex items-center justify-center gap-2"
                  )}
                >
                  <Mail className="h-4 w-4" />
                  Enter verification code
                </Link>
                <button
                  onClick={() => {
                    setIsSuccess(false);
                    setEmail("");
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <>
                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}
                
                <div className="text-center space-y-2">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Enter your email address and we'll send you a verification code
                    to reset your password.
                  </p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      autoComplete="email"
                      autoFocus
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border bg-zinc-900 text-sm",
                        "border-zinc-800 focus:border-primary focus:ring-1 focus:ring-primary",
                        "outline-none transition-colors placeholder:text-muted-foreground"
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
                        Sending code...
                      </>
                    ) : (
                      "Send verification code"
                    )}
                  </button>
                </form>
              </>
            )}
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
            </div>
            
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
