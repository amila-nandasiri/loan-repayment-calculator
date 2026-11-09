import { Plus, X } from "lucide-react";
import { addMonths, METHOD_LABEL, PERIODS_PER_YEAR, PRESETS, type ExtraMode, type Frequency, type LoanInput, type Method } from "../lib/loan";
import { date } from "../lib/format";

const input = "w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-zinc-300";
const label = "block text-xs text-zinc-500";

function Num({ value, onChange, step = 1, min = 0, suffix }: { value: number; onChange: (n: number) => void; step?: number; min?: number; suffix?: string }) {
  return (
    <div className="relative mt-1">
      <input type="number" value={Number.isFinite(value) ? value : ""} step={step} min={min} onChange={(e) => onChange(e.target.value === "" ? 0 : Math.max(min, Number(e.target.value)))} className={`${input} ${suffix ? "pr-12" : ""}`} />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none">{suffix}</span>}
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 bg-zinc-100 p-1 rounded-lg mt-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={`text-xs py-1.5 px-1 rounded-md ${value === v ? "bg-white shadow-sm text-zinc-900 font-medium" : "text-zinc-600 hover:text-zinc-900"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Inputs({ value: v, onChange, preset, onPreset }: { value: LoanInput; onChange: (v: LoanInput) => void; preset: string | null; onPreset: (key: string) => void }) {
  const set = <K extends keyof LoanInput>(k: K, x: LoanInput[K]) => onChange({ ...v, [k]: x });
  const ppy = PERIODS_PER_YEAR[v.frequency];
  const n = Math.max(1, Math.round(v.termYears * ppy));
  const periodWord = { monthly: "month", quarterly: "quarter", "semi-annual": "half-year", annual: "year" }[v.frequency];

  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5 md:p-6 space-y-6 print:hidden">
      <div>
        <h2 className="font-semibold text-zinc-900">Start from an example</h2>
        <div className="flex flex-wrap gap-2 mt-3">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onPreset(p.key)}
              title={p.note}
              className={`text-sm rounded-full px-3 py-1.5 border ${preset === p.key ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-700 hover:border-zinc-400"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset && <p className="text-xs text-zinc-500 mt-2">{PRESETS.find((p) => p.key === preset)?.note}</p>}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-zinc-900 mb-1">The loan</legend>
        <div className="grid grid-cols-[1fr_88px] gap-3">
          <label className={label}>
            Loan amount
            <Num value={v.amount} onChange={(x) => set("amount", x)} step={1000} />
          </label>
          <label className={label}>
            Currency
            <input value={v.currency} onChange={(e) => set("currency", e.target.value.toUpperCase().slice(0, 3))} className={`${input} mt-1 uppercase`} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Interest rate
            <Num value={v.ratePct} onChange={(x) => set("ratePct", x)} step={0.05} suffix="% / yr" />
          </label>
          <label className={label}>
            Term
            <Num value={v.termYears} onChange={(x) => set("termYears", Math.max(0.25, x))} step={1} suffix="years" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            First payment
            <input type="date" value={addMonths(v.startDate, 12 / ppy)} onChange={(e) => e.target.value && set("startDate", addMonths(e.target.value, -12 / ppy))} className={`${input} mt-1`} />
          </label>
          <label className={label}>
            Payments
            <select value={v.frequency} onChange={(e) => onChange({ ...v, frequency: e.target.value as Frequency })} className={`${input} mt-1`}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="semi-annual">Semi-annual</option>
              <option value="annual">Annual</option>
            </select>
          </label>
        </div>
        <div className={label}>
          Repayment type
          <Segmented<Method> value={v.method} onChange={(m) => set("method", m)} options={[["annuity", "Equal instalments"], ["equal-principal", "Equal principal"], ["interest-only", "Interest-only"]]} />
          <span className="block mt-1">{METHOD_LABEL[v.method]}. {v.method === "annuity" ? "The same payment every period." : v.method === "equal-principal" ? "Payments start higher and fall as the balance drops." : "Only interest until the final payment repays the loan."}</span>
        </div>
        <label className={label}>
          Grace period (interest-only at the start)
          <Num value={v.graceYears} onChange={(x) => set("graceYears", Math.min(x, Math.max(0, v.termYears - 1 / ppy)))} step={0.5} suffix="years" />
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-zinc-900 mb-1">Fees</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Arrangement fee
            <Num value={v.feePct} onChange={(x) => set("feePct", x)} step={0.25} suffix="%" />
          </label>
          <label className={label}>
            Other upfront fees
            <Num value={v.feeFixed} onChange={(x) => set("feeFixed", x)} step={100} />
          </label>
        </div>
        <p className="text-xs text-zinc-500">Fees don't change the payments, but they raise the true cost of borrowing: the effective interest rate.</p>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-zinc-900 mb-1">Extra payments</legend>
        <label className={label}>
          Extra every {periodWord}
          <Num value={v.extraPerPeriod} onChange={(x) => set("extraPerPeriod", x)} step={100} />
        </label>
        <div className={label}>
          One-off lump sums
          <div className="space-y-2 mt-1">
            {v.lumpSums.map((l, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <select
                  value={l.period}
                  onChange={(e) => set("lumpSums", v.lumpSums.map((x, j) => (j === idx ? { ...x, period: Number(e.target.value) } : x)))}
                  className={input}
                  aria-label="Paid with payment number"
                >
                  {Array.from({ length: n }, (_, k) => k + 1).map((k) => (
                    <option key={k} value={k}>
                      #{k} · {date(addMonths(v.startDate, (k * 12) / ppy))}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={l.amount}
                  step={1000}
                  min={0}
                  onChange={(e) => set("lumpSums", v.lumpSums.map((x, j) => (j === idx ? { ...x, amount: Math.max(0, Number(e.target.value)) } : x)))}
                  className={input}
                  aria-label="Lump sum amount"
                />
                <button type="button" onClick={() => set("lumpSums", v.lumpSums.filter((_, j) => j !== idx))} className="p-1.5 text-zinc-400 hover:text-zinc-900" aria-label="Remove lump sum">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => set("lumpSums", [...v.lumpSums, { period: Math.min(n, ppy), amount: Math.round(v.amount * 0.1) }])} className="inline-flex items-center gap-1 text-sm text-zinc-700 hover:text-zinc-900">
              <Plus className="w-4 h-4" /> Add a lump sum
            </button>
          </div>
        </div>
        {(v.extraPerPeriod > 0 || v.lumpSums.length > 0) && (
          <div className={label}>
            Use extra payments to
            <Segmented<ExtraMode> value={v.extraMode} onChange={(m) => set("extraMode", m)} options={[["reduce-term", "Finish sooner"], ["reduce-payment", "Lower payments"]]} />
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-zinc-900 mb-1">Rate change</legend>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={v.rateChange.enabled} onChange={(e) => set("rateChange", { ...v.rateChange, enabled: e.target.checked })} />
          The rate changes during the loan (floating rate)
        </label>
        {v.rateChange.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              From the start of year
              <Num value={v.rateChange.fromYear} onChange={(x) => set("rateChange", { ...v.rateChange, fromYear: Math.max(1, Math.round(x)) })} min={1} />
            </label>
            <label className={label}>
              New rate
              <Num value={v.rateChange.ratePct} onChange={(x) => set("rateChange", { ...v.rateChange, ratePct: x })} step={0.05} suffix="% / yr" />
            </label>
          </div>
        )}
      </fieldset>
    </section>
  );
}
