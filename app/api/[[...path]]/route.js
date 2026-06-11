import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDb } from '@/lib/agrofin/db'
import { hashPassword, verifyPassword, signToken, getUserFromRequest, ensureDefaultAdmin } from '@/lib/agrofin/auth'

const json = (data, status = 200) => NextResponse.json(data, { status })
const err = (msg, status = 400) => NextResponse.json({ error: msg }, { status })

const DEFAULT_INCOME_CATS = ['Salary','Farm','Freelance','Rental','Dividends','Other']
const DEFAULT_EXPENSE_CATS = ['Household','Farm','Utilities','Lifestyle','Health','Transport','Education','Other']

const defaultUserData = () => ({
  accounts: [],
  incomes: [],
  expenses: [],
  crops: [],
  loans: [],
  peers: [],
  assets: [],
  budget: { enabled: false, period: 'monthly', amount: 0 },
  incomeCategories: [...DEFAULT_INCOME_CATS],
  expenseCategories: [...DEFAULT_EXPENSE_CATS],
})

const seededUserData = () => {
  const today = new Date()
  const d = (days) => new Date(today.getTime() - days * 86400000).toISOString().slice(0, 10)
  return {
    accounts: [
      { id: uuid(), name: 'HDFC Salary', type: 'bank', balance: 245000, color: '#10b981' },
      { id: uuid(), name: 'Farm Cash Box', type: 'cash', balance: 38000, color: '#f59e0b' },
    ],
    incomes: [
      { id: uuid(), source: 'TechCorp Salary', category: 'Salary', amount: 185000, date: d(5), recurring: 'monthly' },
      { id: uuid(), source: 'Mango Harvest Q2', category: 'Farm', amount: 62000, date: d(20), recurring: 'one-time' },
    ],
    expenses: [
      { id: uuid(), label: 'Groceries', category: 'Household', amount: 8400, date: d(2) },
      { id: uuid(), label: 'Tractor diesel', category: 'Farm', amount: 5600, date: d(4) },
      { id: uuid(), label: 'Electricity', category: 'Utilities', amount: 2200, date: d(7) },
    ],
    crops: [
      { id: uuid(), name: 'Paddy — Kharif', area: 4.5, sowDate: d(60), expectedHarvest: d(-60), investments: 48000, expectedRevenue: 180000, status: 'growing' },
    ],
    loans: [
      {
        id: uuid(), name: 'Land Purchase Loan', lender: 'SBI Agri', principal: 800000, annualRate: 9.5,
        startDate: d(400),
        txs: [
          { id: uuid(), date: d(300), type: 'principal', amount: 50000, note: 'Bonus payment' },
          { id: uuid(), date: d(200), type: 'interest', amount: 45000, note: 'Half-yearly interest clearance' },
          { id: uuid(), date: d(100), type: 'principal', amount: 80000, note: 'Mango harvest proceeds' },
        ],
      },
    ],
    peers: [
      { id: uuid(), name: 'Ramesh (cousin)', direction: 'lent', amount: 25000, date: d(45), note: 'Tractor repair help', settled: false },
      { id: uuid(), name: 'Village Cooperative', direction: 'borrowed', amount: 40000, date: d(30), note: 'Seed bulk purchase', settled: false },
    ],
    assets: [
      { id: uuid(), name: 'Mutual Fund — Parag Parikh', category: 'Equity', value: 480000, growth: 14.2 },
      { id: uuid(), name: 'Gold (physical)', category: 'Gold', value: 320000, growth: 8.0 },
      { id: uuid(), name: 'Agricultural Land', category: 'Land', value: 4500000, growth: 6.5 },
    ],
  }
}

const publicUser = (u) => u && ({ id: u.id, username: u.username, displayName: u.displayName, role: u.role, active: u.active, createdAt: u.createdAt })

