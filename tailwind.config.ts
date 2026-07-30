import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}', './demo/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        bg: {
          app: 'hsl(var(--bg-app))',
          surface: 'hsl(var(--bg-surface))',
          elevated: 'hsl(var(--bg-elevated))',
          soft: 'hsl(var(--bg-soft))',
        },
        text: {
          primary: 'hsl(var(--text-primary))',
          secondary: 'hsl(var(--text-secondary))',
          muted: 'hsl(var(--text-muted))',
          faint: 'hsl(var(--text-faint))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          dark: 'hsl(var(--accent-dark))',
          light: 'hsl(var(--accent-light))',
          bg: 'hsl(var(--accent-bg))',
        },
        border: {
          soft: 'hsl(var(--border-soft))',
          med: 'hsl(var(--border-med))',
          strong: 'hsl(var(--border-strong))',
        },
        status: {
          decision: 'hsl(var(--decision))',
          'decision-bg': 'hsl(var(--decision-bg))',
          doing: 'hsl(var(--doing))',
          'doing-bg': 'hsl(var(--doing-bg))',
          review: 'hsl(var(--review))',
          'review-bg': 'hsl(var(--review-bg))',
          final: 'hsl(var(--final))',
          'final-bg': 'hsl(var(--final-bg))',
        },
        role: {
          ceo: 'hsl(var(--role-ceo))',
          coo: 'hsl(var(--role-coo))',
          cmo: 'hsl(var(--role-cmo))',
          cfo: 'hsl(var(--role-cfo))',
          cco: 'hsl(var(--role-cco))',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      spacing: {
        touch: '44px',
        'sheet-handle': '36px',
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
      transitionDuration: {
        fast: '180ms',
        base: '240ms',
        sheet: '380ms',
        accordion: '360ms',
        backdrop: '320ms',
      },
      transitionTimingFunction: {
        sheet: 'cubic-bezier(0.32, 0.72, 0, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      zIndex: {
        nav: '40',
        sheet: '50',
        toast: '60',
      },
    },
  },
  plugins: [],
} satisfies Config
