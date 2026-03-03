#!/usr/bin/env python3
"""
Keep-Alive Script for Render.com Free Tier

Render's free tier puts services to sleep after 15 minutes of inactivity.
This script pings the API every 14 minutes to keep it warm.

Usage Options:
1. Run locally: python keep_alive.py
2. Use GitHub Actions (see .github/workflows/keep-alive.yml)
3. Use external cron service (cron-job.org, UptimeRobot)

Environment Variables:
- API_URL: The URL of your Render deployment (required)
  Example: https://agentops-api.onrender.com
"""

import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime


def ping_service(url: str, timeout: int = 30) -> tuple[bool, str]:
    """
    Send a ping request to the service.
    
    Args:
        url: The API URL to ping
        timeout: Request timeout in seconds
    
    Returns:
        Tuple of (success, message)
    """
    ping_url = f"{url.rstrip('/')}/ping"
    
    try:
        request = urllib.request.Request(
            ping_url,
            headers={"User-Agent": "AgentOps-KeepAlive/1.0"}
        )
        
        start_time = time.time()
        with urllib.request.urlopen(request, timeout=timeout) as response:
            elapsed = time.time() - start_time
            status_code = response.status
            
            if status_code == 200:
                return True, f"OK ({elapsed:.2f}s)"
            else:
                return False, f"Unexpected status: {status_code}"
                
    except urllib.error.HTTPError as e:
        return False, f"HTTP Error: {e.code}"
    except urllib.error.URLError as e:
        return False, f"URL Error: {e.reason}"
    except Exception as e:
        return False, f"Error: {str(e)}"


def main():
    """Main entry point."""
    api_url = os.environ.get("API_URL")
    
    if not api_url:
        print("ERROR: API_URL environment variable is required")
        print("Example: API_URL=https://agentops-api.onrender.com python keep_alive.py")
        sys.exit(1)
    
    # Configuration
    interval_minutes = int(os.environ.get("PING_INTERVAL_MINUTES", "14"))
    interval_seconds = interval_minutes * 60
    max_retries = 3
    retry_delay = 10  # seconds
    
    print(f"Starting keep-alive for: {api_url}")
    print(f"Ping interval: {interval_minutes} minutes")
    print("-" * 50)
    
    while True:
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        
        # Try to ping with retries
        success = False
        for attempt in range(1, max_retries + 1):
            ok, message = ping_service(api_url)
            
            if ok:
                print(f"[{timestamp}] ✓ Ping successful: {message}")
                success = True
                break
            else:
                print(f"[{timestamp}] ✗ Attempt {attempt}/{max_retries}: {message}")
                if attempt < max_retries:
                    time.sleep(retry_delay)
        
        if not success:
            print(f"[{timestamp}] ⚠ All retries failed - service may be cold starting")
        
        # Wait for next ping
        time.sleep(interval_seconds)


if __name__ == "__main__":
    main()
