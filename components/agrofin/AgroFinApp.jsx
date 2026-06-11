'use client'
import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Wallet, TrendingUp, Receipt, Tractor, Landmark,
  HandCoins, Gem, Menu, X, Plus, Trash2, ArrowDownRight, ArrowUpRight,
  Sparkles, Calendar, Target, AlertCircle, CheckCircle2, Sprout,
  Shield, LogOut, Users, Eye, UserCog, Lock, Loader2, KeyRound, Pencil, Settings,
} from 'lucide-react'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, LineChart, Line, Legend, AreaChart, Area,
} from 'recharts'

import { StoreProvider, useStore, fmtINR, fmtINRFull } from '@/lib/agrofin/store'
import { computeLoanState, projectInterestPerYear } from '@/lib/agrofin/loanMath'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Toaster, toast } from 'sonner'

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'Command Center' },
  { key: 'accounts', label: 'Accounts & Wallets', icon: Wallet, hint: 'Liquidity map' },
  { key: 'income', label: 'Income Streams', icon: TrendingUp, hint: 'Salary + harvest' },
  { key: 'expense', label: 'Expense Logs', icon: Receipt, hint: 'Spend tracking' },
  { key: 'farm', label: 'Farming Profitability', icon: Tractor, hint: 'Crop P&L' },
  { key: 'loans', label: 'Loans', icon: Landmark, hint: 'Reducing balance' },
  { key: 'peers', label: 'Peer Ledger', icon: HandCoins, hint: 'Lend & borrow' },
  { key: 'assets', label: 'Assets & Investments', icon: Gem, hint: 'Net wealth' },
]
const ADMIN_NAV = { key: 'admin', label: 'Admin \u2014 Users', icon: Shield, hint: 'Manage users' }

const CHART_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4']

