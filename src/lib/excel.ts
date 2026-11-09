// Excel and CSV exports of the loan: summary, repayment schedule and IFRS 9 schedule.

import writeXlsxFile, { type Cell, type SheetData } from "write-excel-file/browser";
import { downloadText, toCsv } from "./csv";
import { METHOD_LABEL, type Result } from "./loan";

const header = (v: string): Cell => ({ value: v, fontWeight: "bold", backgroundColor: "#F4F4F5", borderStyle: "thin", borderColor: "#D4D4D8" });
const money = (n: number, bold = false): Cell => ({ value: Math.round(n * 100) / 100, type: Number, format: "#,##0.00", ...(bold ? { fontWeight: "bold" as const } : {}) });
const pct = (n: number | null): Cell => (n === null ? "n/a" : { value: n, type: Number, format: "0.000%" });
const day = (iso: string): Cell => ({ value: new Date(iso + "T00:00:00Z"), type: Date, format: "dd mmm yyyy" });

export async function downloadWorkbook(r: Result) {
  const i = r.input;
  const s = r.schedule;
  const summary: SheetData = [
    [{ value: "Loan repayment summary", fontWeight: "bold", fontSize: 14 }],
    [],
    [header("Loan"), header("")],
    ["Amount", money(i.amount)],
    ["Currency", i.currency],
    ["Interest rate (nominal, a year)", { value: i.ratePct / 100, type: Number, format: "0.00%" }],
    ["Term (years)", i.termYears],
    ["Payments per year", r.ppy],
    ["Repayment type", METHOD_LABEL[i.method]],
    ["Grace period (years)", i.graceYears],
    ["First payment", day(s.rows[0]?.date ?? i.startDate)],
    ...(i.rateChange.enabled ? [["Rate change", `${i.rateChange.ratePct}% from the start of year ${i.rateChange.fromYear}`] as Cell[]] : []),
    ["Upfront fees", money(r.fees)],
    ["Extra payment each period", money(i.extraPerPeriod)],
    ...i.lumpSums.filter((l) => l.amount > 0).map((l): Cell[] => [`Lump sum with payment #${l.period}`, money(l.amount)]),
    [],
    [header("Results"), header("")],
    ["First instalment", money(s.firstInstalment)],
    ["Last instalment", money(s.lastInstalment)],
    ["Number of payments", s.periods],
    ["Paid off", day(s.payoffDate)],
    ["Total interest", money(s.totalInterest, true)],
    ["Total repaid (principal + interest)", money(s.totalPaid)],
    ["Total cost including fees", money(s.totalPaid + r.fees, true)],
    ["Effective interest rate (annual, incl. fees)", pct(r.eirAnnualEffective)],
    ["APR (nominal, incl. fees)", pct(r.apr)],
    ...(r.baseline !== r.schedule
      ? [["Interest saved by extra payments", money(r.interestSaved, true)] as Cell[], ["Payments saved", r.periodsSaved] as Cell[]]
      : [])
  ];
  const schedule: SheetData = [
    ["Payment", "Date", "Rate", "Opening balance", "Payment", "Interest", "Principal", "Extra", "Closing balance"].map(header),
    ...s.rows.map((x): Cell[] => [x.period, day(x.date), { value: x.ratePct / 100, type: Number, format: "0.00%" }, money(x.opening), money(x.payment), money(x.interest), money(x.principal), money(x.extra), money(x.closing)]),
    ["Total", null, null, null, money(s.rows.reduce((t, x) => t + x.payment, 0), true), money(s.totalInterest, true), money(s.rows.reduce((t, x) => t + x.principal, 0), true), money(s.rows.reduce((t, x) => t + x.extra, 0), true), null]
  ];
  const ifrs9: SheetData = [
    [r.eirRevisions.map((e) => `EIR per period from payment #${e.period}: ${(e.eirPeriodic * 100).toFixed(5)}%`).join(" · ") || "EIR not available"],
    ["Payment", "Date", "Opening carrying amount", "Interest expense (EIR)", "Cash interest", "Fees amortised", "Payment", "Closing carrying amount"].map(header),
    ...r.ifrs9.map((x): Cell[] => [x.period, day(x.date), money(x.opening), money(x.interestExpense), money(x.cashInterest), money(x.feeAmortised), money(x.payment), money(x.closing)])
  ];
  await writeXlsxFile([
    { sheet: "Summary", data: summary, columns: [{ width: 42 }, { width: 22 }] },
    { sheet: "Schedule", data: schedule, columns: [8, 13, 8, 17, 15, 15, 15, 15, 17].map((width) => ({ width })), stickyRowsCount: 1 },
    { sheet: "IFRS 9", data: ifrs9, columns: [8, 13, 20, 20, 15, 15, 15, 20].map((width) => ({ width })), stickyRowsCount: 2 }
  ]).toFile(`loan-schedule-${i.amount}-${i.termYears}y.xlsx`);
}

export function downloadCsv(r: Result) {
  const rows = [
    ["Payment", "Date", "Rate %", "Opening balance", "Payment", "Interest", "Principal", "Extra", "Closing balance"],
    ...r.schedule.rows.map((x) => [x.period, x.date, x.ratePct, x.opening.toFixed(2), x.payment.toFixed(2), x.interest.toFixed(2), x.principal.toFixed(2), x.extra.toFixed(2), x.closing.toFixed(2)])
  ];
  downloadText(`loan-schedule-${r.input.amount}-${r.input.termYears}y.csv`, toCsv(rows));
}
