/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        /* Background hierarchy */
        "bg-base": "hsl(var(--bg-base))",
        "bg-surface": "hsl(var(--bg-surface))",
        "bg-elevated": "hsl(var(--bg-elevated))",
        "bg-hover": "hsl(var(--bg-hover))",
        "bg-selected": "hsl(var(--bg-selected))",
        
        /* Border hierarchy */
        "border-subtle": "hsl(var(--border-subtle))",
        "border-default": "hsl(var(--border-default))",
        "border-strong": "hsl(var(--border-strong))",
        
        /* Text hierarchy */
        "text-primary": "hsl(var(--text-primary))",
        "text-secondary": "hsl(var(--text-secondary))",
        "text-muted": "hsl(var(--text-muted))",
        "text-disabled": "hsl(var(--text-disabled))",
        
        /* Legacy compatibility + new system */
        border: "hsl(var(--border-default))",
        input: "hsl(var(--bg-surface))",
        ring: "hsl(var(--primary))",
        background: "hsl(var(--bg-base))",
        foreground: "hsl(var(--text-primary))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "white",
          hover: "hsl(var(--primary-hover))",
        },
        secondary: {
          DEFAULT: "hsl(var(--bg-surface))",
          foreground: "hsl(var(--text-primary))",
        },
        destructive: {
          DEFAULT: "hsl(var(--error))",
          foreground: "white",
        },
        muted: {
          DEFAULT: "hsl(var(--bg-hover))",
          foreground: "hsl(var(--text-muted))",
        },
        accent: {
          DEFAULT: "hsl(var(--bg-selected))",
          foreground: "hsl(var(--text-primary))",
        },
        popover: {
          DEFAULT: "hsl(var(--bg-elevated))",
          foreground: "hsl(var(--text-primary))",
        },
        card: {
          DEFAULT: "hsl(var(--bg-surface))",
          foreground: "hsl(var(--text-primary))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "white",
          subtle: "hsl(var(--success-subtle))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--bg-base))",
          subtle: "hsl(var(--warning-subtle))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          foreground: "white",
          subtle: "hsl(var(--error-subtle))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "white",
          subtle: "hsl(var(--info-subtle))",
        },
        /* Chart colors */
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        pulse: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.5 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
