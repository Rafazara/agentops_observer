"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Loader2, CheckCircle, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/layout/footer";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [step, setStep] = useState<"code" | "password">("code");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // Password validation
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    match: password === confirmPassword && password.length > 0,
  };
  
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);
  
  // Handle code input
  function handleCodeChange(index: number, value: string) {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const newCode = [...code];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit;
        }
      });
      setCode(newCode);
      
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      const digit = value.replace(/\D/g, "");
      const newCode = [...code];
      newCode[index] = digit;
      setCode(newCode);
      
      if (digit && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  }
  
  function handleCodeKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }
  
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    
    const codeString = code.join("");
    
    if (codeString.length !== 6) {
      setError("Please enter the complete 6-digit code");
      setIsSubmitting(false);
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-reset-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code: codeString }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Invalid or expired code");
      }
      
      setToken(data.token);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
      // Clear code on error
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }
  
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    
    if (!isPasswordValid) {
      setError("Please ensure your password meets all requirements");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          token, 
          new_password: password 
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Failed to reset password");
      }
      
      setIsSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-950">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-8 animate-fade-in">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 space-y-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle className="h-10 w-10 text-emerald-500" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">Password reset successful!</h3>
                  <p className="text-sm text-muted-foreground">
                    Your password has been reset successfully. You will be redirected
                    to the login page in a few seconds.
                  </p>
                </div>
                <Link
                  href="/login"
                  className={cn(
                    "w-full py-2.5 rounded-lg text-sm font-medium transition-all",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    "flex items-center justify-center gap-2"
                  )}
                >
                  Go to login
                </Link>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
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
            <p className="text-muted-foreground text-sm">
              {step === "code" ? "Enter verification code" : "Create new password"}
            </p>
          </div>
          
          {/* Form */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-6">
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            
            {step === "code" ? (
              <>
                <div className="text-center space-y-2">
                  <ShieldCheck className="h-12 w-12 mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code we sent to{" "}
                    <span className="text-foreground font-medium">{email || "your email"}</span>
                  </p>
                </div>
                
                {!email && (
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
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border bg-zinc-900 text-sm",
                        "border-zinc-800 focus:border-primary focus:ring-1 focus:ring-primary",
                        "outline-none transition-colors placeholder:text-muted-foreground"
                      )}
                    />
                  </div>
                )}
                
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Verification code</label>
                    <div className="flex gap-2 justify-center">
                      {code.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => { inputRefs.current[index] = el }}
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={digit}
                          onChange={(e) => handleCodeChange(index, e.target.value)}
                          onKeyDown={(e) => handleCodeKeyDown(index, e)}
                          className={cn(
                            "w-12 h-14 text-center text-xl font-mono font-bold rounded-lg border bg-zinc-900",
                            "border-zinc-800 focus:border-primary focus:ring-1 focus:ring-primary",
                            "outline-none transition-colors"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isSubmitting || code.some((d) => !d)}
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
                        Verifying...
                      </>
                    ) : (
                      "Verify code"
                    )}
                  </button>
                </form>
                
                <p className="text-center text-sm text-muted-foreground">
                  Didn't receive the code?{" "}
                  <Link href="/forgot-password" className="text-primary font-medium hover:underline">
                    Send again
                  </Link>
                </p>
              </>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoFocus
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
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={cn(
                      "w-full px-3 py-2 rounded-lg border bg-zinc-900 text-sm",
                      "border-zinc-800 focus:border-primary focus:ring-1 focus:ring-primary",
                      "outline-none transition-colors placeholder:text-muted-foreground"
                    )}
                  />
                </div>
                
                {/* Password requirements */}
                <div className="space-y-2 text-xs">
                  <p className="font-medium text-muted-foreground">Password requirements:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className={cn("flex items-center gap-1.5", passwordChecks.length ? "text-emerald-500" : "text-muted-foreground")}>
                      <div className={cn("h-1.5 w-1.5 rounded-full", passwordChecks.length ? "bg-emerald-500" : "bg-zinc-600")} />
                      8+ characters
                    </div>
                    <div className={cn("flex items-center gap-1.5", passwordChecks.uppercase ? "text-emerald-500" : "text-muted-foreground")}>
                      <div className={cn("h-1.5 w-1.5 rounded-full", passwordChecks.uppercase ? "bg-emerald-500" : "bg-zinc-600")} />
                      1 uppercase
                    </div>
                    <div className={cn("flex items-center gap-1.5", passwordChecks.number ? "text-emerald-500" : "text-muted-foreground")}>
                      <div className={cn("h-1.5 w-1.5 rounded-full", passwordChecks.number ? "bg-emerald-500" : "bg-zinc-600")} />
                      1 number
                    </div>
                    <div className={cn("flex items-center gap-1.5", passwordChecks.match ? "text-emerald-500" : "text-muted-foreground")}>
                      <div className={cn("h-1.5 w-1.5 rounded-full", passwordChecks.match ? "bg-emerald-500" : "bg-zinc-600")} />
                      Passwords match
                    </div>
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={isSubmitting || !isPasswordValid}
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
                      Resetting password...
                    </>
                  ) : (
                    "Reset password"
                  )}
                </button>
              </form>
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
