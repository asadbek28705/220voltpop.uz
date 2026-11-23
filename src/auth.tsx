import { createContext, useContext } from 'react'

export interface User { id: string; name: string; login: string; role: 'admin' | 'seller'; active: boolean }
export interface Me { user: User | null; demo: boolean; needsSetup: boolean; canSetup: boolean }

export const MeContext = createContext<Me>({ user: null, demo: false, needsSetup: false, canSetup: false })
export const useMe = () => useContext(MeContext)
/** Egasi (admin) — tannarx, foyda, xarajatlar, sozlamalarni ko'radi */
export const useIsAdmin = () => useContext(MeContext).user?.role === 'admin'
