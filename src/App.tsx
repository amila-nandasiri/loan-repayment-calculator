import { ArrowLeft, Check, ChevronDown, Download, FileSpreadsheet, Github, Link2, Printer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Inputs } from "./components/Inputs";
import { BalanceChart, Comparison, Schedules, YearlyChart } from "./components/Results";
import { downloadCsv, downloadWorkbook } from "./lib/excel";
import { date, money, moneyShort, setCurrency } from "./lib/format";
import { calculate, METHOD_LABEL, PRESETS, type LoanInput, type Result } from "./lib/loan";

const REPO = "https://github.com/amila-nandasiri/loan-repayment-calculator";
const SITE = "https://dewapriya.com";
const OFFLINE_FILE = "loan-repayment-calculator.html";
const isOffline = typeof location !== "undefined" && location.protocol === "file:";

// The scenario is kept in the address (#s=…) so a link reopens the same calculation
function readHash(): LoanInput | null {
  try {
    const m = location.hash.match(/^#s=(.+)$/);
    if (!m) return null;
    const parsed = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    return { ...PRESETS[0].input, ...parsed, rateChange: { ...PRESETS[0].input.rateChange, ...(parsed.rateChange ?? {}) } };
  } catch {
    return null;
  }
}
const writeHash = (v: LoanInput) => `#s=${btoa(unescape(encodeURIComponent(JSON.stringify(v))))}`;

function Kpi({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "good" }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4 md:p-5 break-inside-avoid">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`text-2xl md:text-[1.7rem] font-semibold tracking-tight mt-1 tabular-nums ${tone === "good" ? "text-emerald-700" : "text-zinc-900"}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-2">{note}</p>
    </div>
  );
}