// ---------- shared primitives ----------
const KpiCard = ({ icon: Icon, label, value, sub, accent = 'emerald', delta }) => {
  const tones = {
    emerald: 'from-emerald-500/20 to-emerald-500/0 text-emerald-500 ring-emerald-500/30',
    amber: 'from-amber-500/20 to-amber-500/0 text-amber-500 ring-amber-500/30',
    sky: 'from-sky-500/20 to-sky-500/0 text-sky-500 ring-sky-500/30',
    rose: 'from-rose-500/20 to-rose-500/0 text-rose-500 ring-rose-500/30',
    violet: 'from-violet-500/20 to-violet-500/0 text-violet-500 ring-violet-500/30',
    slate: 'from-slate-500/20 to-slate-500/0 text-slate-500 ring-slate-500/30',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${tones[accent].split(' ').slice(0,2).join(' ')} opacity-60 pointer-events-none`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ring-1 ${tones[accent].split(' ').slice(2).join(' ')} bg-background/60 backdrop-blur`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {delta !== undefined && (
        <div className={`mt-3 inline-flex items-center gap-1 text-xs font-medium ${delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(delta).toFixed(1)}% vs last period
        </div>
      )}
    </motion.div>
  )
}

const SummaryStats = ({ items }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {items.map((it, i) => <KpiCard key={i} {...it} />)}
  </div>
)

// Reusable delete confirmation. Wraps a trigger (button) and shows a confirm dialog.
const ConfirmDelete = ({ onConfirm, title = 'Delete this item?', description = 'This action cannot be undone.', confirmLabel = 'Delete', triggerSize = 'icon', triggerVariant = 'ghost', triggerClassName = '', children }) => {
  const [open, setOpen] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {children || (
          <Button variant={triggerVariant} size={triggerSize} className={triggerClassName} onClick={(e) => e.stopPropagation()}>
            <Trash2 className="h-4 w-4 text-rose-500" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-rose-500 hover:bg-rose-600 text-white"
            onClick={() => { onConfirm?.(); setOpen(false) }}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Generic edit dialog. `fields` is an array of { key, label, type, options?, placeholder? }
// type: 'text' | 'number' | 'date' | 'select' | 'textarea'
// onSave receives a patch object with coerced values.
const EditEntry = ({ item, fields, onSave, title = 'Edit', trigger, size = 'icon' }) => {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({})
  useEffect(() => { if (open) setForm({ ...item }) }, [open, item])
  const save = () => {
    const patch = {}
    for (const f of fields) {
      let v = form[f.key]
      if (f.type === 'number') v = v === '' || v === null || v === undefined ? 0 : Number(v)
      patch[f.key] = v
    }
    onSave?.(patch)
    setOpen(false)
    toast.success('Saved')
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size={size} onClick={(e)=>e.stopPropagation()}>
            <Pencil className="h-4 w-4 text-sky-500" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
          {fields.map(f => (
            <div key={f.key}>
              <Label>{f.label}</Label>
              {f.type === 'select' ? (
                <Select value={String(form[f.key] ?? '')} onValueChange={v => setForm(s => ({ ...s, [f.key]: v }))}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {(f.options || []).map(opt => {
                      const val = typeof opt === 'object' ? opt.value : opt
                      const label = typeof opt === 'object' ? opt.label : opt
                      return <SelectItem key={val} value={val}>{label}</SelectItem>
                    })}
                  </SelectContent>
                </Select>
              ) : f.type === 'textarea' ? (
                <Textarea value={form[f.key] ?? ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))} placeholder={f.placeholder}/>
              ) : (
                <Input type={f.type || 'text'} step={f.step} value={form[f.key] ?? ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))} placeholder={f.placeholder}/>
              )}
            </div>
          ))}
        </div>
        <DialogFooter><Button onClick={save}>Save Changes</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const PageHeader = ({ title, subtitle, actions }) => (
  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
    <div>
      <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
    {actions}
  </div>
)

// ---------- DASHBOARD ----------
const Dashboard = ({ go }) => {
  const { state } = useStore()
  const totalCash = state.accounts.reduce((s, a) => s + Number(a.balance), 0)
  const monthIncome = state.incomes.filter(i => new Date(i.date) > new Date(Date.now()-86400000*30)).reduce((s, i) => s + Number(i.amount), 0)
  const monthExpense = state.expenses.filter(e => new Date(e.date) > new Date(Date.now()-86400000*30)).reduce((s, e) => s + Number(e.amount), 0)
  const loanStates = state.loans.map(l => ({ loan: l, ...computeLoanState(l) }))
  const totalLoanOutstanding = loanStates.reduce((s, x) => s + x.totalOutstanding, 0)
  const netPeer = state.peers.reduce((s, p) => s + (p.settled ? 0 : (p.direction === 'lent' ? Number(p.amount) : -Number(p.amount))), 0)
  const assetTotal = state.assets.reduce((s, a) => s + Number(a.value), 0)
  const netWorth = totalCash + assetTotal + netPeer - totalLoanOutstanding

  const cashflow = useMemo(() => {
    const days = 30
    const arr = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const ds = d.toISOString().slice(0, 10)
      const inc = state.incomes.filter(x => x.date === ds).reduce((s, x) => s + Number(x.amount), 0)
      const exp = state.expenses.filter(x => x.date === ds).reduce((s, x) => s + Number(x.amount), 0)
      arr.push({ date: ds.slice(5), income: inc, expense: exp, net: inc - exp })
    }
    return arr
  }, [state])

  const wealthSplit = [
    { name: 'Liquid Cash', value: totalCash },
    { name: 'Investments', value: assetTotal },
    { name: 'Peer Net', value: Math.max(0, netPeer) },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        subtitle="A unified view of your salary, farm, and family wealth."
      />
      <SummaryStats items={[
        { icon: Sparkles, label: 'Net Worth', value: fmtINR(netWorth), sub: 'Assets + Cash − Loans', accent: 'emerald', delta: 4.2 },
        { icon: Wallet, label: 'Liquid Cash', value: fmtINR(totalCash), sub: `${state.accounts.length} accounts`, accent: 'sky' },
        { icon: Landmark, label: 'Loan Outstanding', value: fmtINR(totalLoanOutstanding), sub: `${state.loans.length} active`, accent: 'rose' },
        { icon: Target, label: 'This Month Net', value: fmtINR(monthIncome - monthExpense), sub: `${fmtINR(monthIncome)} in / ${fmtINR(monthExpense)} out`, accent: 'amber', delta: ((monthIncome-monthExpense)/Math.max(1,monthIncome))*100 },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>30-Day Cashflow</CardTitle>
            <CardDescription>Income vs expense, daily net trajectory</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashflow}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.5}/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.5}/>
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmtINR(v)} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={(v) => fmtINRFull(v)} />
                <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#gIn)" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" stroke="#f43f5e" fill="url(#gOut)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wealth Composition</CardTitle>
            <CardDescription>How your net worth is distributed</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={wealthSplit} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                  {wealthSplit.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtINRFull(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {NAV.slice(1).map(n => (
          <motion.button key={n.key} whileHover={{ y: -2 }} onClick={() => go(n.key)}
            className="text-left rounded-xl border bg-card p-4 hover:border-emerald-500/40 hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-emerald-500/10 text-emerald-500"><n.icon className="h-4 w-4" /></div>
              <div>
                <p className="font-medium text-sm">{n.label}</p>
                <p className="text-xs text-muted-foreground">{n.hint}</p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

// ---------- ACCOUNTS ----------
const AccountsPage = () => {
  const { state, add, remove, update } = useStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'bank', balance: '' })
  const total = state.accounts.reduce((s, a) => s + Number(a.balance), 0)
  const bankTotal = state.accounts.filter(a => a.type === 'bank').reduce((s, a) => s + Number(a.balance), 0)
  const cashTotal = state.accounts.filter(a => a.type === 'cash').reduce((s, a) => s + Number(a.balance), 0)

  const submit = () => {
    if (!form.name || !form.balance) return toast.error('Fill name and balance')
    add('accounts', { name: form.name, type: form.type, balance: Number(form.balance), color: CHART_COLORS[state.accounts.length % CHART_COLORS.length] })
    setForm({ name: '', type: 'bank', balance: '' }); setOpen(false); toast.success('Account added')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts & Wallets" subtitle="Track every wallet, bank, and cash box"
        actions={<Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Account</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Axis Savings" /></div>
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="wallet">Digital Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Current Balance (₹)</Label><Input type="number" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>}
      />
      <SummaryStats items={[
        { icon: Wallet, label: 'Total Liquidity', value: fmtINR(total), sub: `${state.accounts.length} accounts`, accent: 'emerald' },
        { icon: Landmark, label: 'In Banks', value: fmtINR(bankTotal), sub: `${state.accounts.filter(a=>a.type==='bank').length} bank accounts`, accent: 'sky' },
        { icon: HandCoins, label: 'Cash on Hand', value: fmtINR(cashTotal), sub: 'Physical reserves', accent: 'amber' },
        { icon: Target, label: 'Largest Wallet', value: fmtINR(Math.max(0, ...state.accounts.map(a => Number(a.balance)))), sub: state.accounts.reduce((m, a) => Number(a.balance) > (m?.balance||0) ? a : m, null)?.name || '—', accent: 'violet' },
      ]} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {state.accounts.map(a => (
          <motion.div key={a.id} layout className="rounded-2xl border bg-card p-5 relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20" style={{ background: a.color }} />
            <div className="flex items-start justify-between relative">
              <div>
                <Badge variant="outline" className="capitalize">{a.type}</Badge>
                <h3 className="mt-2 text-lg font-semibold">{a.name}</h3>
                <p className="text-2xl font-bold mt-1">{fmtINRFull(a.balance)}</p>
              </div>
              <div className="flex items-center gap-1">
                <EditEntry
                  item={a}
                  fields={[
                    { key: 'name', label: 'Account name', type: 'text' },
                    { key: 'type', label: 'Type', type: 'select', options: ['bank','cash','wallet'] },
                    { key: 'balance', label: 'Balance (₹)', type: 'number' },
                  ]}
                  onSave={(patch) => update('accounts', a.id, patch)}
                  title={`Edit ${a.name}`}
                />
                <ConfirmDelete onConfirm={() => { remove('accounts', a.id); toast('Account removed') }} title="Delete this account?" description={`"${a.name}" will be removed. Existing income/expense entries linked won't be deleted, but this wallet will be gone.`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ---------- INCOME ----------
const IncomePage = () => {
  const { state, add, remove, update } = useStore()
  const [form, setForm] = useState({ source: '', category: 'Salary', amount: '', date: new Date().toISOString().slice(0,10), recurring: 'one-time' })
  const monthAmt = state.incomes.filter(i => new Date(i.date) > new Date(Date.now()-86400000*30)).reduce((s,i)=>s+Number(i.amount),0)
  const yearAmt = state.incomes.filter(i => new Date(i.date) > new Date(Date.now()-86400000*365)).reduce((s,i)=>s+Number(i.amount),0)
  const byCat = useMemo(() => {
    const m = {}
    state.incomes.forEach(i => { m[i.category] = (m[i.category]||0) + Number(i.amount) })
    return Object.entries(m).map(([name, value]) => ({ name, value }))
  }, [state.incomes])
  const topSource = state.incomes.reduce((m, i) => Number(i.amount) > (m?.amount||0) ? i : m, null)

  const submit = () => {
    if (!form.source || !form.amount) return toast.error('Source and amount required')
    add('incomes', { ...form, amount: Number(form.amount) })
    setForm({ ...form, source: '', amount: '' }); toast.success('Income logged')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Income Streams" subtitle="Salary, farm, side-gigs — all in one ledger" />
      <SummaryStats items={[
        { icon: TrendingUp, label: 'This Month', value: fmtINR(monthAmt), sub: 'Last 30 days', accent: 'emerald', delta: 8.4 },
        { icon: Calendar, label: 'This Year', value: fmtINR(yearAmt), sub: 'Trailing 12m', accent: 'sky' },
        { icon: Sparkles, label: 'Top Source', value: topSource?.source || '—', sub: topSource ? fmtINR(topSource.amount) : '', accent: 'amber' },
        { icon: Target, label: 'Streams', value: byCat.length, sub: 'Active categories', accent: 'violet' },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent Income</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[22rem] overflow-y-auto pr-2">
              {[...state.incomes].sort((a,b) => new Date(b.date) - new Date(a.date)).map(i => (
                <div key={i.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full p-2 bg-emerald-500/10 text-emerald-500"><ArrowUpRight className="h-4 w-4"/></div>
                    <div>
                      <p className="font-medium">{i.source}</p>
                      <p className="text-xs text-muted-foreground">{i.category} • {i.date} • {i.recurring}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-emerald-500">+{fmtINRFull(i.amount)}</p>
                    <EditEntry
                      item={i}
                      fields={[
                        { key:'source', label:'Source', type:'text' },
                        { key:'category', label:'Category', type:'select', options:['Salary','Farm','Freelance','Rental','Dividends','Other'] },
                        { key:'amount', label:'Amount (₹)', type:'number' },
                        { key:'date', label:'Date', type:'date' },
                        { key:'recurring', label:'Recurrence', type:'select', options:['one-time','monthly','quarterly','yearly'] },
                      ]}
                      onSave={(patch) => update('incomes', i.id, patch)}
                      title={`Edit income — ${i.source}`}
                    />
                    <ConfirmDelete onConfirm={() => remove('incomes', i.id)} title="Delete this income entry?" description={`${i.source} — ${fmtINRFull(i.amount)} will be removed.`} />
                  </div>
                </div>
              ))}
              {state.incomes.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No income yet</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Add Income</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Source</Label><Input value={form.source} onChange={e=>setForm({...form, source:e.target.value})} placeholder="TechCorp / Mango sale"/></div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={v=>setForm({...form, category:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {['Salary','Farm','Freelance','Rental','Dividends','Other'].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Amount (₹)</Label><Input type="number" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})}/></div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/></div>
            </div>
            <div><Label>Recurrence</Label>
              <Select value={form.recurring} onValueChange={v=>setForm({...form, recurring:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {['one-time','monthly','quarterly','yearly'].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={submit}><Plus className="h-4 w-4 mr-2"/>Log Income</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Income by Category</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCat}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }}/>
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickFormatter={v=>fmtINR(v)}/>
              <Tooltip formatter={v=>fmtINRFull(v)} contentStyle={{ background:'hsl(var(--card))', border:'1px solid hsl(var(--border))', borderRadius: 8 }}/>
              <Bar dataKey="value" radius={[8,8,0,0]}>
                {byCat.map((_,i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------- EXPENSE ----------
const BudgetSettingsDialog = ({ budget, onSave }) => {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(budget || { enabled: false, period: 'monthly', amount: 0 })
  useEffect(() => { if (open) setForm({ ...(budget || { enabled: false, period: 'monthly', amount: 0 }) }) }, [open, budget])
  const save = () => {
    onSave({ enabled: !!form.enabled, period: form.period === 'yearly' ? 'yearly' : 'monthly', amount: Number(form.amount) || 0 })
    setOpen(false)
    toast.success(form.enabled ? 'Budget enabled & saved' : 'Budget disabled')
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-2"/>Budget Settings</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure your spending budget</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Enable Budget Tracking</p>
              <p className="text-xs text-muted-foreground">Show progress bar & remaining KPI on this page</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(s => ({ ...s, enabled: !s.enabled }))}
              className={`relative h-6 w-11 rounded-full transition-colors ${form.enabled ? 'bg-emerald-500' : 'bg-muted'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div>
            <Label>Period</Label>
            <Select value={form.period} onValueChange={v => setForm(s => ({ ...s, period: v }))} disabled={!form.enabled}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly (resets each calendar month)</SelectItem>
                <SelectItem value="yearly">Yearly (resets each calendar year)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Budget Amount (₹)</Label>
            <Input type="number" value={form.amount} onChange={e => setForm(s => ({ ...s, amount: e.target.value }))} placeholder="e.g. 80000" disabled={!form.enabled}/>
            <p className="text-xs text-muted-foreground mt-1">
              {form.enabled && form.amount > 0 ? `Roughly ${fmtINR(form.period === 'yearly' ? form.amount / 12 : form.amount)} / month equivalent` : 'Set how much you want to cap your spending at per period.'}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save}>Save Budget Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const ExpensePage = () => {
  const { state, add, remove, update, setBudget } = useStore()
  const [form, setForm] = useState({ label: '', category: 'Household', amount: '', date: new Date().toISOString().slice(0,10) })
  const budget = state.budget || { enabled: false, period: 'monthly', amount: 0 }

  // Period filter: current calendar month or year
  const now = new Date()
  const periodStart = budget.period === 'yearly'
    ? new Date(now.getFullYear(), 0, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1)
  const periodLabel = budget.period === 'yearly' ? 'This Year' : 'This Month'
  const periodSub = budget.period === 'yearly'
    ? `${now.getFullYear()}`
    : `${now.toLocaleString('en-IN', { month: 'long' })} ${now.getFullYear()}`
  const daysInPeriod = budget.period === 'yearly'
    ? Math.ceil((new Date(now.getFullYear(), 11, 31) - periodStart) / 86400000) + 1
    : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed = Math.max(1, Math.ceil((now - periodStart) / 86400000))

  const inPeriod = state.expenses.filter(e => new Date(e.date) >= periodStart)
  const periodAmt = inPeriod.reduce((s,e)=>s+Number(e.amount),0)

  const byCat = useMemo(() => {
    const m = {}
    inPeriod.forEach(e => { m[e.category] = (m[e.category]||0) + Number(e.amount) })
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value)
  }, [state.expenses, budget.period])
  const topCat = byCat[0]

  const budgetEnabled = budget.enabled && Number(budget.amount) > 0
  const remaining = budgetEnabled ? Number(budget.amount) - periodAmt : 0
  const pct = budgetEnabled ? Math.min(100, (periodAmt / Number(budget.amount)) * 100) : 0
  // Pace: where you "should" be at this point in the period if you spent linearly
  const idealPct = budgetEnabled ? (daysElapsed / daysInPeriod) * 100 : 0
  const onTrack = budgetEnabled ? periodAmt <= (Number(budget.amount) * daysElapsed / daysInPeriod) : true

  const submit = () => {
    if (!form.label || !form.amount) return toast.error('Label and amount required')
    add('expenses', { ...form, amount: Number(form.amount) })
    setForm({ ...form, label: '', amount: '' }); toast.success('Expense logged')
  }

  const kpis = [
    { icon: Receipt, label: `Spent ${periodLabel}`, value: fmtINR(periodAmt), sub: `${inPeriod.length} txns • ${periodSub}`, accent: 'rose' },
    { icon: AlertCircle, label: 'Top Category', value: topCat?.name || '—', sub: topCat ? fmtINR(topCat.value) : 'No spend yet', accent: 'amber' },
    budgetEnabled
      ? { icon: Target, label: 'Budget Remaining', value: fmtINR(remaining), sub: `${pct.toFixed(0)}% used of ${fmtINR(budget.amount)} (${budget.period})`, accent: remaining < 0 ? 'rose' : (pct > 80 ? 'amber' : 'emerald') }
      : { icon: Target, label: 'Budget', value: 'Not set', sub: 'Click "Budget Settings" to enable', accent: 'slate' },
    { icon: TrendingUp, label: 'Avg / Day', value: fmtINR(periodAmt / daysElapsed), sub: `Across ${daysElapsed} day${daysElapsed!==1?'s':''}`, accent: 'sky' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Logs"
        subtitle={`Where every rupee went ${budget.period === 'yearly' ? 'this year' : 'this month'}`}
        actions={<BudgetSettingsDialog budget={budget} onSave={setBudget} />}
      />
      <SummaryStats items={kpis} />

      {budgetEnabled ? (
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <p className="text-sm font-semibold capitalize flex items-center gap-2">
                {budget.period} Budget Pace
                <Badge variant={onTrack ? 'secondary' : 'destructive'}>
                  {onTrack ? 'On track' : 'Over pace'}
                </Badge>
              </p>
              <p className="text-xs text-muted-foreground">Day {daysElapsed} of {daysInPeriod} — ideal pace {idealPct.toFixed(0)}%, actual {pct.toFixed(0)}%</p>
            </div>
            <p className="text-sm text-muted-foreground">{fmtINRFull(periodAmt)} / {fmtINRFull(budget.amount)}</p>
          </div>
          <div className="relative">
            <Progress value={pct} className="h-3"/>
            {/* Ideal pace marker */}
            <div className="absolute top-0 h-3 w-0.5 bg-foreground/40" style={{ left: `${Math.min(100, idealPct)}%` }} title={`Ideal: ${idealPct.toFixed(0)}%`} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span className="italic">Vertical line = where you should be today</span>
            <span>{fmtINRFull(budget.amount)}</span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed bg-card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-500/10 text-amber-500 p-2.5"><Target className="h-5 w-5"/></div>
            <div>
              <p className="font-medium">Budget tracking is off</p>
              <p className="text-sm text-muted-foreground">Enable a monthly or yearly budget to see your spending pace, remaining limit, and over-pace alerts.</p>
            </div>
          </div>
          <BudgetSettingsDialog budget={budget} onSave={setBudget} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent Expenses</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[22rem] overflow-y-auto pr-2">
              {[...state.expenses].sort((a,b) => new Date(b.date) - new Date(a.date)).map(e => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full p-2 bg-rose-500/10 text-rose-500"><ArrowDownRight className="h-4 w-4"/></div>
                    <div><p className="font-medium">{e.label}</p><p className="text-xs text-muted-foreground">{e.category} • {e.date}</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-rose-500">−{fmtINRFull(e.amount)}</p>
                    <EditEntry
                      item={e}
                      fields={[
                        { key:'label', label:'Label', type:'text' },
                        { key:'category', label:'Category', type:'select', options:['Household','Farm','Utilities','Lifestyle','Health','Transport','Education','Other'] },
                        { key:'amount', label:'Amount (₹)', type:'number' },
                        { key:'date', label:'Date', type:'date' },
                      ]}
                      onSave={(patch) => update('expenses', e.id, patch)}
                      title={`Edit expense — ${e.label}`}
                    />
                    <ConfirmDelete onConfirm={() => remove('expenses', e.id)} title="Delete this expense?" description={`${e.label} — ${fmtINRFull(e.amount)} will be removed.`} />
                  </div>
                </div>
              ))}
              {state.expenses.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No expenses logged</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Log Expense</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>What was it?</Label><Input value={form.label} onChange={e=>setForm({...form, label:e.target.value})} placeholder="Groceries / Pesticide"/></div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={v=>setForm({...form, category:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {['Household','Farm','Utilities','Lifestyle','Health','Transport','Education','Other'].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Amount (₹)</Label><Input type="number" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})}/></div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/></div>
            </div>
            <Button className="w-full" onClick={submit}><Plus className="h-4 w-4 mr-2"/>Log Expense</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Spend by Category</CardTitle><CardDescription>{periodSub}</CardDescription></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byCat} dataKey="value" nameKey="name" outerRadius={90} label={(d) => d.name}>
                {byCat.map((_,i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}
              </Pie>
              <Tooltip formatter={v=>fmtINRFull(v)} contentStyle={{ background:'hsl(var(--card))', border:'1px solid hsl(var(--border))', borderRadius: 8 }}/>
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------- FARM ----------
// Helper: sum of inputs[] (new itemised investments) with fallback to legacy single field
const cropInvestmentTotal = (c) => {
  if (Array.isArray(c.inputs) && c.inputs.length > 0) return c.inputs.reduce((s, x) => s + Number(x.amount || 0), 0)
  return Number(c.investments || 0)
}

const CropCard = ({ crop: c }) => {
  const { update, remove, addCropInvestment, updateCropInvestment, removeCropInvestment } = useStore()
  const [open, setOpen] = useState(false)
  const [invForm, setInvForm] = useState({ label: '', category: 'Seeds', amount: '', date: new Date().toISOString().slice(0, 10) })
  const totalInv = cropInvestmentTotal(c)
  const cProfit = Number(c.expectedRevenue) - totalInv
  const cMargin = c.expectedRevenue > 0 ? (cProfit / Number(c.expectedRevenue)) * 100 : 0
  const inputs = c.inputs || []

  const byCat = useMemo(() => {
    const m = {}
    inputs.forEach(i => { m[i.category] = (m[i.category] || 0) + Number(i.amount) })
    return Object.entries(m).map(([name, value]) => ({ name, value }))
  }, [inputs])

  const submitInv = () => {
    if (!invForm.label || !invForm.amount) return toast.error('Label and amount required')
    addCropInvestment(c.id, { ...invForm, amount: Number(invForm.amount) })
    setInvForm({ ...invForm, label: '', amount: '' })
    setOpen(false)
    toast.success('Investment added')
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg">{c.name}</h3>
              <Badge variant="outline" className="capitalize">{c.status}</Badge>
              {inputs.length > 0 && <Badge variant="secondary">{inputs.length} input{inputs.length !== 1 ? 's' : ''}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{c.area} acres • Sowed {c.sowDate} • Harvest {c.expectedHarvest || 'TBD'}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Select value={c.status} onValueChange={v => update('crops', c.id, { status: v })}>
              <SelectTrigger className="h-8 w-32"><SelectValue/></SelectTrigger>
              <SelectContent>{['growing','perennial','harvested','failed'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <EditEntry
              item={c}
              fields={[
                { key: 'name', label: 'Crop name', type: 'text' },
                { key: 'area', label: 'Area (acres)', type: 'number' },
                { key: 'sowDate', label: 'Sowed', type: 'date' },
                { key: 'expectedHarvest', label: 'Expected Harvest', type: 'date' },
                { key: 'expectedRevenue', label: 'Expected Revenue (₹)', type: 'number' },
                { key: 'status', label: 'Status', type: 'select', options: ['growing','perennial','harvested','failed'] },
              ]}
              onSave={(patch) => update('crops', c.id, patch)}
              title={`Edit ${c.name}`}
            />
            <ConfirmDelete onConfirm={() => remove('crops', c.id)} title="Delete this crop cycle?" description={`"${c.name}" and all its investment entries will be removed.`} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Invested</p><p className="font-semibold">{fmtINRFull(totalInv)}</p></div>
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Expected Rev</p><p className="font-semibold text-emerald-500">{fmtINRFull(c.expectedRevenue)}</p></div>
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Margin</p><p className={`font-semibold ${cProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{cMargin.toFixed(1)}%</p></div>
        </div>

        <div className="mt-4 rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2"><Sprout className="h-4 w-4 text-emerald-500"/>Investment Ledger</p>
              <p className="text-xs text-muted-foreground">Track every input cost — seeds, fertilizer, labor, equipment, etc.</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-3 w-3 mr-1"/>Add Investment</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add investment — {c.name}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>What was it?</Label><Input value={invForm.label} onChange={e=>setInvForm({...invForm, label:e.target.value})} placeholder="Hybrid paddy seeds, Urea, Tractor rental..."/></div>
                  <div><Label>Category</Label>
                    <Select value={invForm.category} onValueChange={v=>setInvForm({...invForm, category:v})}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>{['Seeds','Fertilizer','Pesticide','Labor','Equipment','Irrigation','Fuel','Land lease','Transport','Other'].map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Amount (₹)</Label><Input type="number" value={invForm.amount} onChange={e=>setInvForm({...invForm, amount:e.target.value})}/></div>
                    <div><Label>Date</Label><Input type="date" value={invForm.date} onChange={e=>setInvForm({...invForm, date:e.target.value})}/></div>
                  </div>
                </div>
                <DialogFooter><Button onClick={submitInv}>Add Investment</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {inputs.length > 0 ? (
            <div className="space-y-1.5 max-h-[16rem] overflow-y-auto pr-2">
              {[...inputs].sort((a,b) => new Date(b.date) - new Date(a.date)).map(inv => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border bg-card p-2.5 text-sm gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="capitalize shrink-0">{inv.category}</Badge>
                    <span className="font-medium truncate">{inv.label}</span>
                    <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">{inv.date}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-semibold text-amber-600">{fmtINRFull(inv.amount)}</span>
                    <EditEntry
                      item={inv}
                      fields={[
                        { key:'label', label:'Label', type:'text' },
                        { key:'category', label:'Category', type:'select', options:['Seeds','Fertilizer','Pesticide','Labor','Equipment','Irrigation','Fuel','Land lease','Transport','Other'] },
                        { key:'amount', label:'Amount (₹)', type:'number' },
                        { key:'date', label:'Date', type:'date' },
                      ]}
                      onSave={(patch) => updateCropInvestment(c.id, inv.id, patch)}
                      title="Edit investment"
                      trigger={<Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e)=>e.stopPropagation()}><Pencil className="h-3 w-3 text-sky-500"/></Button>}
                    />
                    <ConfirmDelete
                      onConfirm={() => removeCropInvestment(c.id, inv.id)}
                      title="Delete this investment?"
                      description={`${inv.label} — ${fmtINRFull(inv.amount)} will be removed and the crop total will recalculate.`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e)=>e.stopPropagation()}><Trash2 className="h-3 w-3 text-rose-500"/></Button>
                    </ConfirmDelete>
                  </div>
                </div>
              ))}
              {byCat.length > 1 && (
                <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
                  {byCat.map(b => (
                    <div key={b.name} className="rounded-md bg-background px-2 py-1 text-xs border">
                      <span className="text-muted-foreground">{b.name}: </span>
                      <span className="font-semibold">{fmtINRFull(b.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-muted-foreground">
              {Number(c.investments) > 0 ? (
                <>Legacy bundled total: <strong>{fmtINRFull(c.investments)}</strong>. Click "Add Investment" to start itemising.</>
              ) : (
                <>No investments logged yet. Click "Add Investment" above to track your first input cost.</>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const FarmPage = () => {
  const { state, add } = useStore()
  const [form, setForm] = useState({ name: '', area: '', sowDate: new Date().toISOString().slice(0,10), expectedHarvest: '', expectedRevenue: '', status: 'growing' })
  const totalInv = state.crops.reduce((s, c) => s + cropInvestmentTotal(c), 0)
  const totalRev = state.crops.reduce((s, c) => s + Number(c.expectedRevenue), 0)
  const profit = totalRev - totalInv
  const margin = totalRev > 0 ? (profit / totalRev) * 100 : 0
  const totalInputs = state.crops.reduce((s, c) => s + ((c.inputs || []).length), 0)

  const submit = () => {
    if (!form.name) return toast.error('Crop name required')
    add('crops', { ...form, area: Number(form.area), investments: 0, expectedRevenue: Number(form.expectedRevenue), inputs: [] })
    setForm({ ...form, name: '', area: '', expectedRevenue: '', expectedHarvest: '' })
    toast.success('Crop cycle added — now log its investments')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Farming Profitability" subtitle="Crop cycle P&L with itemised investment tracking" />
      <SummaryStats items={[
        { icon: Tractor, label: 'Total Invested', value: fmtINR(totalInv), sub: `${totalInputs} investment entries`, accent: 'amber' },
        { icon: Sprout, label: 'Projected Revenue', value: fmtINR(totalRev), sub: 'On expected harvest', accent: 'emerald' },
        { icon: TrendingUp, label: 'Projected Profit', value: fmtINR(profit), sub: `${margin.toFixed(1)}% margin`, accent: profit >= 0 ? 'emerald' : 'rose' },
        { icon: CheckCircle2, label: 'Active Cycles', value: state.crops.filter(c => c.status !== 'harvested').length, sub: `${state.crops.length} total`, accent: 'sky' },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {state.crops.map(c => <CropCard key={c.id} crop={c} />)}
          {state.crops.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No crops yet — add your first cycle →</p>}
        </div>

        <Card className="h-fit">
          <CardHeader><CardTitle>Add Crop Cycle</CardTitle><CardDescription>Create the cycle first, then log investments individually</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Crop name</Label><Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Paddy — Rabi 2025"/></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Area (acres)</Label><Input type="number" value={form.area} onChange={e=>setForm({...form, area:e.target.value})}/></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v=>setForm({...form, status:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{['growing','perennial','harvested','failed'].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Sowed</Label><Input type="date" value={form.sowDate} onChange={e=>setForm({...form, sowDate:e.target.value})}/></div>
              <div><Label>Harvest</Label><Input type="date" value={form.expectedHarvest} onChange={e=>setForm({...form, expectedHarvest:e.target.value})}/></div>
            </div>
            <div><Label>Expected Revenue (₹)</Label><Input type="number" value={form.expectedRevenue} onChange={e=>setForm({...form, expectedRevenue:e.target.value})}/></div>
            <Button className="w-full" onClick={submit}><Plus className="h-4 w-4 mr-2"/>Add Cycle</Button>
            <p className="text-xs text-muted-foreground italic">Tip: After creating the cycle, click "Add Investment" on its card to log seeds, fertilizer, labor, etc. individually.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---------- LOANS (the heart) ----------
const LoanCard = ({ loan }) => {
  const { addLoanTx, remove, removeLoanTx, updateLoanTx, update } = useStore()
  const [open, setOpen] = useState(false)
  const [tx, setTx] = useState({ type: 'principal', amount: '', date: new Date().toISOString().slice(0,10), note: '' })
  const s = computeLoanState(loan)
  const yearlyInterest = projectInterestPerYear(loan)
  const submit = () => {
    if (!tx.amount) return toast.error('Amount required')
    addLoanTx(loan.id, { ...tx, amount: Number(tx.amount) })
    setTx({ ...tx, amount: '', note: '' }); setOpen(false); toast.success(`${tx.type} payment recorded`)
  }
  const principalPaidPct = (s.totalPrincipalPaid / (Number(loan.principal) + (loan.txs||[]).filter(t=>t.type==='disbursement').reduce((a,b)=>a+Number(b.amount),0))) * 100

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{loan.name}</h3>
            <p className="text-xs text-muted-foreground">{loan.lender} • {loan.annualRate}% p.a. • Started {loan.startDate}</p>
          </div>
          <div className="flex items-center gap-1">
            <EditEntry
              item={loan}
              fields={[
                { key:'name', label:'Loan name', type:'text' },
                { key:'lender', label:'Lender', type:'text' },
                { key:'principal', label:'Initial Principal (₹)', type:'number' },
                { key:'annualRate', label:'Annual Rate (%)', type:'number' },
                { key:'startDate', label:'Start Date', type:'date' },
              ]}
              onSave={(patch) => update('loans', loan.id, patch)}
              title={`Edit ${loan.name}`}
            />
            <ConfirmDelete onConfirm={() => remove('loans', loan.id)} title={`Delete "${loan.name}"?`} description="The loan, its full payment history, and accrued interest record will be permanently removed." />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Outstanding Principal</p><p className="font-bold text-rose-500">{fmtINRFull(s.outstandingPrincipal)}</p></div>
          <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Accrued Interest</p><p className="font-bold text-amber-500">{fmtINRFull(s.accruedInterestPending)}</p></div>
          <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Principal Repaid</p><p className="font-bold text-emerald-500">{fmtINRFull(s.totalPrincipalPaid)}</p></div>
          <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Interest @ today's principal / yr</p><p className="font-bold">{fmtINRFull(yearlyInterest)}</p></div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1"><span>Principal repayment</span><span>{principalPaidPct.toFixed(1)}%</span></div>
          <Progress value={Math.min(100, principalPaidPct)} className="h-2"/>
        </div>

        <Tabs defaultValue="history">
          <TabsList>
            <TabsTrigger value="history">History ({(loan.txs||[]).length})</TabsTrigger>
            <TabsTrigger value="chart">Balance Curve</TabsTrigger>
          </TabsList>
          <TabsContent value="history" className="mt-3">
            <div className="space-y-1 max-h-[12.5rem] overflow-y-auto pr-2">
              {[...(loan.txs||[])].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(t => (
                <div key={t.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={t.type==='principal'?'default':t.type==='interest'?'secondary':'outline'} className="capitalize">{t.type}</Badge>
                    <span className="text-xs text-muted-foreground">{t.date}</span>
                    {t.note && <span className="text-xs italic text-muted-foreground">— {t.note}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">{fmtINRFull(t.amount)}</span>
                    <EditEntry
                      item={t}
                      fields={[
                        { key:'type', label:'Type', type:'select', options:[{value:'principal',label:'Principal repayment'},{value:'interest',label:'Interest payment'},{value:'disbursement',label:'Top-up / disbursement'}] },
                        { key:'amount', label:'Amount (₹)', type:'number' },
                        { key:'date', label:'Date', type:'date' },
                        { key:'note', label:'Note', type:'textarea' },
                      ]}
                      onSave={(patch) => updateLoanTx(loan.id, t.id, patch)}
                      title="Edit loan transaction"
                      trigger={<Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e)=>e.stopPropagation()}><Pencil className="h-3 w-3 text-sky-500"/></Button>}
                    />
                    <ConfirmDelete onConfirm={() => removeLoanTx(loan.id, t.id)} title="Delete this payment?" description={`The ${t.type} entry of ${fmtINRFull(t.amount)} on ${t.date} will be reversed. Interest will recalculate from the remaining history.`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e)=>e.stopPropagation()}><Trash2 className="h-3 w-3 text-rose-500"/></Button>
                    </ConfirmDelete>
                  </div>
                </div>
              ))}
              {(loan.txs||[]).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No payments yet</p>}
            </div>
          </TabsContent>
          <TabsContent value="chart" className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={s.schedule}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"/>
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v=>fmtINR(v)}/>
                <Tooltip formatter={v=>fmtINRFull(v)} contentStyle={{ background:'hsl(var(--card))', border:'1px solid hsl(var(--border))', borderRadius: 8 }}/>
                <Line type="stepAfter" dataKey="principalAfter" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }}/>
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="w-full"><Plus className="h-4 w-4 mr-2"/>Record Payment / Top-up</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record transaction — {loan.name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Type</Label>
                <Select value={tx.type} onValueChange={v=>setTx({...tx, type:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="principal">Principal repayment (reduces balance)</SelectItem>
                    <SelectItem value="interest">Interest payment (clears accrued interest)</SelectItem>
                    <SelectItem value="disbursement">Top-up / additional disbursement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Amount (₹)</Label><Input type="number" value={tx.amount} onChange={e=>setTx({...tx, amount:e.target.value})}/></div>
                <div><Label>Date</Label><Input type="date" value={tx.date} onChange={e=>setTx({...tx, date:e.target.value})}/></div>
              </div>
              <div><Label>Note</Label><Textarea value={tx.note} onChange={e=>setTx({...tx, note:e.target.value})} placeholder="Optional"/></div>
              <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
                <p><strong>Current state:</strong></p>
                <p>Outstanding principal: {fmtINRFull(s.outstandingPrincipal)}</p>
                <p>Accrued interest pending: {fmtINRFull(s.accruedInterestPending)}</p>
              </div>
            </div>
            <DialogFooter><Button onClick={submit}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

const LoansPage = () => {
  const { state, add, update } = useStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', lender: '', principal: '', annualRate: '', startDate: new Date().toISOString().slice(0,10) })
  const allStates = state.loans.map(l => ({ loan: l, ...computeLoanState(l) }))
  const totalOut = allStates.reduce((s,x)=>s+x.outstandingPrincipal,0)
  const totalAccrued = allStates.reduce((s,x)=>s+x.accruedInterestPending,0)
  const totalPaid = allStates.reduce((s,x)=>s+x.totalPrincipalPaid+x.totalInterestPaid,0)
  const yearProjection = state.loans.reduce((s,l)=>s+projectInterestPerYear(l),0)

  const submit = () => {
    if (!form.name || !form.principal || !form.annualRate) return toast.error('Fill name, principal, and rate')
    add('loans', { ...form, principal: Number(form.principal), annualRate: Number(form.annualRate), txs: [] })
    setForm({ name:'', lender:'', principal:'', annualRate:'', startDate: new Date().toISOString().slice(0,10) }); setOpen(false); toast.success('Loan created')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Loans — Reducing Balance" subtitle="Day-accurate interest accrual. Pay principal any time, in any amount."
        actions={<Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2"/>New Loan</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Loan</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Loan name</Label><Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Land purchase"/></div>
              <div><Label>Lender</Label><Input value={form.lender} onChange={e=>setForm({...form, lender:e.target.value})} placeholder="SBI / Father-in-law"/></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Principal (₹)</Label><Input type="number" value={form.principal} onChange={e=>setForm({...form, principal:e.target.value})}/></div>
                <div><Label>Annual Rate (%)</Label><Input type="number" step="0.1" value={form.annualRate} onChange={e=>setForm({...form, annualRate:e.target.value})}/></div>
              </div>
              <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e=>setForm({...form, startDate:e.target.value})}/></div>
            </div>
            <DialogFooter><Button onClick={submit}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>}
      />
      <SummaryStats items={[
        { icon: Landmark, label: 'Total Outstanding', value: fmtINR(totalOut), sub: `${state.loans.length} active loans`, accent: 'rose' },
        { icon: AlertCircle, label: 'Interest Pending', value: fmtINR(totalAccrued), sub: 'Unpaid accrued interest', accent: 'amber' },
        { icon: CheckCircle2, label: 'Lifetime Repaid', value: fmtINR(totalPaid), sub: 'Principal + interest', accent: 'emerald' },
        { icon: Target, label: 'Yearly Cost', value: fmtINR(yearProjection), sub: 'At today\'s principal', accent: 'violet' },
      ]} />

      <div className="space-y-4">
        {state.loans.map(l => <LoanCard key={l.id} loan={l}/>)}
        {state.loans.length === 0 && (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <Landmark className="h-10 w-10 mx-auto text-muted-foreground"/>
            <p className="mt-3 text-sm text-muted-foreground">No loans yet. Create your first reducing-balance loan to see the magic.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- PEERS ----------
const PeersPage = () => {
  const { state, add, update, remove } = useStore()
  const [form, setForm] = useState({ name: '', direction: 'lent', amount: '', date: new Date().toISOString().slice(0,10), note: '' })
  const lent = state.peers.filter(p => p.direction==='lent' && !p.settled).reduce((s,p)=>s+Number(p.amount),0)
  const borrowed = state.peers.filter(p => p.direction==='borrowed' && !p.settled).reduce((s,p)=>s+Number(p.amount),0)
  const net = lent - borrowed
  const submit = () => {
    if (!form.name || !form.amount) return toast.error('Name and amount required')
    add('peers', { ...form, amount: Number(form.amount), settled: false })
    setForm({ ...form, name:'', amount:'', note:'' }); toast.success('Entry added')
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Peer Ledger" subtitle="Track money lent to & borrowed from family, friends, cooperatives" />
      <SummaryStats items={[
        { icon: ArrowUpRight, label: 'Total Lent', value: fmtINR(lent), sub: 'Owed to you', accent: 'emerald' },
        { icon: ArrowDownRight, label: 'Total Borrowed', value: fmtINR(borrowed), sub: 'You owe', accent: 'rose' },
        { icon: Sparkles, label: 'Net Peer Balance', value: fmtINR(net), sub: net>=0?'In your favour':'You owe overall', accent: net>=0?'emerald':'rose' },
        { icon: HandCoins, label: 'Open Entries', value: state.peers.filter(p=>!p.settled).length, sub: `${state.peers.filter(p=>p.settled).length} settled`, accent: 'sky' },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Peer Entries</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[22rem] overflow-y-auto pr-2">
              {[...state.peers].sort((a,b) => new Date(b.date) - new Date(a.date)).map(p => (
                <div key={p.id} className={`flex items-center justify-between rounded-lg border p-3 ${p.settled?'opacity-50':''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full p-2 ${p.direction==='lent'?'bg-emerald-500/10 text-emerald-500':'bg-rose-500/10 text-rose-500'}`}>
                      {p.direction==='lent' ? <ArrowUpRight className="h-4 w-4"/> : <ArrowDownRight className="h-4 w-4"/>}
                    </div>
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.direction==='lent'?'Lent to':'Borrowed from'} • {p.date}{p.note && ` • ${p.note}`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold ${p.direction==='lent'?'text-emerald-500':'text-rose-500'}`}>{fmtINRFull(p.amount)}</p>
                    <Button size="sm" variant={p.settled?'outline':'secondary'} onClick={()=>update('peers', p.id, { settled: !p.settled })}>
                      {p.settled ? 'Reopen' : 'Settle'}
                    </Button>
                    <EditEntry
                      item={p}
                      fields={[
                        { key:'name', label:'Name', type:'text' },
                        { key:'direction', label:'Direction', type:'select', options:[{value:'lent',label:'Lent (they owe me)'},{value:'borrowed',label:'Borrowed (I owe)'}] },
                        { key:'amount', label:'Amount (₹)', type:'number' },
                        { key:'date', label:'Date', type:'date' },
                        { key:'note', label:'Note', type:'textarea' },
                      ]}
                      onSave={(patch) => update('peers', p.id, patch)}
                      title={`Edit entry — ${p.name}`}
                    />
                    <ConfirmDelete onConfirm={() => remove('peers', p.id)} title="Delete this peer entry?" description={`${p.direction === 'lent' ? 'Lent to' : 'Borrowed from'} ${p.name} — ${fmtINRFull(p.amount)}.`} />
                  </div>
                </div>
              ))}
              {state.peers.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No peer entries yet</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>New Entry</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Cousin / Cooperative"/></div>
            <div><Label>Direction</Label>
              <Select value={form.direction} onValueChange={v=>setForm({...form, direction:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lent">I lent (they owe me)</SelectItem>
                  <SelectItem value="borrowed">I borrowed (I owe them)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Amount (₹)</Label><Input type="number" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})}/></div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/></div>
            </div>
            <div><Label>Note</Label><Textarea value={form.note} onChange={e=>setForm({...form, note:e.target.value})} placeholder="Optional"/></div>
            <Button className="w-full" onClick={submit}><Plus className="h-4 w-4 mr-2"/>Add Entry</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---------- ASSETS ----------
const AssetsPage = () => {
  const { state, add, remove, update } = useStore()
  const [form, setForm] = useState({ name: '', category: 'Equity', value: '', growth: '' })
  const total = state.assets.reduce((s,a)=>s+Number(a.value),0)
  const byCat = useMemo(() => {
    const m = {}
    state.assets.forEach(a => { m[a.category] = (m[a.category]||0) + Number(a.value) })
    return Object.entries(m).map(([name, value]) => ({ name, value }))
  }, [state.assets])
  const weightedGrowth = state.assets.reduce((s,a)=>s+Number(a.value)*Number(a.growth),0) / Math.max(1,total)
  const submit = () => {
    if (!form.name || !form.value) return toast.error('Name and value required')
    add('assets', { ...form, value: Number(form.value), growth: Number(form.growth||0) })
    setForm({ ...form, name:'', value:'', growth:'' }); toast.success('Asset added')
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Assets & Investments" subtitle="Your full balance sheet — land, equity, gold, retirement" />
      <SummaryStats items={[
        { icon: Gem, label: 'Total Portfolio', value: fmtINR(total), sub: `${state.assets.length} holdings`, accent: 'emerald' },
        { icon: TrendingUp, label: 'Weighted Growth', value: weightedGrowth.toFixed(2) + '%', sub: 'Blended annualised', accent: 'sky' },
        { icon: Sparkles, label: 'Largest Holding', value: state.assets.reduce((m,a)=>Number(a.value)>(m?.value||0)?a:m, null)?.name || '—', sub: fmtINR(Math.max(0,...state.assets.map(a=>Number(a.value)))), accent: 'amber' },
        { icon: Target, label: 'Categories', value: byCat.length, sub: 'Diversification', accent: 'violet' },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Holdings</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-auto">
              {state.assets.map(a => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full p-2 bg-violet-500/10 text-violet-500"><Gem className="h-4 w-4"/></div>
                    <div>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.category} • {a.growth}% growth</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{fmtINRFull(a.value)}</p>
                    <EditEntry
                      item={a}
                      fields={[
                        { key:'name', label:'Asset name', type:'text' },
                        { key:'category', label:'Category', type:'select', options:['Equity','Debt','Gold','Land','Real Estate','Retirement','Crypto','Other'] },
                        { key:'value', label:'Current Value (₹)', type:'number' },
                        { key:'growth', label:'Annual Growth (%)', type:'number' },
                      ]}
                      onSave={(patch) => update('assets', a.id, patch)}
                      title={`Edit ${a.name}`}
                    />
                    <ConfirmDelete onConfirm={() => remove('assets', a.id)} title="Delete this asset?" description={`${a.name} — ${fmtINRFull(a.value)} will be removed from your portfolio.`} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Add Holding</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Asset name</Label><Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={v=>setForm({...form, category:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{['Equity','Debt','Gold','Land','Real Estate','Retirement','Crypto','Other'].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Current Value (₹)</Label><Input type="number" value={form.value} onChange={e=>setForm({...form, value:e.target.value})}/></div>
            <div><Label>Annual Growth (%)</Label><Input type="number" step="0.1" value={form.growth} onChange={e=>setForm({...form, growth:e.target.value})}/></div>
            <Button className="w-full" onClick={submit}><Plus className="h-4 w-4 mr-2"/>Add Asset</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Portfolio Allocation</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3} label={(d)=>`${d.name}`}>
                {byCat.map((_,i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}
              </Pie>
              <Tooltip formatter={v=>fmtINRFull(v)} contentStyle={{ background:'hsl(var(--card))', border:'1px solid hsl(var(--border))', borderRadius: 8 }}/>
              <Legend/>
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------- SHELL ----------
// ---------- LOGIN SCREEN ----------
const LoginScreen = () => {
  const { login, authError } = useStore()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e?.preventDefault()
    setBusy(true)
    try { await login(username, password) } catch {}
    setBusy(false)
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-500/10 via-background to-amber-500/10 p-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="w-full max-w-md rounded-2xl border bg-card shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-amber-500 h-12 w-12 flex items-center justify-center text-white font-bold shadow-lg text-xl">A</div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AgroFin</h1>
            <p className="text-xs text-muted-foreground">Premium Finance × Farm OS</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Username</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" autoFocus />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="\u2022\u2022\u2022\u2022\u2022\u2022" />
          </div>
          {authError && <div className="rounded-lg bg-rose-500/10 text-rose-500 text-sm p-3 flex items-center gap-2"><AlertCircle className="h-4 w-4"/>{authError}</div>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <KeyRound className="h-4 w-4 mr-2"/>}
            Sign In
          </Button>
        </form>
        <div className="mt-6 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Default admin (first run)</p>
          <p>Username: <code className="bg-background px-1.5 py-0.5 rounded">admin</code></p>
          <p>Password: <code className="bg-background px-1.5 py-0.5 rounded">admin123</code></p>
          <p className="italic">Use the Admin panel to create more users.</p>
        </div>
      </motion.div>
    </div>
  )
}

// ---------- ADMIN PAGE ----------
const AdminPage = () => {
  const { users, me, createUser, patchUser, deleteUser, manageAs, managingUserId } = useStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ username: '', displayName: '', password: '', role: 'user' })
  const [pwOpen, setPwOpen] = useState(null) // userId
  const [newPw, setNewPw] = useState('')

  const submit = async () => {
    if (!form.username || !form.password) return toast.error('Username and password required')
    try { await createUser(form); setForm({ username:'', displayName:'', password:'', role:'user' }); setOpen(false); toast.success('User created') }
    catch (e) { toast.error(e.message) }
  }

  const activeCount = users.filter(u => u.active).length
  const adminCount = users.filter(u => u.role === 'admin').length

  return (
    <div className="space-y-6">
      <PageHeader title="User Administration" subtitle="Create, activate, manage roles, and impersonate users"
        actions={<Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2"/>New User</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Username</Label><Input value={form.username} onChange={e=>setForm({...form, username:e.target.value})} placeholder="e.g. priya"/></div>
              <div><Label>Display Name</Label><Input value={form.displayName} onChange={e=>setForm({...form, displayName:e.target.value})} placeholder="Priya Sharma"/></div>
              <div><Label>Password</Label><Input type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/></div>
              <div><Label>Role</Label>
                <Select value={form.role} onValueChange={v=>setForm({...form, role:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={submit}>Create User</Button></DialogFooter>
          </DialogContent>
        </Dialog>}
      />
      <SummaryStats items={[
        { icon: Users, label: 'Total Users', value: users.length, sub: 'All accounts', accent: 'sky' },
        { icon: CheckCircle2, label: 'Active', value: activeCount, sub: `${users.length - activeCount} inactive`, accent: 'emerald' },
        { icon: Shield, label: 'Admins', value: adminCount, sub: `${users.length - adminCount} regular`, accent: 'violet' },
        { icon: UserCog, label: 'You', value: me?.displayName || me?.username, sub: me?.role, accent: 'amber' },
      ]}/>

      <Card>
        <CardHeader><CardTitle>All Users</CardTitle><CardDescription>Toggle status, change roles, or manage their finances directly</CardDescription></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${!u.active ? 'opacity-60' : ''} ${managingUserId === u.id ? 'ring-2 ring-emerald-500' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`rounded-full h-10 w-10 flex items-center justify-center font-bold text-white ${u.role==='admin'?'bg-gradient-to-br from-violet-500 to-rose-500':'bg-gradient-to-br from-emerald-500 to-sky-500'}`}>
                    {(u.displayName || u.username).slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium flex items-center gap-2">{u.displayName || u.username}
                      {u.role === 'admin' && <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3"/>Admin</Badge>}
                      {!u.active && <Badge variant="destructive">Inactive</Badge>}
                      {u.id === me?.id && <Badge variant="outline">You</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">@{u.username} · since {u.createdAt?.slice(0,10)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <EditEntry
                    item={u}
                    fields={[
                      { key:'displayName', label:'Display Name', type:'text' },
                    ]}
                    onSave={(patch) => patchUser(u.id, patch).then(()=>toast.success('Profile updated'))}
                    title={`Edit ${u.username}`}
                  />
                  <Button size="sm" variant="outline" disabled={u.id === me?.id}
                    onClick={() => manageAs(managingUserId === u.id ? null : u.id)}>
                    <Eye className="h-3 w-3 mr-1"/>{managingUserId === u.id ? 'Stop Managing' : 'Manage As'}
                  </Button>
                  <Select value={u.role} onValueChange={v => patchUser(u.id, { role: v }).then(()=>toast.success('Role updated'))} disabled={u.id === me?.id}>
                    <SelectTrigger className="h-8 w-24"><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                  </Select>
                  <Button size="sm" variant={u.active?'secondary':'default'} disabled={u.id === me?.id}
                    onClick={() => patchUser(u.id, { active: !u.active }).then(()=>toast(u.active?'Deactivated':'Activated'))}>
                    {u.active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Dialog open={pwOpen === u.id} onOpenChange={(o)=>{ setPwOpen(o?u.id:null); setNewPw('') }}>
                    <DialogTrigger asChild><Button size="sm" variant="outline"><Lock className="h-3 w-3 mr-1"/>Reset PW</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Reset password \u2014 {u.username}</DialogTitle></DialogHeader>
                      <div><Label>New Password</Label><Input type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} autoFocus/></div>
                      <DialogFooter><Button onClick={async()=>{ if(!newPw) return toast.error('Enter new password'); await patchUser(u.id, { password: newPw }); setPwOpen(null); setNewPw(''); toast.success('Password reset')}}>Reset</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <ConfirmDelete
                    onConfirm={() => deleteUser(u.id).then(() => toast('User deleted')).catch(e => toast.error(e.message))}
                    title={`Delete user @${u.username}?`}
                    description={`This will permanently delete the account "${u.displayName || u.username}" AND all their financial data (accounts, incomes, expenses, loans, etc.). This cannot be undone.`}
                    confirmLabel="Delete User & All Data">
                    <Button size="sm" variant="ghost" disabled={u.id === me?.id} onClick={(e)=>e.stopPropagation()}>
                      <Trash2 className="h-4 w-4 text-rose-500"/>
                    </Button>
                  </ConfirmDelete>
                </div>
              </div>
            ))}
            {users.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No users yet</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const Sidebar = ({ active, setActive, mobileOpen, setMobileOpen }) => {
  const { me, logout } = useStore()
  const nav = me?.role === 'admin' ? [...NAV, ADMIN_NAV] : NAV
  return (
    <>
      {mobileOpen && <div className="lg:hidden fixed inset-0 bg-black/40 z-40" onClick={()=>setMobileOpen(false)}/>}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-sidebar text-sidebar-foreground border-r z-50 transform transition-transform lg:translate-x-0 ${mobileOpen?'translate-x-0':'-translate-x-full'} flex flex-col`}>
        <div className="p-5 flex items-center gap-3 border-b">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-amber-500 h-10 w-10 flex items-center justify-center text-white font-bold shadow-lg">A</div>
          <div className="min-w-0">
            <h2 className="font-bold tracking-tight">AgroFin</h2>
            <p className="text-xs text-muted-foreground truncate">Finance × Farm OS</p>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={()=>setMobileOpen(false)}><X className="h-4 w-4"/></Button>
        </div>
        <ScrollArea className="flex-1 p-3">
          <nav className="space-y-1">
            {nav.map(n => {
              const Active = active === n.key
              return (
                <button key={n.key} onClick={()=>{ setActive(n.key); setMobileOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                  ${Active ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}>
                  <n.icon className="h-4 w-4 shrink-0"/>
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-medium">{n.label}</div>
                    <div className={`text-xs truncate ${Active?'text-sidebar-primary-foreground/70':'text-muted-foreground'}`}>{n.hint}</div>
                  </div>
                </button>
              )
            })}
          </nav>
        </ScrollArea>
        <div className="p-3 border-t space-y-2">
          <div className="rounded-lg bg-muted/50 p-2.5 flex items-center gap-2">
            <div className={`rounded-full h-8 w-8 flex items-center justify-center font-bold text-white text-xs shrink-0 ${me?.role==='admin'?'bg-gradient-to-br from-violet-500 to-rose-500':'bg-gradient-to-br from-emerald-500 to-sky-500'}`}>
              {(me?.displayName || me?.username || '?').slice(0,2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{me?.displayName || me?.username}</p>
              <p className="text-xs text-muted-foreground capitalize">{me?.role}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={logout}><LogOut className="h-3 w-3 mr-2"/>Sign Out</Button>
        </div>
      </aside>
    </>
  )
}

const ManagingBanner = () => {
  const { managingUser, manageAs } = useStore()
  if (!managingUser) return null
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-violet-500 to-emerald-500 text-white text-sm px-4 lg:px-8 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4"/>
        <span>You are managing <strong>{managingUser.displayName || managingUser.username}</strong>'s data as an admin. All changes save to their account.</span>
      </div>
      <Button size="sm" variant="secondary" onClick={() => manageAs(null)}>Stop Managing</Button>
    </motion.div>
  )
}

const Shell = () => {
  const { me, loading, managingUser } = useStore()
  const [active, setActive] = useState('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  if (!me) return <LoginScreen/>
  const nav = me.role === 'admin' ? [...NAV, ADMIN_NAV] : NAV
  const currentNav = nav.find(n => n.key === active) || NAV[0]
  const Page = {
    dashboard: <Dashboard go={setActive}/>,
    accounts: <AccountsPage/>,
    income: <IncomePage/>,
    expense: <ExpensePage/>,
    farm: <FarmPage/>,
    loans: <LoansPage/>,
    peers: <PeersPage/>,
    assets: <AssetsPage/>,
    admin: <AdminPage/>,
  }[active]
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <Sidebar active={active} setActive={setActive} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}/>
      <main className="flex-1 min-w-0">
        <ManagingBanner/>
        <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b px-4 lg:px-8 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={()=>setMobileOpen(true)}><Menu className="h-5 w-5"/></Button>
          <p className="text-sm text-muted-foreground">{currentNav.hint}</p>
          <div className="ml-auto flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground"/>}
            {managingUser ? (
              <Badge variant="default" className="gap-1 bg-gradient-to-r from-violet-500 to-emerald-500"><Eye className="h-3 w-3"/>Managing {managingUser.username}</Badge>
            ) : (
              <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3 text-emerald-500"/>Live</Badge>
            )}
          </div>
        </header>
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div key={active + (managingUser?.id || '')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              {Page}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <Toaster richColors position="top-right"/>
    </div>
  )
}

const AgroFinApp = () => (
  <StoreProvider>
    <Shell/>
  </StoreProvider>
)
export default AgroFinApp
