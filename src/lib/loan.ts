// Loan repayment engine: amortisation schedules for annuity (equal instalment),
// equal-principal and interest-only loans, with grace periods, extra payments,
// a rate change, upfront fees, the effective interest rate and an IFRS 9
// amortised-cost schedule.
//
// Conventions
// - The periodic rate is the nominal annual rate divided by payments per year
//   (how banks quote loans: 12% a year, paid monthly, is 1% a month).
// - Payments fall at the end of each period; period k is k periods after the start date.
// - The effective interest rate is the internal rate of return of the borrower's
//   cash flows: the amount received net of fees, then every payment. It is shown
//   both as an annual effective rate and as a nominal APR.

export type Frequency = "monthly" | "quarterly" | "semi-annual" | "annual";
export type Method = "annuity" | "equal-principal" | "interest-only";
export type ExtraMode = "reduce-term" | "reduce-payment";

export const PERIODS_PER_YEAR: Record<Frequency, number> = { monthly: 12, quarterly: 4, "semi-annual": 2, annual: 1 };
export const METHOD_LABEL: Record<Method, string> = {
  annuity: "Equal instalments (EMI)",
  "equal-principal": "Equal principal",
  "interest-only": "Interest-only, balloon at end"
};

export type LumpSum = { period: number; amount: number };

export type LoanInput = {
  amount: number;
  ratePct: number; // nominal annual
  termYears: number;
  frequency: Frequency;
  startDate: string; // ISO; first payment one period later
  method: Method;
  graceYears: number; // interest-only period at the start
  feePct: number; // upfront fee, % of amount
  feeFixed: number; // upfront fee, fixed amount
  extraPerPeriod: number; // recurring extra principal each period
  lumpSums: LumpSum[];
  extraMode: ExtraMode;
  rateChange: { enabled: boolean; fromYear: number; ratePct: number };
  currency: string;
};

export type Row = {
  period: number;
  date: string;
  ratePct: number;
  opening: number;
  payment: number; // scheduled instalment (interest + scheduled principal)
  interest: number;
  principal: number; // scheduled principal
  extra: number; // extra principal
  closing: number;
};

export type Schedule = {
  rows: Row[];
  firstInstalment: number;
  lastInstalment: number;
  maxInstalment: number;
  totalInterest: number;
  totalPaid: number;
  periods: number;
  payoffDate: string;
};

export type Result = {
  input: LoanInput;
  ppy: number;
  scheduledPeriods: number;
  fees: number;
  schedule: Schedule;
  baseline: Schedule; // the same loan without extra payments
  interestSaved: number;
  periodsSaved: number;
  eirPeriodic: number | null;
  eirAnnualEffective: number | null;
  apr: number | null;
  ifrs9: { period: number; date: string; opening: number; interestExpense: number; cashInterest: number; feeAmortised: number; payment: number; closing: number }[];
  eirRevisions: { period: number; eirPeriodic: number }[]; // IFRS 9 EIR, and any revision at a rate reset
  comparison: { method: Method; first: number; last: number; totalInterest: number; totalPaid: number; payoffDate: string }[];
};

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}

/** Level payment that repays `pv` over `n` periods at rate `i` */
export function pmt(i: number, n: number, pv: number) {
  if (n <= 0) return pv;
  if (Math.abs(i) < 1e-12) return pv / n;
  return (pv * i) / (1 - Math.pow(1 + i, -n));
}