async function handler(request, { params }) {
  try {
    await ensureDefaultAdmin()
    const segs = params?.path || []
    const method = request.method
    const db = await getDb()
    const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await request.json().catch(() => ({})) : {}

    // ---- AUTH ROUTES ----
    if (segs[0] === 'auth') {
      if (segs[1] === 'login' && method === 'POST') {
        const { username, password } = body
        if (!username || !password) return err('Missing credentials')
        const user = await db.collection('users').findOne({ username: username.toLowerCase().trim() })
        if (!user || !user.active) return err('Invalid credentials or inactive account', 401)
        if (!verifyPassword(password, user.passwordHash)) return err('Invalid credentials', 401)
        const token = signToken({ userId: user.id, role: user.role })
        return json({ token, user: publicUser(user) })
      }
      if (segs[1] === 'me' && method === 'GET') {
        const user = await getUserFromRequest(request)
        if (!user) return err('Unauthorized', 401)
        return json({ user: publicUser(user) })
      }
    }

    // All routes below require auth
    const me = await getUserFromRequest(request)
    if (!me) return err('Unauthorized', 401)

    // ---- USERS (admin) ----
    if (segs[0] === 'users') {
      if (me.role !== 'admin') return err('Admin only', 403)
      if (segs.length === 1 && method === 'GET') {
        const users = await db.collection('users').find({}).sort({ createdAt: -1 }).toArray()
        return json({ users: users.map(publicUser) })
      }
      if (segs.length === 1 && method === 'POST') {
        const { username, displayName, password, role } = body
        if (!username || !password) return err('username and password required')
        const uname = username.toLowerCase().trim()
        const exists = await db.collection('users').findOne({ username: uname })
        if (exists) return err('Username already taken')
        const id = uuid()
        const user = {
          id, username: uname, displayName: displayName || uname,
          role: role === 'admin' ? 'admin' : 'user',
          active: true,
          passwordHash: hashPassword(password),
          createdAt: new Date().toISOString(),
        }
        await db.collection('users').insertOne(user)
        await db.collection('userData').insertOne({ userId: id, ...seededUserData() })
        return json({ user: publicUser(user) })
      }
      const targetId = segs[1]
      if (targetId && method === 'PATCH') {
        const patch = {}
        if (typeof body.active === 'boolean') patch.active = body.active
        if (body.role === 'admin' || body.role === 'user') patch.role = body.role
        if (body.displayName) patch.displayName = body.displayName
        if (body.password) patch.passwordHash = hashPassword(body.password)
        await db.collection('users').updateOne({ id: targetId }, { $set: patch })
        const updated = await db.collection('users').findOne({ id: targetId })
        return json({ user: publicUser(updated) })
      }
      if (targetId && method === 'DELETE') {
        if (targetId === me.id) return err('Cannot delete yourself')
        await db.collection('users').deleteOne({ id: targetId })
        await db.collection('userData').deleteOne({ userId: targetId })
        return json({ ok: true })
      }
    }

    // ---- DATA ----
    if (segs[0] === 'data') {
      const url = new URL(request.url)
      const targetUserId = url.searchParams.get('userId') || me.id
      // Non-admin can only access their own data
      if (targetUserId !== me.id && me.role !== 'admin') return err('Forbidden', 403)
      if (method === 'GET') {
        let doc = await db.collection('userData').findOne({ userId: targetUserId })
        if (!doc) {
          doc = { userId: targetUserId, ...defaultUserData() }
          await db.collection('userData').insertOne(doc)
        }
        const { _id, ...rest } = doc
        return json({ data: rest })
      }
      if (method === 'PUT') {
        const { data } = body
        if (!data) return err('Missing data')
        const clean = {}
        for (const k of ['accounts','incomes','expenses','crops','loans','peers','assets']) {
          clean[k] = Array.isArray(data[k]) ? data[k] : []
        }
        // Budget object (non-array)
        const b = data.budget || {}
        clean.budget = {
          enabled: !!b.enabled,
          period: b.period === 'yearly' ? 'yearly' : 'monthly',
          amount: Number(b.amount) || 0,
        }
        // Custom category lists (strings only, trimmed, deduped, fall back to defaults if empty)
        const cleanCats = (arr, fallback) => {
          if (!Array.isArray(arr)) return [...fallback]
          const out = [...new Set(arr.map(x => String(x || '').trim()).filter(Boolean))]
          return out.length > 0 ? out : [...fallback]
        }
        clean.incomeCategories = cleanCats(data.incomeCategories, DEFAULT_INCOME_CATS)
        clean.expenseCategories = cleanCats(data.expenseCategories, DEFAULT_EXPENSE_CATS)
        await db.collection('userData').updateOne(
          { userId: targetUserId },
          { $set: { ...clean, userId: targetUserId } },
          { upsert: true }
        )
        return json({ ok: true })
      }
    }

    return err('Not found', 404)
  } catch (e) {
    console.error('API error', e)
    return err(e.message || 'Server error', 500)
  }
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
