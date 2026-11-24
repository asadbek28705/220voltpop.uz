import { useState } from 'react'
import { Button, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material'
import LanguageIcon from '@mui/icons-material/Language'
import CheckIcon from '@mui/icons-material/Check'
import { LANGS, lang, setLang, t as tr } from '../i18n'

/** Til tanlash: O'zbekcha / Русский / English */
export default function LangSwitcher() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const cur = LANGS.find((l) => l.code === lang)!
  return (
    <>
      <Button color="inherit" size="small" startIcon={<LanguageIcon fontSize="small" />} onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={tr('Til')} sx={{ minWidth: 0, height: 38, px: 1.5, border: 1, borderColor: 'divider', borderRadius: 5, fontWeight: 700 }}>
        {cur.short}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {LANGS.map((l) => (
          <MenuItem key={l.code} selected={l.code === lang} onClick={() => { setAnchor(null); if (l.code !== lang) setLang(l.code) }}>
            <ListItemIcon>{l.code === lang && <CheckIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{l.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
