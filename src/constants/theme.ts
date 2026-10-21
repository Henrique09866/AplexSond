// ─────────────────────────────────────────────────────────────
//  Sondlize — Design System v2.0
//  Aesthetic: Spotify × Apple Music — deep dark, bold type,
//  vibrant red accent, blur overlays, generous spacing.
// ─────────────────────────────────────────────────────────────
 
import { Platform, TextStyle, ViewStyle } from 'react-native';
 
// ─── Color Palette ───────────────────────────────────────────
  
export const COLORS = {
  // Backgrounds — layered dark surfaces (OLED-safe)
  bg: {
    base:       '#0B0B0C', // fundo principal — preto quase total
    elevated:   '#111113', // sidebar — levemente acima do base
    surface:    '#18181B', // cards e superfícies padrão
    overlay:    '#202024', // superfícies elevadas / modais
    highlight:  '#29292F', // estados de hover, linhas selecionadas
    input:      '#2A2A2E', // inputs de texto, campos de busca
  },
 
  // Accent — Vermelho consistente com variantes tonais
  accent: {
    primary:    '#FF1E1E', // vermelho principal — botões, ativos, ícones
    bright:     '#FF4D4D', // hover / pressionado
    dim:        '#991B1B', // vermelho escuro — fundo do item selecionado
    muted:      '#FF1E1E33', // 20% opacidade — chips, tags, indicações
    glow:       '#FF1E1E20', // 12% — backgrounds sutis
  },
 
  // Text hierarchy
  text: {
    primary:    '#F5F5F5', // texto principal
    secondary:  '#A1A1AA', // texto secundário
    tertiary:   '#71717A', // texto terciário (muted)
    disabled:   '#52525B', // estados desabilitados
    inverse:    '#F5F5F5', // texto sobre fundo escuro/vermelho
    onAccent:   '#F5F5F5', // texto sobre botão vermelho
  },
 
  // Borders & dividers
  border: {
    subtle:     '#29292F', // separador quase invisível
    default:    '#3A3A3F', // borda padrão
    strong:     '#52525B', // foco / enfatizado
  },
 
  // Semantic colors
  semantic: {
    error:      '#F15E6C',
    errorMuted: '#F15E6C22',
    warning:    '#F59E0B',
    success:    '#FF1E1E',
    info:       '#3B82F6',
  },
 
  // Folder palette — 12 cores vibrantes (ajustadas para o tema escuro)
  folders: [
    '#FF1E1E', // vermelho (accent)
    '#E1306C', // hot pink
    '#F77737', // orange
    '#FCAF45', // amber
    '#00B4D8', // cyan
    '#4361EE', // indigo
    '#7B2FBE', // purple
    '#C77DFF', // lavender
    '#FF6B6B', // coral
    '#F43F5E', // rose
    '#FF9F1C', // gold
    '#A8DADC', // ice blue
  ],
 
  // Utility
  transparent: 'transparent',
  white:        '#FFFFFF',
  black:        '#000000',
} as const;
 
// ─── Typography ──────────────────────────────────────────────
// SF Pro (iOS) / Roboto (Android) — system fonts feel native
// and perform better than custom fonts in audio apps.
 
export const FONT_FAMILY = Platform.select({
  ios:     { regular: undefined, medium: undefined, bold: undefined },
  android: { regular: 'sans-serif', medium: 'sans-serif-medium', bold: 'sans-serif-bold' },
  default: { regular: undefined, medium: undefined, bold: undefined },
});
 
