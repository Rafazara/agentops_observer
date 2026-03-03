"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, setTokens, clearTokens, isAuthenticated, loadTokensFromStorage, ApiError } from "./api-client";
import type { User, LoginRequest, RegisterRequest, LoginResponse, RegisterResponse } from "./types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  // Check authentication on mount
  useEffect(() => {
    loadTokensFromStorage();
    
    async function checkAuth() {
      if (!isAuthenticated()) {
        setIsLoading(false);
        return;
      }
      
      try {
        const userData = await api.get<User>("/api/v1/auth/me");
        setUser(userData);
      } catch (err) {
        // Token invalid - clear and redirect
        clearTokens();
      } finally {
        setIsLoading(false);
      }
    }
    
    checkAuth();
  }, []);
  
  const login = useCallback(async (credentials: LoginRequest) => {
    setError(null);
    setIsLoading(true);
    
    try {
      const response = await api.post<LoginResponse>("/api/v1/auth/login", credentials, { skipAuth: true });
      setTokens(response.access_token, response.refresh_token, response.expires_in);
      
      // Fetch user data
      const userData = await api.get<User>("/api/v1/auth/me");
      setUser(userData);
      
      router.push("/");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Login failed. Please try again.";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [router]);
  
  const register = useCallback(async (data: RegisterRequest) => {
    setError(null);
    setIsLoading(true);
    
    try {
      await api.post<RegisterResponse>("/api/v1/auth/register", data, { skipAuth: true });
      
      // Auto-login after registration
      await login({ email: data.email, password: data.password });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Registration failed. Please try again.";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [login]);
  
  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    router.push("/login");
  }, [router]);
  
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// HOC for protected routes
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function ProtectedRoute(props: P) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    
    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.push("/login");
      }
    }, [isLoading, isAuthenticated, router]);
    
    if (isLoading) {
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      );
    }
    
    if (!isAuthenticated) {
      return null;
    }
    
    return <Component {...props} />;
  };
}
