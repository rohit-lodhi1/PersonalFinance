// Reducing-balance loan engine — day-accurate interest accrual.
// Loans have: id, name, lender, principal (initial), annualRate (e.g. 12 = 12%),
// startDate (ISO string), txs: [{ id, date, type: 'principal' | 'interest' | 'disbursement', amount, note }]
// We treat 'disbursement' as adding to outstanding principal (for top-ups).
// 'principal' reduces the outstanding principal directly.
// 'interest' is interest paid out (doesn't change principal, just records that accrued interest was cleared up to that point).

const MS_DAY = 1000 * 60 * 60 * 24

export const daysBetween = (a, b) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS_DAY))

// Build a timeline of principal balance over time and accrue interest piecewise.
// Returns { outstandingPrincipal, accruedInterestSinceLastSettlement, totalInterestAccrued, totalInterestPaid, totalPrincipalPaid, schedule }
export function computeLoanState(loan, asOfDate = new Date()) {
  const start = new Date(loan.startDate)
  const events = [
    { date: start, type: 'disbursement', amount: Number(loan.principal) || 0 },
    ...(loan.txs || []).map(t => ({ ...t, date: new Date(t.date) })),
  ].sort((a, b) => a.date - b.date)

  let principal = 0
  let totalPrincipalPaid = 0
  let totalInterestPaid = 0
  let totalInterestAccrued = 0
  let accruedSinceSettle = 0 // interest sitting unpaid
  let lastDate = start
  const annualRate = Number(loan.annualRate) / 100
  const schedule = []

  const accrueTo = (date) => {
    const days = (date - lastDate) / MS_DAY
    if (days > 0 && principal > 0) {
      const interest = principal * annualRate * (days / 365)
      accruedSinceSettle += interest
      totalInterestAccrued += interest
    }
    lastDate = date
  }

  for (const ev of events) {
    accrueTo(ev.date)
    if (ev.type === 'disbursement') {
      principal += Number(ev.amount) || 0
    } else if (ev.type === 'principal') {
      const amt = Number(ev.amount) || 0
      principal = Math.max(0, principal - amt)
      totalPrincipalPaid += amt
    } else if (ev.type === 'interest') {
      const amt = Number(ev.amount) || 0
      // Reduce accrued bucket; if pay > accrued, surplus goes to principal
      const used = Math.min(accruedSinceSettle, amt)
      accruedSinceSettle -= used
      totalInterestPaid += used
      const surplus = amt - used
      if (surplus > 0) {
        principal = Math.max(0, principal - surplus)
        totalPrincipalPaid += surplus
      }
    }
    schedule.push({
      date: ev.date.toISOString().slice(0, 10),
      type: ev.type,
      amount: ev.amount,
      principalAfter: principal,
      accruedAfter: accruedSinceSettle,
      note: ev.note || '',
    })
  }
  accrueTo(new Date(asOfDate))

  return {
    outstandingPrincipal: principal,
    accruedInterestPending: accruedSinceSettle,
    totalInterestAccrued,
    totalInterestPaid,
    totalPrincipalPaid,
    totalOutstanding: principal + accruedSinceSettle,
    schedule,
  }
}

export function projectInterestPerYear(loan) {
  const s = computeLoanState(loan)
  return s.outstandingPrincipal * (Number(loan.annualRate) / 100)
}

// Lump sum needed to fully close the loan today (principal + accrued interest)
export function payoffToday(loan) {
  const s = computeLoanState(loan)
  return s.outstandingPrincipal + s.accruedInterestPending
}

// Minimum monthly payment that just covers interest (loan stays flat forever)
export function minMonthlyInterest(loan) {
  const s = computeLoanState(loan)
  return s.outstandingPrincipal * (Number(loan.annualRate) / 100) / 12
}

// Simulate paying a fixed monthlyPayment until loan is closed or maxMonths hit.
// Returns months-to-close, total paid, total interest paid, principal trajectory.
export function simulatePayoff(loan, monthlyPayment, maxMonths = 600) {
  const start = computeLoanState(loan)
  let principal = start.outstandingPrincipal
  let accrued = start.accruedInterestPending
  const annualRate = Number(loan.annualRate) / 100
  const monthlyRateDays = 30.4375
  let totalInterestPaid = 0
  let totalPrincipalPaid = 0
  let months = 0
  const schedule = [{ month: 0, principal, totalPaid: 0, totalInterest: 0 }]
  const minPayment = principal * annualRate * (monthlyRateDays / 365)

  // If monthly payment doesn't even cover one month of interest, loan never closes
  if (monthlyPayment <= minPayment && principal > 0) {
    return {
      months: Infinity,
      totalPaid: 0,
      totalInterestPaid: 0,
      totalPrincipalPaid: 0,
      finalPrincipal: principal,
      schedule,
      closed: false,
      neverCloses: true,
      minRequiredMonthly: minPayment,
      payoffDate: null,
      startingPrincipal: principal,
      startingAccrued: accrued,
    }
  }

  while (principal > 0.01 && months < maxMonths) {
    months++
    // Accrue one month of interest at current principal
    const interestThisMonth = principal * annualRate * (monthlyRateDays / 365)
    accrued += interestThisMonth

    // The amount the user has available to pay this month
    let payment = Math.min(monthlyPayment, principal + accrued)
    if (payment <= 0) break

    // Pay accrued interest first, then principal
    const interestPaid = Math.min(accrued, payment)
    accrued -= interestPaid
    totalInterestPaid += interestPaid
    const principalPaid = payment - interestPaid
    principal = Math.max(0, principal - principalPaid)
    totalPrincipalPaid += principalPaid

    schedule.push({ month: months, principal, totalPaid: totalPrincipalPaid + totalInterestPaid, totalInterest: totalInterestPaid })
  }

  const today = new Date()
  const payoffDate = principal <= 0.01 ? new Date(today.getTime() + months * monthlyRateDays * 86400000) : null

  return {
    months,
    totalPaid: totalPrincipalPaid + totalInterestPaid,
    totalInterestPaid,
    totalPrincipalPaid,
    finalPrincipal: principal,
    finalAccrued: accrued,
    schedule,
    closed: principal <= 0.01,
    neverCloses: false,
    payoffDate,
    startingPrincipal: start.outstandingPrincipal,
    startingAccrued: start.accruedInterestPending,
  }
}
