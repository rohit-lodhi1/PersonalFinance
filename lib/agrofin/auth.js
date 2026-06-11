import crypto from 'crypto'
import { getDb } from './db'

const SECRET = process.env.AUTH_SECRET || 'agrofin-default-dev-secret-change-in-prod-2025'
const TOKEN_TTL_DAYS = 30

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  if (!stored) return false
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const test = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'))
}

const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const b64uDecode = (str) => Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()

export function signToken(payload) {
  const body = { ...payload, exp: Date.now() + TOKEN_TTL_DAYS * 86400 * 1000 }
  const data = b64u(JSON.stringify(body))
  const sig = b64u(crypto.createHmac('sha256', SECRET).update(data).digest())
  return `${data}.${sig}`
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null
  const [data, sig] = token.split('.')
  if (!data || !sig) return null
  const expected = b64u(crypto.createHmac('sha256', SECRET).update(data).digest())
  if (expected !== sig) return null
  try {
    const body = JSON.parse(b64uDecode(data))
    if (body.exp && body.exp < Date.now()) return null
    return body
  } catch { return null }
}

export async function getUserFromRequest(req) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  const payload = verifyToken(token)
  if (!payload?.userId) return null
  const db = await getDb()
  const user = await db.collection('users').findOne({ id: payload.userId })
  if (!user || !user.active) return null
  return user
}

export async function ensureDefaultAdmin() {
  const db = await getDb()
  const count = await db.collection('users').countDocuments({ role: 'admin' })
  if (count === 0) {
    const { v4: uuid } = await import('uuid')
    await db.collection('users').insertOne({
      id: uuid(),
      username: 'admin',
      displayName: 'Administrator',
      role: 'admin',
      active: true,
      passwordHash: hashPassword('admin123'),
      createdAt: new Date().toISOString(),
    })
    return true
  }
  return false
}
