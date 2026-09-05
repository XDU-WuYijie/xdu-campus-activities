import { createContext } from 'react'
import type { SessionUser } from './authSession'

export type AuthStatus =
  | 'anonymous'
  | 'authenticated'
  | 'checking'
  | 'error'

export interface AuthContextValue {
  currentUser: SessionUser | null
  establishSession: (token: string) => Promise<SessionUser>
  logout: () => Promise<void>
  restoreSession: () => Promise<SessionUser | null>
  status: AuthStatus
  token: string | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)
