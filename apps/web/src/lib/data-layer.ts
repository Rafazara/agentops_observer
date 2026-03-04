/**
 * Smart Data Layer with API Fallback
 * 
 * MODE 1 — Demo Mode (NEXT_PUBLIC_DEMO_MODE=true):
 *   Never calls API. Returns rich mock data instantly.
 * 
 * MODE 2 — API Available:
 *   Calls real API. If response comes in <3s, use it.
 * 
 * MODE 3 — API Sleeping (timeout or error):
 *   Falls back to mock data silently.
 */

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface FetchResult<T> {
  data: T;
  isLive: boolean;
  error?: string;
}

/**
 * Fetch data from API with automatic fallback to mock data
 */
export async function fetchWithFallback<T>(
  endpoint: string,
  mockData: T,
  timeout = 3000
): Promise<FetchResult<T>> {
  // Mode 1: Demo mode - always return mock data
  if (DEMO_MODE) {
    return { data: mockData, isLive: false };
  }

  // Mode 2 & 3: Try API, fallback to mock
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(`${API_URL}${endpoint}`, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    return { data, isLive: true };
  } catch (err) {
    // Mode 3: API sleeping or error - use mock data
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.log(`[DataLayer] API unavailable (${error}), using mock data`);
    return { data: mockData, isLive: false, error };
  }
}

/**
 * Check if API is available
 */
export async function checkApiHealth(timeout = 3000): Promise<boolean> {
  if (DEMO_MODE) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(`${API_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * API Status types
 */
export type ApiStatus = 'live' | 'connecting' | 'demo';

/**
 * Create a reactive API status checker
 */
export function createApiStatusChecker(
  onStatusChange: (status: ApiStatus) => void,
  checkInterval = 60000
): { start: () => void; stop: () => void; check: () => Promise<void> } {
  let intervalId: NodeJS.Timeout | null = null;

  const check = async () => {
    onStatusChange('connecting');
    const isLive = await checkApiHealth();
    onStatusChange(isLive ? 'live' : 'demo');
  };

  const start = () => {
    check();
    intervalId = setInterval(check, checkInterval);
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  return { start, stop, check };
}
