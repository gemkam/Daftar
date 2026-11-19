# Daftar Office System

Next.js + Supabase web app for running a company office: bills and invoices (with VAT and e-invoice), expense sheet,
petty cash, staff, attendance, salary and salary slips, bank and cash accounts, profit and loss, reports, transport
(trips, drivers, vehicles, driver salaries, transport invoices), inventory, documents checklist with expiry alerts,
approvals (verifier and chairman), chat and an AI assistant. Several companies in one app, each with its own data.

This copy runs with two fictional sample companies (Al Noor Logistics and Trading LLC, Sahil Technical Services LLC).

## Setup
1. New Supabase project: run the files in `database/` in order 01 to 08 (08 = sample data, optional).
   In 04, change `CHANGE-ME-long-random-text` first and use the same text for `CRON_SECRET` in Vercel.
2. Vercel: import this repo, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (optional: `GROQ_API_KEY` for the AI features, `CRON_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `REPORT_TO`).
3. Supabase > Authentication > Sign In / Providers: turn off "Allow new users to sign up".