export const TYPOGRAPHY = {
  // Display — hero numbers, cover titles
  display: {
    fontSize:   32,
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: -0.8,
    lineHeight:  44,
    color:       COLORS.text.primary,
  },

  // H1 — screen titles
  h1: {
    fontSize:   28,
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: -0.5,
    lineHeight:  40,
    color:       COLORS.text.primary,
  },

  // H2 — section headers
  h2: {
    fontSize:   22,
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: -0.3,
    lineHeight:  32,
    color:       COLORS.text.primary,
  },

  // H3 — card titles, modal headers
  h3: {
    fontSize:   18,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: -0.2,
    lineHeight:  26,
    color:       COLORS.text.primary,
  },

  // Title — song names, playlist titles (large list items)
  titleLarge: {
    fontSize:   16,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: -0.1,
    lineHeight:  24,
    color:       COLORS.text.primary,
  },

  // Title — standard list items
  title: {
    fontSize:   15,
    fontWeight: '500' as TextStyle['fontWeight'],
    letterSpacing: 0,
    lineHeight:  22,
    color:       COLORS.text.primary,
  },

  // Body — descriptions, lyrics
  body: {
    fontSize:   14,
    fontWeight: '400' as TextStyle['fontWeight'],
    letterSpacing: 0,
    lineHeight:  20,
    color:       COLORS.text.secondary,
  },

  // Caption — secondary metadata (artist, duration, count)
  caption: {
    fontSize:   13,
    fontWeight: '400' as TextStyle['fontWeight'],
    letterSpacing: 0,
    lineHeight:  20,
    color:       COLORS.text.secondary,
  },

  // Label — chips, badges, tab labels
  label: {
    fontSize:   12,
    fontWeight: '500' as TextStyle['fontWeight'],
    letterSpacing: 0.2,
    lineHeight:  18,
    color:       COLORS.text.secondary,
  },

  // Overline — section category labels (ALL CAPS feel)
  overline: {
    fontSize:   11,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: 1.2,
    lineHeight:  16,
    color:       COLORS.text.tertiary,
    textTransform: 'uppercase' as TextStyle['textTransform'],
  },

  // Numeric — time codes, counts, BPM
  numeric: {
    fontSize:   13,
    fontWeight: '500' as TextStyle['fontWeight'],
    letterSpacing: 0.3,
    lineHeight:  20,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
    color:       COLORS.text.tertiary,
  },
} as const;
 
// ─── Spacing ─────────────────────────────────────────────────
// 4-point base grid — consistent, scalable
 
export const SPACING = {
  '1':   4,
  '2':   8,
  '3':  12,
  '4':  16,
  '5':  20,
  '6':  24,
  '7':  28,
  '8':  32,
  '10': 40,
  '12': 48,
  '16': 64,
  '20': 80,
 
  // Semantic aliases
  xs:    4,
  sm:    8,
  md:   16,
  lg:   24,
  xl:   32,
  '2xl': 48,
  '3xl': 64,
 
  // Component-specific
  screenPadding:      20,
  sectionGap:         32,
  cardPadding:        16,
  listItemPaddingV:   12,
  listItemPaddingH:   16,
  tabBarHeight:       60,
  miniPlayerHeight:   68,
  bottomSafeBuffer:   20,
  headerHeight:       96,
} as const;
 
// ─── Border Radius ───────────────────────────────────────────
 
export const RADIUS = {
  none:   0,
  xs:     4,
  sm:     8,
  md:    12,
  lg:    16,
  xl:    20,
  '2xl': 24,
  full:  999,
 
  // Component aliases
  button:      999, // pill-shaped
  card:         16,
  sheet:        24, // bottom sheets top corners
  coverSmall:    6,
  coverMedium:  10,
  coverLarge:   12,
  chip:        999,
  input:         8,
  avatar:      999,
} as const;
 
// ─── Shadows ─────────────────────────────────────────────────
// React Native shadows — use sparingly, only for elevation cues
 
export const SHADOWS = {
  none: {
    shadowColor:   'transparent',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius:  0,
    elevation:     0,
  } as ViewStyle,
 
  sm: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius:  4,
    elevation:     2,
  } as ViewStyle,
 
  md: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius:  12,
    elevation:     6,
  } as ViewStyle,
 
  lg: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius:  24,
    elevation:     12,
  } as ViewStyle,
 
  // Colored glow — for cover art and player screen
  accentGlow: {
    shadowColor:   COLORS.accent.primary,
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius:  20,
    elevation:     10,
  } as ViewStyle,
 
  // Floating elements (MiniPlayer, FAB)
  float: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius:  32,
    elevation:     20,
  } as ViewStyle,
} as const;
 
// ─── Animation Durations ─────────────────────────────────────
 
export const ANIMATION = {
  instant:  0,
  fast:    150,
  normal:  250,
  slow:    400,
  verySlow: 600,
 
  // Spring config (for Animated.spring)
  spring: {
    gentle: {
      tension:  40,
      friction: 10,
      useNativeDriver: true,
    },
    snappy: {
      tension:  80,
      friction: 12,
      useNativeDriver: true,
    },
    bouncy: {
      tension: 100,
      friction:  8,
      useNativeDriver: true,
    },
  },
 
  // Easing curves (for Animated.timing)
  easing: {
    // Use Easing from 'react-native' and reference these
    decelerate: 'decelerate' as const, // entrances
    accelerate: 'accelerate' as const, // exits
  },
} as const;
 
// ─── Component Dimensions ────────────────────────────────────
 
