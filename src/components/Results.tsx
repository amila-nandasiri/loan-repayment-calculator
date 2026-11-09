import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { date, money, moneyShort } from "../lib/format";
import { METHOD_LABEL, type Result } from "../lib/loan";

const C = { balance: "#2a78d6", baseline: "#a1a1aa", principal: "#2a78d6", interest: "#eb6834", extra: "#1baf7a", grid: "#e4e4e7", axis: "#71717a" };
const axisProps = { stroke: C.axis, fontSize: 12, tickLine: false, axisLine: false } as const;

export function Card({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="bg-white border border-zinc-200 rounded-2xl min-w-0 break-inside-avoid">
      <div className="p-5 md:p-6 pb-0 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-zinc-900">{title}</h2>
          {subtitle && <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const yearOf = (iso: string) => iso.slice(0, 4);

export function BalanceChart({ r }: { r: Result }) {
  const hasExtras = r.baseline !== r.schedule;
  const byPeriod = new Map(r.schedule.rows.map((x) => [x.period, x.closing]));
  const data = [
    { label: date(r.input.startDate), balance: r.input.amount, baseline: r.input.amount },
    ...r.baseline.rows.map((x) => ({ label: date(x.date), balance: byPeriod.has(x.period) ? byPeriod.get(x.period)! : null, baseline: x.closing }))
  ];
  return (
    <Card title="Balance over time" subtitle={hasExtras ? "With your extra payments, against the original schedule" : "Outstanding balance after each payment"}>
      <div className="px-2 md:px-4 pb-4">
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" {...axisProps} minTickGap={48} />
            <YAxis {...axisProps} tickFormatter={moneyShort} width={60} />
            <Tooltip formatter={(v: number) => money(v)} />
            {hasExtras && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />}
            {hasExtras && <Line dataKey="baseline" name="Original schedule" stroke={C.baseline} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />}
            <Line dataKey="balance" name={hasExtras ? "With extra payments" : "Balance"} stroke={C.balance} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function YearlyChart({ r }: { r: Result }) {
  const data = useMemo(() => {
    const m = new Map<string, { year: string; principal: number; interest: number; extra: number }>();
    for (const x of r.schedule.rows) {
      const y = yearOf(x.date);
      const e = m.get(y) ?? { year: y, principal: 0, interest: 0, extra: 0 };
      e.principal += x.principal;
      e.interest += x.interest;
      e.extra += x.extra;
      m.set(y, e);
    }
    return [...m.values()];
  }, [r]);
  const hasExtra = data.some((d) => d.extra > 0);
  return (
    <Card title="What you pay each year" subtitle="Interest is a bigger share early on, while the balance is high">
      <div className="px-2 md:px-4 pb-4">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0 }} barCategoryGap="18%">
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="year" {...axisProps} minTickGap={12} />
            <YAxis {...axisProps} tickFormatter={moneyShort} width={60} />
            <Tooltip formatter={(v: number) => money(v)} cursor={{ fill: "#f4f4f5" }} />
            <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="principal" name="Principal" stackId="a" fill={C.principal} stroke="#fff" strokeWidth={1} isAnimationActive={false} />
            {hasExtra && <Bar dataKey="extra" name="Extra payments" stackId="a" fill={C.extra} stroke="#fff" strokeWidth={1} isAnimationActive={false} />}
            <Bar dataKey="interest" name="Interest" stackId="a" fill={C.interest} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function Comparison({ r }: { r: Result }) {
  const best = Math.min(...r.comparison.map((c) => c.totalInterest));
  return (
    <Card title="Compare repayment types" subtitle="The same loan, rate, fees and extra payments, repaid three ways">
      <div className="overflow-x-auto pb-2">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="text-xs text-zinc-500 border-y border-zinc-200 bg-zinc-50/60">
            <tr>
              <th className="text-left font-medium px-5 md:px-6 py-2">Repayment type</th>
              <th className="text-right font-medium px-3 py-2">First payment</th>
              <th className="text-right font-medium px-3 py-2">Last payment</th>
              <th className="text-right font-medium px-3 py-2">Total interest</th>
              <th className="text-right font-medium px-3 pr-6 py-2">Paid off</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {r.comparison.map((c) => {
              const sel = c.method === r.input.method;
              return (
                <tr key={c.method} className={sel ? "bg-blue-50/60 font-medium text-zinc-900" : "text-zinc-700"}>
                  <td className="px-5 md:px-6 py-2.5">
                    {METHOD_LABEL[c.method]} {sel && <span className="text-xs text-[#2a78d6] ml-1">selected</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(c.first)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(c.last)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {money(c.totalInterest)}
                    {Math.abs(c.totalInterest - best) < 0.5 && <span className="ml-1.5 text-xs text-emerald-700">lowest</span>}
                  </td>
                  <td className="px-3 pr-6 py-2.5 text-right">{date(c.payoffDate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Schedules, grouped by calendar year
// ---------------------------------------------------------------------------

type Col = { label: string; get: (x: Record<string, number>) => number; paren?: boolean; pct?: boolean };

function GroupedTable({ rows, cols, sumKeys, openingKey, closingKey }: { rows: (Record<string, number> & { date: string; period: number })[]; cols: Col[]; sumKeys: string[]; openingKey: string; closingKey: string }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const years = [...new Set(rows.map((x) => yearOf(x.date)))];
  const fmt = (v: number, c: Col) => (!Number.isFinite(v) || Math.abs(v) < 0.005 ? "–" : c.pct ? `${v.toFixed(2)}%` : c.paren ? `(${money(v)})` : money(v));
  return (
    <div className="overflow-x-auto pb-2">
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="text-xs text-zinc-500 border-y border-zinc-200 bg-zinc-50/60">
          <tr>
            <th className="text-left font-medium px-5 md:px-6 py-2">Year / payment</th>
            {cols.map((c) => <th key={c.label} className="text-right font-medium px-3 py-2 last:pr-6">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {years.map((y) => {
            const yr = rows.filter((x) => yearOf(x.date) === y);
            const agg: Record<string, number> = { [openingKey]: yr[0][openingKey], [closingKey]: yr[yr.length - 1][closingKey] };
            for (const k of sumKeys) agg[k] = yr.reduce((t, x) => t + x[k], 0);
            const isOpen = open.has(y);
            return (
              <Fragment key={y}>
                <tr
                  className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 font-medium text-zinc-900"
                  onClick={() => {
                    const s = new Set(open);
                    if (isOpen) s.delete(y);
                    else s.add(y);
                    setOpen(s);
                  }}
                >
                  <td className="px-5 md:px-6 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
                      {y} <span className="text-xs text-zinc-400 font-normal">{yr.length} payments</span>
                    </span>
                  </td>
                  {cols.map((c) => <td key={c.label} className="px-3 py-2 text-right tabular-nums last:pr-6">{fmt(c.get(agg), c)}</td>)}
                </tr>
                {isOpen &&
                  yr.map((x) => (
                    <tr key={x.period} className="text-xs text-zinc-600 border-b border-zinc-50">
                      <td className="px-5 md:px-6 py-1.5 pl-11">
                        #{x.period} · {date(x.date)}
                      </td>
                      {cols.map((c) => <td key={c.label} className="px-3 py-1.5 text-right tabular-nums last:pr-6">{fmt(c.get(x), c)}</td>)}
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Schedules({ r }: { r: Result }) {
  const [tab, setTab] = useState<"schedule" | "ifrs9">("schedule");
  const hasExtra = r.schedule.rows.some((x) => x.extra > 0);
  const rateVaries = new Set(r.schedule.rows.map((x) => x.ratePct)).size > 1;
  return (
    <Card
      title={tab === "schedule" ? "Repayment schedule" : "IFRS 9 amortised cost (borrower)"}
      subtitle={
        tab === "schedule"
          ? "By year. Select a year to see each payment"
          : r.eirRevisions.length > 1
            ? `Fees are spread at an effective rate of ${(r.eirRevisions[0].eirPeriodic * r.ppy * 100).toFixed(3)}%, revised to ${(r.eirRevisions[1].eirPeriodic * r.ppy * 100).toFixed(3)}% when the rate resets with payment #${r.eirRevisions[1].period} (IFRS 9 B5.4.5). Nominal rates`
            : `Fees are spread over the loan at the effective interest rate of ${((r.eirRevisions[0]?.eirPeriodic ?? 0) * r.ppy * 100).toFixed(3)}% (nominal), so the interest expense is higher than the cash interest`
      }
      action={
        <div className="inline-flex bg-zinc-100 p-1 rounded-lg text-sm print:hidden" role="tablist">
          {(
            [
              ["schedule", "Schedule"],
              ["ifrs9", "IFRS 9 view"]
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-3 py-1 rounded-md ${tab === k ? "bg-white shadow-sm text-zinc-900 font-medium" : "text-zinc-600"}`}>
              {l}
            </button>
          ))}
        </div>
      }
    >
      {tab === "schedule" ? (
        <GroupedTable
          rows={r.schedule.rows as unknown as (Record<string, number> & { date: string; period: number })[]}
          openingKey="opening"
          closingKey="closing"
          sumKeys={["payment", "interest", "principal", "extra"]}
          cols={[
            { label: "Opening balance", get: (x) => x.opening },
            ...(rateVaries ? [{ label: "Rate", get: (x: Record<string, number>) => x.ratePct, pct: true } as Col] : []),
            { label: "Payment", get: (x) => x.payment },
            { label: "Interest", get: (x) => x.interest },
            { label: "Principal", get: (x) => x.principal },
            ...(hasExtra ? [{ label: "Extra", get: (x: Record<string, number>) => x.extra } as Col] : []),
            { label: "Closing balance", get: (x) => x.closing }
          ]}
        />
      ) : r.ifrs9.length ? (
        <GroupedTable
          rows={r.ifrs9 as unknown as (Record<string, number> & { date: string; period: number })[]}
          openingKey="opening"
          closingKey="closing"
          sumKeys={["interestExpense", "cashInterest", "feeAmortised", "payment"]}
          cols={[
            { label: "Opening carrying amount", get: (x) => x.opening },
            { label: "Interest expense (EIR)", get: (x) => x.interestExpense },
            { label: "Of which cash interest", get: (x) => x.cashInterest },
            { label: "Of which fees amortised", get: (x) => x.feeAmortised },
            { label: "Payments", get: (x) => x.payment, paren: true },
            { label: "Closing carrying amount", get: (x) => x.closing }
          ]}
        />
      ) : (
        <p className="px-5 md:px-6 pb-5 text-sm text-zinc-500">The effective interest rate couldn't be calculated for these inputs.</p>
      )}
    </Card>
  );
}
