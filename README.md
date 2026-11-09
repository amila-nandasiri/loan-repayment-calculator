# Loan Repayment Calculator

A loan calculator built for finance professionals as well as borrowers. It produces the full repayment schedule for three repayment types, shows what extra payments and rate changes do, works out the true cost of borrowing including fees, and presents the borrower's IFRS 9 amortised-cost view.

**Live demo:** https://dewapriya.com/projects/loan-calculator/

## What it does

- **Repayment types:** equal instalments (annuity / EMI), equal principal, or interest-only with a balloon at the end, plus an optional interest-only grace period at the start
- **Payment frequency:** monthly, quarterly, semi-annual or annual
- **Extra payments:** a recurring extra each period and any number of one-off lump sums. You choose to **finish sooner** (keep the instalment) or **lower payments** (keep the term), and it shows the interest and time saved against the original schedule.
- **Rate change:** a floating-rate reset from any year
- **Fees and true cost:** arrangement and other upfront fees, with the **effective interest rate**, the internal rate of return of the cash actually received and paid, shown as an annual effective rate and a nominal APR
- **IFRS 9 amortised cost:** the borrower records the loan net of fees and charges interest at the effective rate, so the fees are spread over the loan. For a floating rate, the effective rate is set from the cash flows expected at inception and revised when the rate resets (IFRS 9 B5.4.5). The carrying amount reaches zero at the end.
- **Compare repayment types:** the same loan repaid all three ways
- **Charts:** the balance over time (with and against the original schedule), and principal, extra payments and interest by year
- **Presets:** a business term loan, home loan, car loan and aircraft financing (quarterly, with a grace period and a rate reset)
- **Share:** the scenario is saved in the page address, so a copied link reopens the same calculation
- **Downloads:** an Excel workbook (summary, schedule, IFRS 9 view), a CSV schedule and a PDF, plus a single-file offline version

## Checked against known answers

| Case | Expected | Calculator |
|---|---|---|
| $500K, 7.5%, 5 years, monthly instalment | Excel PMT: $10,018.97 | $10,018.97 |
| Same loan, equal principal: total interest | $500K × 0.625% × 61/2 = $95,312.50 | $95,312.50 |
| Same loan, interest-only: total interest | $3,125 × 60 = $187,500 | $187,500.00 |
| Effective rate with no fees | (1 + 7.5%/12)^12 − 1 = 7.763% | 7.763% |
| IFRS 9 schedule | Fees fully amortised, carrying amount ends at 0 | Yes, in every case |

## Conventions

- **Periodic rate:** the nominal annual rate divided by payments per year, as banks quote loans
- **Timing:** payments fall at the end of each period
- **Rate changes:** an annuity's instalment is recalculated over the remaining term. On a "finish sooner" loan, the recalculation uses the contractual balance, so extra payments keep shortening the term.
- **Illustration only:** this is not financial advice, and lenders' exact day-count conventions can differ slightly

## Tech

- **App:** React, TypeScript, Recharts and Tailwind CSS, built with Vite
- **Engine:** [`src/lib/loan.ts`](src/lib/loan.ts) covers schedules, the effective rate and IFRS 9
- **Offline version:** `npm run build` also produces `dist/loan-repayment-calculator.html`, a single self-contained file

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
```

---

Built by [Amila Dewapriya](https://dewapriya.com), CMA: finance professional building with data and code.