function buildSchedule(inp: LoanInput, withExtras: boolean): Schedule {
  const ppy = PERIODS_PER_YEAR[inp.frequency];
  const n = Math.max(1, Math.round(inp.termYears * ppy));
  const grace = Math.min(n - 1, Math.max(0, Math.round(inp.graceYears * ppy)));
  const monthsPerPeriod = 12 / ppy;
  // The new rate applies from the first payment period of year `fromYear`
  const changeFrom = inp.rateChange.enabled ? Math.max(1, Math.round((inp.rateChange.fromYear - 1) * ppy) + 1) : Infinity;
  const lump = new Map<number, number>();
  if (withExtras) for (const l of inp.lumpSums) if (l.amount > 0 && l.period >= 1) lump.set(Math.round(l.period), (lump.get(Math.round(l.period)) ?? 0) + l.amount);

  const rows: Row[] = [];
  let balance = inp.amount;
  let instalment = 0; // annuity instalment, recalculated when the rate changes or (optionally) after prepayments
  let fixedPrincipal = 0; // equal-principal amount
  let currentRate = -1;
  let needRecalc = true; // annuity: recalculate the instalment (rate change, or prepayment that lowers payments)
  let recalcPrincipal = false; // equal principal: spread the remaining balance again after a prepayment
  // Balance on the contractual schedule (ignoring extra payments). When the rate changes, a
  // "finish sooner" loan recalculates its instalment from this, so prepayments keep shortening the term.
  let contractual = inp.amount;

  for (let k = 1; k <= n && balance > 0.005; k++) {
    const ratePct = k >= changeFrom ? inp.rateChange.ratePct : inp.ratePct;
    const i = ratePct / 100 / ppy;
    if (ratePct !== currentRate) {
      currentRate = ratePct;
      needRecalc = true;
    }
    const opening = balance;
    const interest = opening * i;
    const remaining = n - k + 1; // periods left including this one

    let principal = 0;
    if (k <= grace) {
      principal = 0;
    } else if (inp.method === "annuity") {
      if (needRecalc || k === grace + 1) {
        instalment = pmt(i, remaining, inp.extraMode === "reduce-payment" ? opening : contractual);
        needRecalc = false;
      }
      principal = Math.min(opening, instalment - interest);
    } else if (inp.method === "equal-principal") {
      if (k === grace + 1 || recalcPrincipal) {
        fixedPrincipal = opening / remaining;
        recalcPrincipal = false;
      }
      principal = Math.min(opening, fixedPrincipal);
    } else {
      principal = k === n ? opening : 0;
    }
    if (k === n) principal = opening; // final period clears any rounding

    // Advance the contractual balance with scheduled payments only
    if (inp.method === "annuity" && k > grace) contractual = Math.max(0, contractual - Math.max(0, instalment - contractual * i));

    const extraWanted = withExtras ? inp.extraPerPeriod + (lump.get(k) ?? 0) : 0;
    const extra = Math.max(0, Math.min(opening - principal, extraWanted));
    const closing = opening - principal - extra;
    rows.push({ period: k, date: addMonths(inp.startDate, k * monthsPerPeriod), ratePct, opening, payment: interest + principal, interest, principal, extra, closing: Math.abs(closing) < 0.005 ? 0 : closing });
    balance = closing;
    if (extra > 0 && inp.extraMode === "reduce-payment") {
      needRecalc = true;
      recalcPrincipal = true;
    }
  }

  const totalInterest = rows.reduce((t, r) => t + r.interest, 0);
  const totalPaid = rows.reduce((t, r) => t + r.payment + r.extra, 0);
  const afterGrace = rows.filter((r) => r.period > grace);
  const payments = (afterGrace.length ? afterGrace : rows).map((r) => r.payment);
  return {
    rows,
    firstInstalment: payments[0] ?? 0,
    lastInstalment: payments[payments.length - 1] ?? 0,
    maxInstalment: Math.max(...rows.map((r) => r.payment)),
    totalInterest,
    totalPaid,
    periods: rows.length,
    payoffDate: rows[rows.length - 1]?.date ?? inp.startDate
  };
}

