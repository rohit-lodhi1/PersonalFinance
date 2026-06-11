'use client'
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Wallet, TrendingUp, Receipt, Tractor, Landmark,
  HandCoins, Gem, Menu, X, Plus, Trash2, ArrowDownRight, ArrowUpRight,
  Sparkles, Calendar, Target, AlertCircle, CheckCircle2, Sprout,
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
              <Button variant="ghost" size="icon" onClick={() => { remove('accounts', a.id); toast('Account removed') }}>
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            </div>
            <div className="mt-4">
              <Label className="text-xs">Adjust balance</Label>
              <Input type="number" defaultValue={a.balance} onBlur={e => update('accounts', a.id, { balance: Number(e.target.value) })} className="mt-1" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ---------- INCOME ----------
const IncomePage = () => {
  const { state, add, remove } = useStore()
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
            <div className="space-y-2 max-h-96 overflow-auto">
              {state.incomes.map(i => (
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
                    <Button variant="ghost" size="icon" onClick={() => remove('incomes', i.id)}><Trash2 className="h-4 w-4 text-rose-500"/></Button>
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
const BUDGET = 80000
const ExpensePage = () => {
  const { state, add, remove } = useStore()
  const [form, setForm] = useState({ label: '', category: 'Household', amount: '', date: new Date().toISOString().slice(0,10) })
  const month = state.expenses.filter(e => new Date(e.date) > new Date(Date.now()-86400000*30))
  const monthAmt = month.reduce((s,e)=>s+Number(e.amount),0)
  const byCat = useMemo(() => {
    const m = {}
    month.forEach(e => { m[e.category] = (m[e.category]||0) + Number(e.amount) })
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value)
  }, [state.expenses])
  const topCat = byCat[0]
  const remaining = BUDGET - monthAmt
  const pct = Math.min(100, (monthAmt / BUDGET) * 100)

  const submit = () => {
    if (!form.label || !form.amount) return toast.error('Label and amount required')
    add('expenses', { ...form, amount: Number(form.amount) })
    setForm({ ...form, label: '', amount: '' }); toast.success('Expense logged')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Expense Logs" subtitle="Where every rupee went this month" />
      <SummaryStats items={[
        { icon: Receipt, label: 'Spent This Month', value: fmtINR(monthAmt), sub: `${month.length} transactions`, accent: 'rose' },
        { icon: AlertCircle, label: 'Top Category', value: topCat?.name || '—', sub: topCat ? fmtINR(topCat.value) : '', accent: 'amber' },
        { icon: Target, label: 'Budget Remaining', value: fmtINR(remaining), sub: `${pct.toFixed(0)}% used of ${fmtINR(BUDGET)}`, accent: remaining < 0 ? 'rose' : 'emerald' },
        { icon: TrendingUp, label: 'Avg / Day', value: fmtINR(monthAmt/30), sub: 'Rolling 30-day', accent: 'sky' },
      ]} />

      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between mb-2"><p className="text-sm font-medium">Monthly Budget Pace</p><p className="text-sm text-muted-foreground">{fmtINR(monthAmt)} / {fmtINR(BUDGET)}</p></div>
        <Progress value={pct} className="h-3"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent Expenses</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-auto">
              {state.expenses.map(e => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full p-2 bg-rose-500/10 text-rose-500"><ArrowDownRight className="h-4 w-4"/></div>
                    <div><p className="font-medium">{e.label}</p><p className="text-xs text-muted-foreground">{e.category} • {e.date}</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-rose-500">−{fmtINRFull(e.amount)}</p>
                    <Button variant="ghost" size="icon" onClick={() => remove('expenses', e.id)}><Trash2 className="h-4 w-4 text-rose-500"/></Button>
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
        <CardHeader><CardTitle>Spend by Category</CardTitle><CardDescription>Last 30 days</CardDescription></CardHeader>
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
const FarmPage = () => {
  const { state, add, remove, update } = useStore()
  const [form, setForm] = useState({ name: '', area: '', sowDate: new Date().toISOString().slice(0,10), expectedHarvest: '', investments: '', expectedRevenue: '', status: 'growing' })
  const totalInv = state.crops.reduce((s,c)=>s+Number(c.investments),0)
  const totalRev = state.crops.reduce((s,c)=>s+Number(c.expectedRevenue),0)
  const profit = totalRev - totalInv
  const margin = totalRev > 0 ? (profit/totalRev)*100 : 0

  const submit = () => {
    if (!form.name || !form.investments) return toast.error('Crop name and investment required')
    add('crops', { ...form, area: Number(form.area), investments: Number(form.investments), expectedRevenue: Number(form.expectedRevenue) })
    setForm({ ...form, name: '', area: '', investments: '', expectedRevenue: '', expectedHarvest: '' }); toast.success('Crop cycle added')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Farming Profitability" subtitle="Crop cycle P&L, season by season" />
      <SummaryStats items={[
        { icon: Tractor, label: 'Total Invested', value: fmtINR(totalInv), sub: `${state.crops.length} crop cycles`, accent: 'amber' },
        { icon: Sprout, label: 'Projected Revenue', value: fmtINR(totalRev), sub: 'On expected harvest', accent: 'emerald' },
        { icon: TrendingUp, label: 'Projected Profit', value: fmtINR(profit), sub: `${margin.toFixed(1)}% margin`, accent: profit>=0?'emerald':'rose' },
        { icon: CheckCircle2, label: 'Active Cycles', value: state.crops.filter(c=>c.status!=='harvested').length, sub: 'In field right now', accent: 'sky' },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {state.crops.map(c => {
            const cProfit = Number(c.expectedRevenue) - Number(c.investments)
            const cMargin = c.expectedRevenue > 0 ? (cProfit/Number(c.expectedRevenue))*100 : 0
            return (
              <Card key={c.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2"><h3 className="font-semibold text-lg">{c.name}</h3><Badge variant="outline" className="capitalize">{c.status}</Badge></div>
                      <p className="text-xs text-muted-foreground mt-1">{c.area} acres • Sowed {c.sowDate} • Harvest {c.expectedHarvest || 'TBD'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Select value={c.status} onValueChange={v=>update('crops', c.id, { status: v })}>
                        <SelectTrigger className="h-8 w-32"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          {['growing','perennial','harvested','failed'].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={()=>remove('crops', c.id)}><Trash2 className="h-4 w-4 text-rose-500"/></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Invested</p><p className="font-semibold">{fmtINRFull(c.investments)}</p></div>
                    <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Expected Rev</p><p className="font-semibold text-emerald-500">{fmtINRFull(c.expectedRevenue)}</p></div>
                    <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Margin</p><p className={`font-semibold ${cProfit>=0?'text-emerald-500':'text-rose-500'}`}>{cMargin.toFixed(1)}%</p></div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {state.crops.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No crops yet — add your first cycle →</p>}
        </div>

        <Card>
          <CardHeader><CardTitle>Add Crop Cycle</CardTitle></CardHeader>
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
            <div><Label>Investments (₹)</Label><Input type="number" value={form.investments} onChange={e=>setForm({...form, investments:e.target.value})}/></div>
            <div><Label>Expected Revenue (₹)</Label><Input type="number" value={form.expectedRevenue} onChange={e=>setForm({...form, expectedRevenue:e.target.value})}/></div>
            <Button className="w-full" onClick={submit}><Plus className="h-4 w-4 mr-2"/>Add Cycle</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---------- LOANS (the heart) ----------
const LoanCard = ({ loan }) => {
  const { addLoanTx, remove, removeLoanTx } = useStore()
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
          <Button variant="ghost" size="icon" onClick={()=>remove('loans', loan.id)}><Trash2 className="h-4 w-4 text-rose-500"/></Button>
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
            <div className="space-y-1 max-h-56 overflow-auto">
              {[...(loan.txs||[])].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(t => (
                <div key={t.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={t.type==='principal'?'default':t.type==='interest'?'secondary':'outline'} className="capitalize">{t.type}</Badge>
                    <span className="text-xs text-muted-foreground">{t.date}</span>
                    {t.note && <span className="text-xs italic text-muted-foreground">— {t.note}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">{fmtINRFull(t.amount)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={()=>removeLoanTx(loan.id, t.id)}><Trash2 className="h-3 w-3 text-rose-500"/></Button>
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
  const { state, add } = useStore()
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
            <div className="space-y-2 max-h-[28rem] overflow-auto">
              {state.peers.map(p => (
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
                    <Button variant="ghost" size="icon" onClick={()=>remove('peers', p.id)}><Trash2 className="h-4 w-4 text-rose-500"/></Button>
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
  const { state, add, remove } = useStore()
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
                    <Button variant="ghost" size="icon" onClick={()=>remove('assets', a.id)}><Trash2 className="h-4 w-4 text-rose-500"/></Button>
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
const Sidebar = ({ active, setActive, mobileOpen, setMobileOpen }) => {
  return (
    <>
      {mobileOpen && <div className="lg:hidden fixed inset-0 bg-black/40 z-40" onClick={()=>setMobileOpen(false)}/>}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-sidebar text-sidebar-foreground border-r z-50 transform transition-transform lg:translate-x-0 ${mobileOpen?'translate-x-0':'-translate-x-full'} flex flex-col`}>
        <div className="p-5 flex items-center gap-3 border-b">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-amber-500 h-10 w-10 flex items-center justify-center text-white font-bold shadow-lg">A</div>
          <div>
            <h2 className="font-bold tracking-tight">AgroFin</h2>
            <p className="text-xs text-muted-foreground">Finance × Farm OS</p>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={()=>setMobileOpen(false)}><X className="h-4 w-4"/></Button>
        </div>
        <ScrollArea className="flex-1 p-3">
          <nav className="space-y-1">
            {NAV.map(n => {
              const Active = active === n.key
              return (
                <button key={n.key} onClick={()=>{ setActive(n.key); setMobileOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                  ${Active ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}>
                  <n.icon className="h-4 w-4 shrink-0"/>
                  <div className="text-left flex-1">
                    <div className="font-medium">{n.label}</div>
                    <div className={`text-xs ${Active?'text-sidebar-primary-foreground/70':'text-muted-foreground'}`}>{n.hint}</div>
                  </div>
                </button>
              )
            })}
          </nav>
        </ScrollArea>
        <div className="p-3 border-t">
          <ResetButton/>
        </div>
      </aside>
    </>
  )
}

const ResetButton = () => {
  const { reset } = useStore()
  return <Button variant="outline" size="sm" className="w-full" onClick={()=>{ if(confirm('Reset all data to defaults?')) { reset(); toast('Data reset') } }}>Reset Demo Data</Button>
}

const Shell = () => {
  const [active, setActive] = useState('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const Page = {
    dashboard: <Dashboard go={setActive}/>,
    accounts: <AccountsPage/>,
    income: <IncomePage/>,
    expense: <ExpensePage/>,
    farm: <FarmPage/>,
    loans: <LoansPage/>,
    peers: <PeersPage/>,
    assets: <AssetsPage/>,
  }[active]
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <Sidebar active={active} setActive={setActive} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}/>
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b px-4 lg:px-8 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={()=>setMobileOpen(true)}><Menu className="h-5 w-5"/></Button>
          <p className="text-sm text-muted-foreground">{NAV.find(n=>n.key===active)?.hint}</p>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3 text-emerald-500"/>Live</Badge>
          </div>
        </header>
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
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
