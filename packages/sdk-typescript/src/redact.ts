/**
 * PII Redaction
 * 
 * Utilities for redacting personally identifiable information from events.
 */

export interface RedactionConfig {
  /**
   * Enable PII redaction
   * @default false
   */
  enabled?: boolean;
  
  /**
   * Custom patterns to redact (in addition to defaults)
   */
  customPatterns?: Array<{
    name: string;
    pattern: RegExp;
    replacement?: string;
  }>;
  
  /**
   * Keys to always redact (case-insensitive)
   */
  sensitiveKeys?: string[];
}

// Default patterns for common PII
const DEFAULT_PATTERNS = [
  {
    name: "email",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: "[EMAIL REDACTED]",
  },
  {
    name: "phone",
    pattern: /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g,
    replacement: "[PHONE REDACTED]",
  },
  {
    name: "ssn",
    pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    replacement: "[SSN REDACTED]",
  },
  {
    name: "credit_card",
    pattern: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g,
    replacement: "[CC REDACTED]",
  },
  {
    name: "ip_address",
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: "[IP REDACTED]",
  },
  {
    name: "api_key",
    pattern: /\b(sk|pk|api)[_-]?[a-zA-Z0-9]{20,}\b/gi,
    replacement: "[API_KEY REDACTED]",
  },
  {
    name: "jwt",
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    replacement: "[JWT REDACTED]",
  },
  {
    name: "uuid",
    // Note: UUIDs are often not PII but can be if they're user IDs
    // This is off by default, can be enabled via customPatterns
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    replacement: "[UUID REDACTED]",
    skip: true, // Not used by default
  },
];

// Keys that should always be redacted
const DEFAULT_SENSITIVE_KEYS = [
  "password",
  "passwd",
  "secret",
  "token",
  "api_key",
  "apikey",
  "api-key",
  "authorization",
  "auth",
  "credential",
  "private_key",
  "privatekey",
  "private-key",
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
  "ssn",
  "social_security",
  "credit_card",
  "creditcard",
  "cc_number",
  "cvv",
  "pin",
];

export class PiiRedactor {
  private patterns: Array<{
    name: string;
    pattern: RegExp;
    replacement: string;
  }>;
  private sensitiveKeys: Set<string>;
  private enabled: boolean;
  
  constructor(config: RedactionConfig = {}) {
    this.enabled = config.enabled ?? false;
    
    // Combine default and custom patterns
    this.patterns = DEFAULT_PATTERNS
      .filter((p) => !(p as any).skip)
      .map((p) => ({
        name: p.name,
        pattern: p.pattern,
        replacement: p.replacement,
      }));
    
    if (config.customPatterns) {
      for (const p of config.customPatterns) {
        this.patterns.push({
          name: p.name,
          pattern: p.pattern,
          replacement: p.replacement ?? `[${p.name.toUpperCase()} REDACTED]`,
        });
      }
    }
    
    // Combine sensitive keys
    this.sensitiveKeys = new Set([
      ...DEFAULT_SENSITIVE_KEYS,
      ...(config.sensitiveKeys ?? []).map((k) => k.toLowerCase()),
    ]);
  }
  
  /**
   * Redact PII from a string
   */
  redactString(text: string): string {
    if (!this.enabled || !text) {
      return text;
    }
    
    let result = text;
    for (const { pattern, replacement } of this.patterns) {
      // Reset regex lastIndex (for global patterns)
      pattern.lastIndex = 0;
      result = result.replace(pattern, replacement);
    }
    return result;
  }
  
  /**
   * Redact PII from an object (recursively)
   */
  redact<T>(obj: T): T {
    if (!this.enabled || obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj === "string") {
      return this.redactString(obj) as T;
    }
    
    if (Array.isArray(obj)) {
      return obj.map((item) => this.redact(item)) as T;
    }
    
    if (typeof obj === "object") {
      const result: Record<string, unknown> = {};
      
      for (const [key, value] of Object.entries(obj)) {
        // Check if key should be completely redacted
        if (this.sensitiveKeys.has(key.toLowerCase())) {
          result[key] = "[REDACTED]";
        } else if (typeof value === "string") {
          result[key] = this.redactString(value);
        } else if (value !== null && typeof value === "object") {
          result[key] = this.redact(value);
        } else {
          result[key] = value;
        }
      }
      
      return result as T;
    }
    
    return obj;
  }
  
  /**
   * Check if a key is sensitive
   */
  isSensitiveKey(key: string): boolean {
    return this.sensitiveKeys.has(key.toLowerCase());
  }
  
  /**
   * Add a custom pattern at runtime
   */
  addPattern(name: string, pattern: RegExp, replacement?: string): void {
    this.patterns.push({
      name,
      pattern,
      replacement: replacement ?? `[${name.toUpperCase()} REDACTED]`,
    });
  }
  
  /**
   * Add a sensitive key at runtime
   */
  addSensitiveKey(key: string): void {
    this.sensitiveKeys.add(key.toLowerCase());
  }
  
  /**
   * Enable or disable redaction
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

/**
 * Create a singleton redactor with default configuration
 */
let defaultRedactor: PiiRedactor | null = null;

export function getDefaultRedactor(): PiiRedactor {
  if (!defaultRedactor) {
    defaultRedactor = new PiiRedactor();
  }
  return defaultRedactor;
}

export function configureRedactor(config: RedactionConfig): void {
  defaultRedactor = new PiiRedactor(config);
}