/** Periodic internal rate of return by bisection on [−0.99, 1] (NPV falls as the rate rises for a borrower's flows) */
export function irr(flows: number[]): number | null {
  const npv = (r: number) => flows.reduce((t, f, k) => t + f / Math.pow(1 + r, k), 0);
  let lo = -0.99;
  let hi = 1;
  let fLo = npv(lo);
  const fHi = npv(hi);
  if (Number.isNaN(fLo) || Number.isNaN(fHi) || fLo * fHi > 0) return null;
  for (let it = 0; it < 200; it++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-9) return mid;
    if (fLo * fMid < 0) hi = mid;
    else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

export function calculate(inp: LoanInput): Result {
  const ppy = PERIODS_PER_YEAR[inp.frequency];
  const schedule = buildSchedule(inp, true);
  const hasExtras = inp.extraPerPeriod > 0 || inp.lumpSums.some((l) => l.amount > 0);
  const baseline = hasExtras ? buildSchedule(inp, false) : schedule;
  const fees = (inp.amount * inp.feePct) / 100 + inp.feeFixed;

  // Effective interest rate: borrower receives amount − fees, then pays every instalment
  const flows = [inp.amount - fees, ...schedule.rows.map((r) => -(r.payment + r.extra))];
  const eirPeriodic = inp.amount > 0 && schedule.rows.length ? irr(flows) : null;

  // IFRS 9 amortised cost (borrower): the carrying amount starts net of fees and accrues at the EIR.
  // The initial EIR uses the cash flows expected at inception, at the original rate. For a floating
  // rate, the EIR is revised when the rate resets, from the carrying amount then (IFRS 9 B5.4.5).
  const ifrs9: Result["ifrs9"] = [];
  const resetPeriod = inp.rateChange.enabled ? Math.round((inp.rateChange.fromYear - 1) * ppy) + 1 : Infinity;
  const atInception = inp.rateChange.enabled ? buildSchedule({ ...inp, rateChange: { ...inp.rateChange, enabled: false } }, true) : schedule;
  const eirInitial = inp.amount > 0 && atInception.rows.length ? irr([inp.amount - fees, ...atInception.rows.map((r) => -(r.payment + r.extra))]) : null;
  const eirRevisions: { period: number; eirPeriodic: number }[] = [];
  if (eirInitial !== null) {
    let carrying = inp.amount - fees;
    let eir = eirInitial;
    eirRevisions.push({ period: 1, eirPeriodic: eir });
    for (const [idx, r] of schedule.rows.entries()) {
      if (r.period === resetPeriod) {
        const revised = irr([carrying, ...schedule.rows.slice(idx).map((x) => -(x.payment + x.extra))]);
        if (revised !== null) {
          eir = revised;
          eirRevisions.push({ period: r.period, eirPeriodic: eir });
        }
      }
      const opening = carrying;
      const interestExpense = opening * eir;
      const payment = r.payment + r.extra;
      carrying = opening + interestExpense - payment;
      ifrs9.push({ period: r.period, date: r.date, opening, interestExpense, cashInterest: r.interest, feeAmortised: interestExpense - r.interest, payment, closing: Math.abs(carrying) < 0.01 ? 0 : carrying });
    }
  }

  const comparison = (["annuity", "equal-principal", "interest-only"] as Method[]).map((method) => {
    const s = buildSchedule({ ...inp, method }, true);
    return { method, first: s.firstInstalment, last: s.lastInstalment, totalInterest: s.totalInterest, totalPaid: s.totalPaid, payoffDate: s.payoffDate };
  });

  return {
    input: inp,
    ppy,
    scheduledPeriods: Math.max(1, Math.round(inp.termYears * ppy)),
    fees,
    schedule,
    baseline,
    interestSaved: baseline.totalInterest - schedule.totalInterest,
    periodsSaved: baseline.periods - schedule.periods,
    eirPeriodic,
    eirAnnualEffective: eirPeriodic === null ? null : Math.pow(1 + eirPeriodic, ppy) - 1,
    apr: eirPeriodic === null ? null : eirPeriodic * ppy,
    ifrs9,
    eirRevisions,
    comparison
  };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const base: LoanInput = {
  amount: 500000,
  ratePct: 7.5,
  termYears: 5,
  frequency: "monthly",
  startDate: "2026-12-01",
  method: "annuity",
  graceYears: 0,
  feePct: 1,
  feeFixed: 0,
  extraPerPeriod: 0,
  lumpSums: [],
  extraMode: "reduce-term",
  rateChange: { enabled: false, fromYear: 2, ratePct: 8.5 },
  currency: "USD"
};

export const PRESETS: { key: string; label: string; note: string; input: LoanInput }[] = [
  { key: "business", label: "Business term loan", note: "$500K over 5 years at 7.5%, 1% arrangement fee", input: base },
  { key: "home", label: "Home loan", note: "$250K over 25 years at 6.5%, $1,500 fees, $200 extra a month", input: { ...base, amount: 250000, ratePct: 6.5, termYears: 25, feePct: 0, feeFixed: 1500, extraPerPeriod: 200 } },
  { key: "car", label: "Car loan", note: "$35K over 5 years at 8.9%, $400 fee", input: { ...base, amount: 35000, ratePct: 8.9, termYears: 5, feePct: 0, feeFixed: 400 } },
  {
    key: "aircraft",
    label: "Aircraft financing",
    note: "$6M seaplane over 10 years, quarterly, 1-year grace, rate up 1 pt from year 3",
    input: { ...base, amount: 6000000, ratePct: 7.0, termYears: 10, frequency: "quarterly", method: "equal-principal", graceYears: 1, feePct: 0.75, rateChange: { enabled: true, fromYear: 3, ratePct: 8.0 } }
  }
];
