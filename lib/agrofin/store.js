'use client'
import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { v4 as uuid } from 'uuid'

const TOKEN_KEY = 'agrofin_token_v1'

const emptyData = () => ({
  accounts: [], incomes: [], expenses: [], crops: [], loans: [], peers: [], assets: [],
})

const StoreContext = createContext(null)

const api = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export function StoreProvider({ children }) {
  const [token, setToken] = useState(null)
  const [me, setMe] = useState(null)            // logged-in user
  const [managingUserId, setManagingUserId] = useState(null) // admin impersonation
  const [managingUser, setManagingUser] = useState(null)
  const [data, setData] = useState(emptyData())
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const saveTimer = useRef(null)
  const skipNextSave = useRef(true)

  // hydrate token
  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
    if (t) setToken(t)
    else setLoading(false)
  }, [])

  // validate token + load me
  useEffect(() => {
    if (!token) return
    api('/auth/me', { token })
      .then(({ user }) => { setMe(user) })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setToken(null); setMe(null); setLoading(false) })
  }, [token])

  // load data for active user (self or impersonated)
  const activeUserId = managingUserId || me?.id
  useEffect(() => {
    if (!token || !me) return
    setLoading(true)
    skipNextSave.current = true
    api('/data?userId=' + activeUserId, { token })
      .then(({ data }) => { setData({ ...emptyData(), ...data }) })
      .catch((e) => console.error('load data', e))
      .finally(() => setLoading(false))
  }, [token, me, activeUserId])

  // debounced save
  useEffect(() => {
    if (!token || !me || loading) return
    if (skipNextSave.current) { skipNextSave.current = false; return }
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      api('/data?userId=' + activeUserId, { method: 'PUT', body: { data }, token })
        .catch(e => console.error('save', e))
    }, 500)
  }, [data, token, me, loading, activeUserId])

  // load users list if admin
  useEffect(() => {
    if (!token || me?.role !== 'admin') return
    api('/users', { token }).then(({ users }) => setUsers(users)).catch(() => {})
  }, [token, me])

  const login = useCallback(async (username, password) => {
    setAuthError('')
    try {
      const { token: t, user } = await api('/auth/login', { method: 'POST', body: { username, password } })
      localStorage.setItem(TOKEN_KEY, t)
      setToken(t); setMe(user)
    } catch (e) { setAuthError(e.message); throw e }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null); setMe(null); setManagingUserId(null); setManagingUser(null); setData(emptyData()); setUsers([])
  }, [])

  const manageAs = useCallback((userId) => {
    if (!userId || userId === me?.id) {
      setManagingUserId(null); setManagingUser(null)
    } else {
      setManagingUserId(userId)
      const u = users.find(x => x.id === userId)
      setManagingUser(u || null)
    }
  }, [me, users])

  // user management (admin)
  const refreshUsers = useCallback(async () => {
    const { users } = await api('/users', { token })
    setUsers(users)
  }, [token])

  const createUser = useCallback(async (payload) => {
    await api('/users', { method: 'POST', body: payload, token })
    await refreshUsers()
  }, [token, refreshUsers])

  const patchUser = useCallback(async (id, patch) => {
    await api('/users/' + id, { method: 'PATCH', body: patch, token })
    await refreshUsers()
  }, [token, refreshUsers])

  const deleteUser = useCallback(async (id) => {
    await api('/users/' + id, { method: 'DELETE', token })
    if (managingUserId === id) { setManagingUserId(null); setManagingUser(null) }
    await refreshUsers()
  }, [token, refreshUsers, managingUserId])

  // data mutators (local optimistic)
  const add = useCallback((collection, item) => {
    setData(s => ({ ...s, [collection]: [{ id: uuid(), ...item }, ...(s[collection] || [])] }))
  }, [])
  const update = useCallback((collection, id, patch) => {
    setData(s => ({ ...s, [collection]: (s[collection] || []).map(x => x.id === id ? { ...x, ...patch } : x) }))
  }, [])
  const remove = useCallback((collection, id) => {
    setData(s => ({ ...s, [collection]: (s[collection] || []).filter(x => x.id !== id) }))
  }, [])
  const addLoanTx = useCallback((loanId, tx) => {
    setData(s => ({
      ...s,
      loans: (s.loans || []).map(l => l.id === loanId ? { ...l, txs: [...(l.txs || []), { id: uuid(), ...tx }] } : l)
    }))
  }, [])
  const removeLoanTx = useCallback((loanId, txId) => {
    setData(s => ({
      ...s,
      loans: (s.loans || []).map(l => l.id === loanId ? { ...l, txs: (l.txs || []).filter(t => t.id !== txId) } : l)
    }))
  }, [])

  const value = useMemo(() => ({
    token, me, managingUser, managingUserId, activeUserId,
    state: data, setState: setData,
    add, update, remove, addLoanTx, removeLoanTx,
    login, logout, authError, loading,
    users, refreshUsers, createUser, patchUser, deleteUser, manageAs,
  }), [token, me, managingUser, managingUserId, activeUserId, data, add, update, remove, addLoanTx, removeLoanTx, login, logout, authError, loading, users, refreshUsers, createUser, patchUser, deleteUser, manageAs])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be inside StoreProvider')
  return ctx
}

export const fmtINR = (n) => {
  const num = Number(n) || 0
  if (Math.abs(num) >= 10000000) return '\u20b9' + (num / 10000000).toFixed(2) + ' Cr'
  if (Math.abs(num) >= 100000) return '\u20b9' + (num / 100000).toFixed(2) + ' L'
  return '\u20b9' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}
export const fmtINRFull = (n) => '\u20b9' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
