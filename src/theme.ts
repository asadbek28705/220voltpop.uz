import { alpha, createTheme } from '@mui/material'

// Brend ranglari: zumrad yashil + oltin
export const GREEN = '#16A363'
export const GREEN_DARK = '#0E7C4A'
export const YELLOW = '#F2B705'
export const GOLD = '#D4A017'
export const INK = '#0B1220' // yon menyu foni

export const GRADIENT = `linear-gradient(135deg, #1DBF74 0%, ${GREEN} 45%, ${GREEN_DARK} 100%)`
export const GOLD_GRADIENT = 'linear-gradient(135deg, #FFD54A 0%, #F2B705 50%, #C98E00 100%)'

export const FONT = '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

export function makeTheme(mode: 'light' | 'dark') {
  const dark = mode === 'dark'
  const border = dark ? 'rgba(255,255,255,0.07)' : '#E7EAF0'
  const paper = dark ? '#141A24' : '#FFFFFF'
  const hoverBg = dark ? alpha(GREEN, 0.14) : alpha(GREEN, 0.07)
  const shadow = dark
    ? '0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.25)'
    : '0 1px 2px rgba(16,24,40,.04), 0 6px 20px rgba(16,24,40,.06)'
  const shadowHover = dark
    ? '0 2px 4px rgba(0,0,0,.45), 0 14px 32px rgba(0,0,0,.35)'
    : '0 2px 4px rgba(16,24,40,.05), 0 14px 32px rgba(16,24,40,.10)'

  return createTheme({
    palette: {
      mode,
      primary: { main: GREEN, dark: GREEN_DARK, contrastText: '#fff' },
      secondary: { main: YELLOW, contrastText: '#1a1a1a' },
      error: { main: '#E5484D' },
      warning: { main: '#F08C00' },
      info: { main: '#3B82F6' },
      success: { main: GREEN },
      background: { default: dark ? '#0A0E15' : '#F3F5F9', paper },
      divider: border,
      text: dark ? { primary: '#E8ECF2', secondary: '#8A94A6' } : { primary: '#0F172A', secondary: '#64748B' },
      action: { hover: hoverBg, selected: alpha(GREEN, dark ? 0.2 : 0.1) },
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: FONT,
      button: { textTransform: 'none', fontWeight: 700, letterSpacing: 0.1 },
      h4: { fontWeight: 800, letterSpacing: -0.5 },
      h5: { fontWeight: 800, letterSpacing: -0.3 },
      h6: { fontWeight: 700, fontSize: '1.05rem', letterSpacing: -0.1 },
      body2: { fontSize: '0.875rem' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: { body: { fontFeatureSettings: '"tnum" 1' } },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: border },
        },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: {
            borderRadius: 18, borderColor: border, boxShadow: shadow,
            transition: 'box-shadow .2s ease, transform .2s ease, border-color .2s ease',
            '&:hover': { boxShadow: shadowHover },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 12, paddingInline: 18, transition: 'all .18s ease' },
          sizeSmall: { borderRadius: 10, paddingInline: 12 },
          sizeLarge: { borderRadius: 14 },
          containedPrimary: {
            background: GRADIENT, boxShadow: `0 6px 16px ${alpha(GREEN, 0.32)}`,
            '&:hover': { background: GRADIENT, filter: 'brightness(1.07)', boxShadow: `0 8px 22px ${alpha(GREEN, 0.42)}`, transform: 'translateY(-1px)' },
            '&.Mui-disabled': { background: dark ? '#252c38' : '#E5E9F0', boxShadow: 'none' },
          },
          containedSecondary: {
            background: GOLD_GRADIENT, color: '#1a1300', boxShadow: `0 6px 16px ${alpha(YELLOW, 0.35)}`,
            '&:hover': { background: GOLD_GRADIENT, filter: 'brightness(1.05)', transform: 'translateY(-1px)' },
          },
          containedWarning: { boxShadow: `0 6px 16px ${alpha('#F08C00', 0.3)}` },
          outlined: {
            borderColor: border, color: dark ? '#E8ECF2' : '#0F172A', backgroundColor: paper,
            '&:hover': { borderColor: alpha(GREEN, 0.5), backgroundColor: hoverBg },
          },
          text: { '&:hover': { backgroundColor: hoverBg } },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { transition: 'all .15s ease', '&:hover': { backgroundColor: hoverBg, color: GREEN } } },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            '&:hover': { backgroundColor: hoverBg },
            '&.Mui-selected': { backgroundColor: alpha(GREEN, dark ? 0.2 : 0.1), color: GREEN, fontWeight: 700 },
            '&.Mui-selected .MuiListItemIcon-root': { color: GREEN },
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: { root: { borderRadius: 8, marginInline: 6, '&:hover, &.Mui-focusVisible': { backgroundColor: hoverBg } } },
      },
      MuiMenu: { styleOverrides: { paper: { borderRadius: 14, border: `1px solid ${border}`, boxShadow: shadowHover } } },
      MuiAutocomplete: {
        styleOverrides: {
          paper: { borderRadius: 14, border: `1px solid ${border}`, boxShadow: shadowHover },
          option: { borderRadius: 8, marginInline: 6, '&:hover, &.Mui-focused': { backgroundColor: `${hoverBg} !important` } },
        },
      },
      MuiTableRow: {
        styleOverrides: { root: { '&.MuiTableRow-hover:hover': { backgroundColor: hoverBg } } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: border },
          head: {
            fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6,
            color: dark ? '#8A94A6' : '#64748B', backgroundColor: dark ? '#111722' : '#F8FAFC',
          },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: { root: { backgroundColor: dark ? '#0F141C' : '#F1F4F8', borderRadius: 12, padding: 3, gap: 3 }, grouped: { border: 0, borderRadius: '10px !important' } },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none', fontWeight: 700, border: 0, color: dark ? '#8A94A6' : '#64748B',
            '&:hover': { backgroundColor: hoverBg },
            '&.Mui-selected': { backgroundColor: paper, boxShadow: '0 1px 3px rgba(16,24,40,.12)' },
            '&.Mui-selected:hover': { backgroundColor: paper },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12, backgroundColor: dark ? '#0F141C' : '#fff',
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(GREEN, 0.5) },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2, boxShadow: `0 0 0 4px ${alpha(GREEN, 0.12)}` },
          },
          notchedOutline: { borderColor: border },
        },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 700, borderRadius: 9 } } },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 22, border: `1px solid ${border}`, boxShadow: '0 24px 64px rgba(0,0,0,.25)' } },
      },
      MuiDialogTitle: { styleOverrides: { root: { fontWeight: 800, fontSize: '1.2rem' } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: 12 } } },
      MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 8, fontWeight: 600, backgroundColor: INK } } },
      MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 700 } } },
    },
  })
}
