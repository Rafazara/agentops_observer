/**
 * API Client with authentication, error handling, and interceptors
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface FetchOptions extends Omit<RequestInit, "body"> {
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  skipAuth?: boolean;
}

// Token management
let accessToken: string | null = null;
let refreshToken: string | null = null;
let tokenExpiresAt: number | null = null;
let refreshPromise: Promise<void> | null = null;

export function setTokens(access: string, refresh: string, expiresIn: number) {
  accessToken = access;
  refreshToken = refresh;
  tokenExpiresAt = Date.now() + expiresIn * 1000;
  
  // Persist to localStorage for page refresh
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    localStorage.setItem("token_expires_at", String(tokenExpiresAt));
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  tokenExpiresAt = null;
  
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("token_expires_at");
  }
}

export function loadTokensFromStorage() {
  if (typeof window === "undefined") return;
  
  accessToken = localStorage.getItem("access_token");
  refreshToken = localStorage.getItem("refresh_token");
  const expiresStr = localStorage.getItem("token_expires_at");
  tokenExpiresAt = expiresStr ? parseInt(expiresStr, 10) : null;
}

export function getAccessToken() {
  return accessToken;
}

export function isAuthenticated() {
  return !!accessToken && (!tokenExpiresAt || tokenExpiresAt > Date.now());
}

// Auto-refresh token before expiry
async function ensureValidToken(): Promise<void> {
  if (!accessToken || !refreshToken || !tokenExpiresAt) return;
  
  // Refresh if token expires in less than 60 seconds
  const buffer = 60 * 1000;
  if (tokenExpiresAt - Date.now() > buffer) return;
  
  // Prevent multiple simultaneous refresh calls
  if (refreshPromise) {
    await refreshPromise;
    return;
  }
  
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setTokens(data.access_token, data.refresh_token, data.expires_in);
      } else {
        // Refresh failed - clear tokens and redirect to login
        clearTokens();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    } catch {
      // Network error during refresh
    } finally {
      refreshPromise = null;
    }
  })();
  
  await refreshPromise;
}

// Main fetch function
export async function apiClient<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, body, skipAuth, ...fetchOptions } = options;
  
  // Build URL with query params
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }
  
  // Ensure token is valid before request
  if (!skipAuth) {
    await ensureValidToken();
  }
  
  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };
  
  if (!skipAuth && accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  
  // Make request
  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  // Handle errors
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    // Handle 401 - redirect to login
    if (response.status === 401) {
      clearTokens();
      if (typeof window !== "undefined" && !skipAuth) {
        window.location.href = "/login";
      }
      throw new ApiError(401, "unauthorized", "Session expired. Please login again.");
    }
    
    // Handle 404
    if (response.status === 404) {
      throw new ApiError(404, "not_found", errorData.detail || "Resource not found");
    }
    
    // Handle 500
    if (response.status >= 500) {
      throw new ApiError(
        response.status,
        "server_error",
        "Something went wrong. Please try again."
      );
    }
    
    throw new ApiError(
      response.status,
      errorData.error || "unknown_error",
      errorData.detail || errorData.message || `HTTP error ${response.status}`,
      errorData
    );
  }
  
  // Handle empty responses
  if (response.status === 204) {
    return undefined as T;
  }
  
  return response.json();
}

// Convenience methods
export const api = {
  get: <T>(endpoint: string, params?: FetchOptions["params"]) =>
    apiClient<T>(endpoint, { method: "GET", params }),
  
  post: <T>(endpoint: string, body?: unknown, options?: Omit<FetchOptions, "body">) =>
    apiClient<T>(endpoint, { method: "POST", body, ...options }),
  
  put: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: "PUT", body }),
  
  patch: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: "PATCH", body }),
  
  delete: <T>(endpoint: string) =>
    apiClient<T>(endpoint, { method: "DELETE" }),
};

// Initialize tokens on load
if (typeof window !== "undefined") {
  loadTokensFromStorage();
}
