/**
 * Typography scale and font configurations
 */
export const typography = {
  fontFamily: {
    sans: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'Roboto',
      'Oxygen',
      'Ubuntu',
      'Cantarell',
      'Fira Sans',
      'Droid Sans',
      'Helvetica Neue',
      'sans-serif',
    ],
    mono: [
      'JetBrains Mono',
      'Fira Code',
      'Monaco',
      'Consolas',
      'Liberation Mono',
      'Courier New',
      'monospace',
    ],
  },
  
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    '5xl': ['3rem', { lineHeight: '1' }],
    '6xl': ['3.75rem', { lineHeight: '1' }],
    '7xl': ['4.5rem', { lineHeight: '1' }],
    '8xl': ['6rem', { lineHeight: '1' }],
    '9xl': ['8rem', { lineHeight: '1' }],
  },
  
  fontWeight: {
    thin: '100',
    extralight: '200',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },
  
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
  
  lineHeight: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },
} as const;

/**
 * Text style presets
 */
export const textStyles = {
  'display-2xl': {
    fontSize: '4.5rem',
    lineHeight: '1.1',
    fontWeight: '700',
    letterSpacing: '-0.02em',
  },
  'display-xl': {
    fontSize: '3.75rem',
    lineHeight: '1.2',
    fontWeight: '700',
    letterSpacing: '-0.02em',
  },
  'display-lg': {
    fontSize: '3rem',
    lineHeight: '1.2',
    fontWeight: '600',
    letterSpacing: '-0.02em',
  },
  'display-md': {
    fontSize: '2.25rem',
    lineHeight: '1.3',
    fontWeight: '600',
    letterSpacing: '-0.02em',
  },
  'display-sm': {
    fontSize: '1.875rem',
    lineHeight: '1.4',
    fontWeight: '600',
  },
  'display-xs': {
    fontSize: '1.5rem',
    lineHeight: '1.5',
    fontWeight: '600',
  },
  'text-xl': {
    fontSize: '1.25rem',
    lineHeight: '1.5',
    fontWeight: '400',
  },
  'text-lg': {
    fontSize: '1.125rem',
    lineHeight: '1.6',
    fontWeight: '400',
  },
  'text-md': {
    fontSize: '1rem',
    lineHeight: '1.5',
    fontWeight: '400',
  },
  'text-sm': {
    fontSize: '0.875rem',
    lineHeight: '1.4',
    fontWeight: '400',
  },
  'text-xs': {
    fontSize: '0.75rem',
    lineHeight: '1.3',
    fontWeight: '400',
  },
} as const;