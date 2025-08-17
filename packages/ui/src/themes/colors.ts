/**
 * Design system color palette
 */
export const colors = {
  // Primary colors
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },
  
  // Secondary colors
  secondary: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
  
  // Status colors
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16',
  },
  
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },
  
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },
  
  // Neutral colors
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },
} as const;

/**
 * Semantic color mappings for CSS variables
 */
export const semanticColors = {
  background: 'hsl(0 0% 100%)',
  foreground: 'hsl(222.2 84% 4.9%)',
  card: 'hsl(0 0% 100%)',
  'card-foreground': 'hsl(222.2 84% 4.9%)',
  popover: 'hsl(0 0% 100%)',
  'popover-foreground': 'hsl(222.2 84% 4.9%)',
  primary: 'hsl(221.2 83.2% 53.3%)',
  'primary-foreground': 'hsl(210 40% 98%)',
  secondary: 'hsl(210 40% 96%)',
  'secondary-foreground': 'hsl(222.2 84% 4.9%)',
  muted: 'hsl(210 40% 96%)',
  'muted-foreground': 'hsl(215.4 16.3% 46.9%)',
  accent: 'hsl(210 40% 96%)',
  'accent-foreground': 'hsl(222.2 84% 4.9%)',
  destructive: 'hsl(0 84.2% 60.2%)',
  'destructive-foreground': 'hsl(210 40% 98%)',
  border: 'hsl(214.3 31.8% 91.4%)',
  input: 'hsl(214.3 31.8% 91.4%)',
  ring: 'hsl(221.2 83.2% 53.3%)',
  radius: '0.5rem',
} as const;

/**
 * Dark theme color mappings
 */
export const darkSemanticColors = {
  background: 'hsl(222.2 84% 4.9%)',
  foreground: 'hsl(210 40% 98%)',
  card: 'hsl(222.2 84% 4.9%)',
  'card-foreground': 'hsl(210 40% 98%)',
  popover: 'hsl(222.2 84% 4.9%)',
  'popover-foreground': 'hsl(210 40% 98%)',
  primary: 'hsl(217.2 91.2% 59.8%)',
  'primary-foreground': 'hsl(222.2 84% 4.9%)',
  secondary: 'hsl(217.2 32.6% 17.5%)',
  'secondary-foreground': 'hsl(210 40% 98%)',
  muted: 'hsl(217.2 32.6% 17.5%)',
  'muted-foreground': 'hsl(215 20.2% 65.1%)',
  accent: 'hsl(217.2 32.6% 17.5%)',
  'accent-foreground': 'hsl(210 40% 98%)',
  destructive: 'hsl(0 62.8% 30.6%)',
  'destructive-foreground': 'hsl(210 40% 98%)',
  border: 'hsl(217.2 32.6% 17.5%)',
  input: 'hsl(217.2 32.6% 17.5%)',
  ring: 'hsl(224.3 76.3% 94.1%)',
} as const;