function ReportMenu({ r }: { r: Result }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const item = "w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-lg hover:bg-zinc-100";
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div className="flex items-center gap-2">
      {!isOffline && (
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard blocked: the address bar still has the link */
            }
          }}
          className="inline-flex items-center gap-2 text-sm border border-zinc-200 rounded-full px-4 py-2 text-zinc-700 hover:border-zinc-400 transition-colors bg-white"
          title="Copy a link that reopens this exact calculation"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Link2 className="w-4 h-4" />} <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
        </button>
      )}
      <div className="relative" ref={ref}>
        <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-2 text-sm border border-zinc-200 rounded-full px-4 py-2 text-zinc-700 hover:border-zinc-400 transition-colors bg-white">
          <Download className="w-4 h-4" /> Download <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-72 bg-white border border-zinc-200 rounded-xl shadow-xl p-1.5 z-40 text-sm">
            <button className={item} onClick={pick(() => downloadWorkbook(r))}>
              <FileSpreadsheet className="w-4 h-4 mt-0.5 text-emerald-700" />
              <span>
                <span className="block font-medium text-zinc-900">Excel schedule</span>
                <span className="text-xs text-zinc-500">Summary, full schedule and IFRS 9 view</span>
              </span>
            </button>
            <button className={item} onClick={pick(() => window.print())}>
              <Printer className="w-4 h-4 mt-0.5 text-zinc-500" />
              <span>
                <span className="block font-medium text-zinc-900">PDF</span>
                <span className="text-xs text-zinc-500">Print or "Save as PDF" this page</span>
              </span>
            </button>
            <div className="border-t border-zinc-100 my-1" />
            <button className={item} onClick={pick(() => downloadCsv(r))}>
              <Download className="w-4 h-4 mt-0.5 text-zinc-500" />
              <span className="font-medium text-zinc-900">Schedule (CSV)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const initial = useMemo(() => readHash(), []);
  const [input, setInput] = useState<LoanInput>(initial ?? PRESETS[0].input);
  const [preset, setPreset] = useState<string | null>(initial ? null : PRESETS[0].key);

  useEffect(() => {
    history.replaceState(null, "", writeHash(input));
  }, [input]);

  const r = useMemo(() => {
    setCurrency(input.currency || "USD");
    return calculate(input);
  }, [input]);
  const s = r.schedule;
  const graceRows = s.rows.filter((x) => x.period <= Math.round(input.graceYears * r.ppy));
  // A loan "varies" only if its regular payments change; a smaller final payment (after prepayments) doesn't count
  const regular = s.rows.slice(graceRows.length, -1).map((x) => x.payment);
  const varies = graceRows.length > 0 || (regular.length > 0 && Math.max(...regular) - Math.min(...regular) > 0.5);
  const finalDiffers = !varies && s.rows.length > 1 && Math.abs(s.lastInstalment - s.firstInstalment) > 0.5;
  const fmtRange = (n: number) => (n >= 100000 ? moneyShort(n) : money(n));
  const hasExtras = r.baseline !== r.schedule;
  const years = Math.floor(s.periods / r.ppy);
  const rem = s.periods - years * r.ppy;
  const duration = `${years} yr${years === 1 ? "" : "s"}${rem ? ` ${Math.round((rem * 12) / r.ppy)} mo` : ""}`;
  const perWord = { monthly: "month", quarterly: "quarter", "semi-annual": "half-year", annual: "year" }[input.frequency];

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-zinc-500">Borrowing · repayments, true cost and accounting</p>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-zinc-900 mt-1">Loan Repayment Calculator</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <ReportMenu r={r} />
            {!isOffline && (
              <>
                <a href={REPO} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm border border-zinc-200 rounded-full px-4 py-2 text-zinc-700 hover:border-zinc-400 transition-colors" title="Source code">
                  <Github className="w-4 h-4" /> <span className="hidden sm:inline">Code</span>
                </a>
                <a href={SITE} className="inline-flex items-center gap-1.5 text-sm bg-zinc-900 text-white rounded-full px-4 py-2 hover:bg-zinc-700 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Portfolio
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <p className="hidden print:block text-sm text-zinc-700 mb-4">
          {money(input.amount)} at {input.ratePct}% over {input.termYears} years, {METHOD_LABEL[input.method].toLowerCase()}, paid {input.frequency}. Fees {money(r.fees)}.
        </p>
        <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
          <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto rounded-2xl">
            <Inputs
              value={input}
              preset={preset}
              onChange={(v) => {
                setInput(v);
                setPreset(null);
              }}
              onPreset={(k) => {
                setInput(PRESETS.find((p) => p.key === k)!.input);
                setPreset(k);
              }}
            />
          </div>

          <div className="space-y-6 min-w-0">
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
              <Kpi
                label={varies ? `Payment per ${perWord}` : `${perWord[0].toUpperCase() + perWord.slice(1)}ly payment`}
                value={varies ? `${fmtRange(Math.min(s.firstInstalment, s.lastInstalment))}–${fmtRange(Math.max(s.firstInstalment, s.lastInstalment, s.maxInstalment))}` : money(s.firstInstalment)}
                note={
                  graceRows.length
                    ? `${money(graceRows[0].payment)} interest-only for the first ${graceRows.length} payments`
                    : varies
                      ? `First ${money(s.firstInstalment)}, last ${money(s.lastInstalment)}`
                      : finalDiffers
                        ? `${s.periods - 1} payments, then a final ${money(s.lastInstalment)}`
                        : `${s.periods} payments`
                }
              />
              <Kpi label="Total interest" value={money(s.totalInterest)} note={`${((s.totalInterest / Math.max(1, input.amount)) * 100).toFixed(1)}% of the amount borrowed`} />
              <Kpi label="Total cost of the loan" value={money(s.totalInterest + r.fees)} note={`Interest plus ${money(r.fees)} fees`} />
              <Kpi label="Paid off" value={date(s.payoffDate)} note={`${duration} · ${s.periods} payments`} />
              <Kpi
                label="Effective interest rate"
                value={r.eirAnnualEffective === null ? "n/a" : `${(r.eirAnnualEffective * 100).toFixed(2)}%`}
                note={r.apr === null ? "Couldn't be calculated" : `APR ${(r.apr * 100).toFixed(2)}% vs ${input.ratePct}% quoted${r.fees ? ", including fees" : ""}`}
              />
              {hasExtras ? (
                <Kpi label="Saved by extra payments" value={money(r.interestSaved)} tone="good" note={r.periodsSaved > 0 ? `Interest saved, and ${r.periodsSaved} payments sooner` : "Interest saved; payments reduced instead"} />
              ) : (
                <Kpi label="Total repaid" value={money(s.totalPaid)} note="Principal and interest" />
              )}
            </div>

            <div className="grid xl:grid-cols-2 gap-6">
              <BalanceChart r={r} />
              <YearlyChart r={r} />
            </div>

            <Comparison r={r} />
            <Schedules r={r} />

            <section className="grid md:grid-cols-3 gap-6 text-sm text-zinc-600 pt-2 break-inside-avoid">
              <div>
                <h3 className="font-medium text-zinc-900 mb-1">How payments are worked out</h3>
                <p>
                  The periodic rate is the annual rate divided by payments per year, as banks quote it. Equal instalments use the standard annuity formula, recalculated if the
                  rate changes. Equal principal repays the same principal each time.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-zinc-900 mb-1">Effective interest rate</h3>
                <p>
                  The rate that discounts every payment back to the cash you actually receive: the loan less fees. Shown as an annual effective rate and as a nominal APR. This is
                  the true cost of borrowing.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-zinc-900 mb-1">IFRS 9 amortised cost</h3>
                <p>
                  A borrower records the loan net of fees and charges interest at the effective rate (IFRS 9.5.4.1). The fees are spread over the loan instead of expensed on day
                  one, and the carrying amount reaches zero at the end.
                </p>
              </div>
            </section>

            {!isOffline && (
              <section className="bg-white border border-zinc-200 rounded-2xl p-5 md:p-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
                <div>
                  <h2 className="font-semibold text-zinc-900">Use it offline</h2>
                  <p className="text-sm text-zinc-500 mt-0.5 max-w-xl">Download the calculator as a single HTML file that works in any browser, with or without internet.</p>
                </div>
                <a href={OFFLINE_FILE} download className="inline-flex items-center gap-2 text-sm font-medium bg-zinc-900 text-white rounded-full px-5 py-2.5 hover:bg-zinc-700 transition-colors">
                  <Download className="w-4 h-4" /> Download HTML file
                </a>
              </section>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-wrap justify-between gap-2 text-xs text-zinc-500">
          <p>
            Built by <a href={SITE} className="text-zinc-900 hover:underline">Amila Dewapriya</a>, CMA · for illustration, not financial advice
          </p>
          <p className="font-mono">React · TypeScript · Recharts</p>
        </div>
      </footer>
    </div>
  );
}