export const SIZES = {
  // Cover / Artwork
  cover: {
    xs:  36,  // mini-player, notification
    sm:  48,  // compact list item
    md:  56,  // standard list item
    lg:  64,  // large list item, folder card
    xl: 120,  // folder detail header
    '2xl': 240, // player screen
  },
 
  // Avatars (circular)
  avatar: {
    sm:  32,
    md:  40,
    lg:  56,
  },
 
  // Icons
  icon: {
    xs:  14,
    sm:  16,
    md:  20,
    lg:  24,
    xl:  28,
    '2xl': 32,
  },
 
  // Touch targets (min 44pt Apple HIG / 48dp Material)
  touchTarget: 44,
 
  // Buttons
  button: {
    heightSm:  36,
    heightMd:  48,
    heightLg:  56,
    iconButton: 40,
  },
 
  // Player controls
  player: {
    playButton:     72,
    controlButton:  44,
    sliderThumb:    14,
    waveformHeight: 48,
  },
 
  // Bottom sheets
  sheet: {
    handleWidth:  36,
    handleHeight:  4,
  },
 
  // Mini player
  miniPlayerHeight: 68,

  // Tab bar
  tabBar: {
    height:     60,
    iconSize:   22,
    activeIndicatorH: 3,
  },
} as const;
 
// ─── Z-Index Layers ──────────────────────────────────────────
 
export const Z_INDEX = {
  base:       0,
  card:       1,
  sticky:    10,
  miniPlayer: 50,
  tabBar:     60,
  modal:     100,
  overlay:   110,
  toast:     200,
} as const;
 
// ─── Blur Intensities ────────────────────────────────────────
// For expo-blur BlurView (intensity 0–100)
 
export const BLUR = {
  subtle:  30,
  medium:  60,
  strong:  85,
  max:    100,
} as const;
 
// ─── Opacity Levels ──────────────────────────────────────────
 
export const OPACITY = {
  invisible:  0,
  ghost:      0.08,
  dim:        0.3,
  muted:      0.5,
  soft:       0.7,
  visible:    1,
  disabled:   0.38, // WCAG disabled opacity
} as const;
 
// ─── Compound Theme Object ───────────────────────────────────
// Convenience export — import { THEME } and access everything
// from one object, e.g. THEME.colors.accent.primary
 
export const THEME = {
  colors:     COLORS,
  typography: TYPOGRAPHY,
  spacing:    SPACING,
  radius:     RADIUS,
  shadows:    SHADOWS,
  animation:  ANIMATION,
  sizes:      SIZES,
  zIndex:     Z_INDEX,
  blur:       BLUR,
  opacity:    OPACITY,
} as const;
 
export type Theme = typeof THEME;
 
// ─── Helpers ─────────────────────────────────────────────────
 
/**
 * Returns a folder color from the palette by index (cycles if out of range).
 * Usage: getFolderColor(folder.colorIndex)
 */
export const getFolderColor = (index: number): string =>
  COLORS.folders[index % COLORS.folders.length];
 
/**
 * Converts a hex color to rgba string with given opacity.
 * Usage: hexToRgba(COLORS.accent.primary, 0.2)  → 'rgba(29,185,84,0.2)'
 */
export const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};
 
/**
 * Returns a semi-transparent tint of a folder color for backgrounds.
 * Usage: folderTint(folder.color)  → 'rgba(r,g,b,0.15)'
 */
export const folderTint = (hex: string): string => hexToRgba(hex, 0.15);

/**
 * Darkens a hex color by multiplying each channel by `factor` (0–1).
 * Keeps the hue, just darker — used for solid folder surfaces that
 * stay readable with light text.
 * Usage: darken('#FF1200', 0.45)  → 'rgb(115,8,0)'
 */
export const darken = (hex: string, factor: number): string => {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `rgb(${r},${g},${b})`;
};
 
/**
 * Picks a contrasting text color (black or white) for a given background hex.
 * Usage: contrastText('#FF1200')  → '#FFFFFF'
 */
export const contrastText = (bgHex: string): string => {
  const r = parseInt(bgHex.slice(1, 3), 16);
  const g = parseInt(bgHex.slice(3, 5), 16);
  const b = parseInt(bgHex.slice(5, 7), 16);
  // WCAG relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? COLORS.black : COLORS.text.primary;
};
 
// ─── Legacy Compatibility ────────────────────────────────────
// Keeps old `import { THEME as OLD_THEME }` calls from breaking
// while migrating screen by screen.
 
/** @deprecated Use COLORS directly */
export const LEGACY_THEME = {
  background:    COLORS.bg.base,
  surface:       COLORS.bg.surface,
  card:          COLORS.bg.overlay,
  accent:        COLORS.accent.primary,
  textPrimary:   COLORS.text.primary,
  textSecondary: COLORS.text.secondary,
  border:        COLORS.border.default,
};
