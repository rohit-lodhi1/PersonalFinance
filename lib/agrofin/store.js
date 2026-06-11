'use client'
import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { v4 as uuid } from 'uuid'

const KEY = 'agrofin_state_v1'

const defaultState = {
  accounts: [
    { id: uuid(), name: 'HDFC Salary', type: 'bank', balance: 245000, color: '#10b981' },
    { id: uuid(), name: 'Farm Cash Box', type: 'cash', balance: 38000, color: '#f59e0b' },
    { id: uuid(), name: 'ICICI Joint', type: 'bank', balance: 120000, color: '#3b82f6' },
  ],
  incomes: [
    { id: uuid(), source: 'TechCorp Salary', category: 'Salary', amount: 185000, date: new Date(Date.now()-86400000*5).toISOString().slice(0,10), accountId: null, recurring: 'monthly' },
    { id: uuid(), source: 'Mango Harvest Q2', category: 'Farm', amount: 62000, date: new Date(Date.now()-86400000*20).toISOString().slice(0,10), accountId: null, recurring: 'one-time' },
  ],
  expenses: [
    { id: uuid(), label: 'Groceries', category: 'Household', amount: 8400, date: new Date(Date.now()-86400000*2).toISOString().slice(0,10), accountId: null },
    { id: uuid(), label: 'Tractor diesel', category: 'Farm', amount: 5600, date: new Date(Date.now()-86400000*4).toISOString().slice(0,10), accountId: null },
    { id: uuid(), label: 'Electricity', category: 'Utilities', amount: 2200, date: new Date(Date.now()-86400000*7).toISOString().slice(0,10), accountId: null },
    { id: uuid(), label: 'Dining out', category: 'Lifestyle', amount: 3100, date: new Date(Date.now()-86400000*9).toISOString().slice(0,10), accountId: null },
  ],
  crops: [
    { id: uuid(), name: 'Paddy — Kharif', area: 4.5, sowDate: new Date(Date.now()-86400000*60).toISOString().slice(0,10), expectedHarvest: new Date(Date.now()+86400000*60).toISOString().slice(0,10), investments: 48000, expectedRevenue: 180000, status: 'growing' },
    { id: uuid(), name: 'Mango Orchard', area: 2.0, sowDate: new Date(Date.now()-86400000*1100).toISOString().slice(0,10), expectedHarvest: new Date(Date.now()+86400000*200).toISOString().slice(0,10), investments: 95000, expectedRevenue: 320000, status: 'perennial' },
  ],
  loans: [
    {
      id: uuid(), name: 'Land Purchase Loan', lender: 'SBI Agri', principal: 800000, annualRate: 9.5,
      startDate: new Date(Date.now()-86400000*400).toISOString().slice(0,10), monthlyBudget: 15000,
      txs: [
        { id: uuid(), date: new Date(Date.now()-86400000*300).toISOString().slice(0,10), type: 'principal', amount: 50000, note: 'Bonus payment' },
        { id: uuid(), date: new Date(Date.now()-86400000*200).toISOString().slice(0,10), type: 'interest', amount: 45000, note: 'Half-yearly interest clearance' },
        { id: uuid(), date: new Date(Date.now()-86400000*100).toISOString().slice(0,10), type: 'principal', amount: 80000, note: 'Mango harvest proceeds' },
      ]
    }
  ],
  peers: [
    { id: uuid(), name: 'Ramesh (cousin)', direction: 'lent', amount: 25000, date: new Date(Date.now()-86400000*45).toISOString().slice(0,10), note: 'Tractor repair help', settled: false },
    { id: uuid(), name: 'Village Cooperative', direction: 'borrowed', amount: 40000, date: new Date(Date.now()-86400000*30).toISOString().slice(0,10), note: 'Seed bulk purchase', settled: false },
    { id: uuid(), name: 'Suresh (neighbour)', direction: 'lent', amount: 12000, date: new Date(Date.now()-86400000*90).toISOString().slice(0,10), note: '', settled: false },
  ],
  assets: [
    { id: uuid(), name: 'Mutual Fund — Parag Parikh Flexi', category: 'Equity', value: 480000, growth: 14.2 },
    { id: uuid(), name: 'Gold (physical)', category: 'Gold', value: 320000, growth: 8.0 },
    { id: uuid(), name: 'Agricultural Land — 4.5 acres', category: 'Land', value: 4500000, growth: 6.5 },
    { id: uuid(), name: 'Provident Fund', category: 'Retirement', value: 620000, growth: 8.1 },
  ],
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, setState] = useState(defaultState)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setState(JSON.parse(raw))
    } catch (e) {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(state))
  }, [state, hydrated])

  const add = useCallback((collection, item) => {
    setState(s => ({ ...s, [collection]: [{ id: uuid(), ...item }, ...s[collection]] }))
  }, [])
  const update = useCallback((collection, id, patch) => {
    setState(s => ({ ...s, [collection]: s[collection].map(x => x.id === id ? { ...x, ...patch } : x) }))
  }, [])
  const remove = useCallback((collection, id) => {
    setState(s => ({ ...s, [collection]: s[collection].filter(x => x.id !== id) }))
  }, [])
  const addLoanTx = useCallback((loanId, tx) => {
    setState(s => ({
      ...s,
      loans: s.loans.map(l => l.id === loanId ? { ...l, txs: [...(l.txs||[]), { id: uuid(), ...tx }] } : l)
    }))
  }, [])
  const removeLoanTx = useCallback((loanId, txId) => {
    setState(s => ({
      ...s,
      loans: s.loans.map(l => l.id === loanId ? { ...l, txs: (l.txs||[]).filter(t => t.id !== txId) } : l)
    }))
  }, [])
  const reset = useCallback(() => setState(defaultState), [])

  const value = useMemo(() => ({ state, setState, add, update, remove, addLoanTx, removeLoanTx, reset, hydrated }), [state, add, update, remove, addLoanTx, removeLoanTx, reset, hydrated])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be inside StoreProvider')
  return ctx
}

export const fmtINR = (n) => {
  const num = Number(n) || 0
  if (Math.abs(num) >= 10000000) return '₹' + (num/10000000).toFixed(2) + ' Cr'
  if (Math.abs(num) >= 100000) return '₹' + (num/100000).toFixed(2) + ' L'
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}
export const fmtINRFull = (n) => '₹' + (Number(n)||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
