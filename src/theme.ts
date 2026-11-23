import { alpha, createTheme } from '@mui/material'

export const GREEN = '#2E9E5B'
export const YELLOW = '#F5C518'

export function makeTheme(mode: 'light' | 'dark') {
  const dark = mode === 'dark'
  const hoverBg = dark ? alpha(YELLOW, 0.18) : '#FFF5CC'
  const hoverText = dark ? YELLOW : '#8A6A00'
  const border = dark ? '#2a2f37' : '#E8EAED'

  return createTheme({
    palette: {
      mode,
      primary: { main: GREEN, contrastText: '#fff' },
      secondary: { main: YELLOW, contrastText: '#1a1a1a' },
      background: { default: dark ? '#0f1115' : '#F5F6F8', paper: dark ? '#171a20' : '#fff' },
      divider: border,
      action: { hover: hoverBg },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      button: { textTransform: 'none', fontWeight: 600 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700, fontSize: '1.05rem' },
    },
    components: {
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: 'none' }, outlined: { borderColor: border } },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: { root: { borderColor: border, transition: 'border-color .15s', '&:hover': { borderColor: YELLOW } } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: 'background-color .15s, color .15s, border-color .15s',
            '&:hover': { backgroundColor: YELLOW, color: '#1a1a1a', borderColor: YELLOW },
          },
          outlined: { borderColor: border, color: dark ? '#e6e6e6' : '#1f2937' },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { '&:hover': { backgroundColor: hoverBg, color: hoverText } } },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            '&:hover': { backgroundColor: hoverBg, color: hoverText },
            '&:hover .MuiListItemIcon-root': { color: hoverText },
            '&.Mui-selected': { backgroundColor: alpha(GREEN, dark ? 0.25 : 0.14), color: GREEN, fontWeight: 600 },
            '&.Mui-selected .MuiListItemIcon-root': { color: GREEN },
            '&.Mui-selected:hover': { backgroundColor: hoverBg, color: hoverText },
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: { root: { '&:hover, &.Mui-focusVisible': { backgroundColor: hoverBg } } },
      },
      MuiAutocomplete: {
        styleOverrides: { option: { '&:hover, &.Mui-focused': { backgroundColor: `${hoverBg} !important` } } },
      },
      MuiTableRow: {
        styleOverrides: { root: { '&.MuiTableRow-hover:hover': { backgroundColor: hoverBg } } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: border },
          head: { fontWeight: 600, color: dark ? '#9aa1ab' : '#6b7280', backgroundColor: dark ? '#1c2027' : '#FAFAFB' },
        },
      },
      MuiToggleButton: {
        styleOverrides: { root: { textTransform: 'none', fontWeight: 600, '&:hover': { backgroundColor: hoverBg, color: hoverText } } },
      },
      MuiOutlinedInput: {
        styleOverrides: { root: { borderRadius: 10, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: YELLOW } } },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
    },
  })
}
