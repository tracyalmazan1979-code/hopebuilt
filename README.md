# HOPE BUILT ADVISORY — F&C Command Center
## From zero to running app in 20 minutes

---

## Prerequisites
- Node.js 18+ 
- A Supabase project (free tier works)
- A Resend account (free tier works for dev)

---

## Step 1 — Supabase Setup (10 min)

1. Create a new Supabase project at https://supabase.com
2. Go to **SQL Editor** in your Supabase dashboard
3. Run the migrations **in order**:
   - Paste and run `supabase/migrations/001_initial_schema.sql`
   - Paste and run `supabase/migrations/002_caf_predoc_meetingmode.sql`
   - Paste and run `supabase/migrations/003_file_status_deadline_tactical.sql`
4. Go to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
5. Go to **Storage** → Create a bucket named `documents` → Set to Private
6. Go to **Authentication → URL Configuration**:
   - Add `http://localhost:3000/auth/callback` to Redirect URLs
   - For production: add `https://yourdomain.com/auth/callback`

---

## Step 2 — First User Setup

After running the migrations, create the first user through Supabase:

1. Go to **Authentication → Users** in Supabase dashboard
2. Click **Add User** → enter Vanessa's email
3. Go to **SQL Editor** and run:

```sql
-- Replace with actual user ID from Authentication → Users
INSERT INTO users (id, org_id, full_name, email, role, title, avatar_initials)
VALUES (
  'paste-auth-user-id-here',
  'a0000000-0000-0000-0000-000000000001',  -- IDEA org ID from seed data
  'Vanessa Rangel',
  'vanessa.rangel@ideapublicschools.org',
  'coordinator',
  'F&C Coordinator',
  'VR'
);
```

Repeat for each user. Role options: `admin`, `coordinator`, `approver`, `leadership`, `read_only`

---

## Step 3 — App Setup (5 min)

```bash
# Install dependencies
npm install

# Copy env template
cp .env.local.template .env.local

# Fill in your values in .env.local
# (Supabase URL, anon key, Resend API key)

# Run dev server
npm run dev
```

App runs at http://localhost:3000

---

## Step 4 — CAF Template (for PDF generation)

1. Place the blank IDEA CAF PDF at: `/public/templates/caf-template.pdf`
2. First time generating a CAF, check the output and adjust coordinates in:
   `src/app/api/documents/[id]/generate-caf/route.ts` → `FIELD_POSITIONS`
3. Each field position is `[x, y]` from bottom-left corner of the page

---

## Step 5 — Resend Setup (for emails)

1. Create account at https://resend.com
2. Verify your domain (or use Resend's test domain for dev)
3. Create an API key and add to `.env.local`
4. Update `FROM_EMAIL` to your verified domain

---

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
# (same as .env.local but production values)
```

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── documents/[id]/
│   │       ├── generate-caf/route.ts   ← CAF PDF generator
│   │       └── submit/route.ts          ← Submission email + logging
│   ├── auth/
│   │   ├── login/page.tsx               ← Sign in page
│   │   └── callback/route.ts            ← Magic link / OAuth handler
│   ├── dashboard/page.tsx               ← Command center (server component)
│   ├── layout.tsx                       ← Root layout + fonts
│   └── globals.css                      ← Design tokens + Tailwind
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx                 ← Sidebar + topbar shell
│   │   └── Providers.tsx                ← React Query provider
│   ├── dashboard/
│   │   └── DashboardClient.tsx          ← Swimlane dashboard
│   └── MeetingMode.tsx                  ← Live note-taking for FAC/Tactical
├── lib/
│   ├── supabase.ts                      ← Auth abstraction (email + future SSO)
│   └── data.ts                          ← All DB queries (single source of truth)
├── middleware.ts                        ← Route protection
└── types/
    └── index.ts                         ← All TypeScript types

supabase/migrations/
├── 001_initial_schema.sql              ← Core tables, RLS, triggers, IDEA seed data
├── 002_caf_predoc_meetingmode.sql      ← CAF fields, predoc workflow, meeting sessions
└── 003_file_status_deadline_tactical.sql ← File status, submission deadline, tactical link

sharepoint/
└── lists-specification.md             ← Path A: SharePoint Lists + Power Automate spec
```

---

## Wednesday Workflow (automated)

| Time         | What happens automatically                           |
|------------- |------------------------------------------------------|
| Monday 8AM   | Reminder email to all agenda_recipients              |
| Tuesday 3PM  | Deadline check — pending doc alert if anything missing |
| Wednesday 8AM| Agenda auto-generated, split by submitter_type        |
| Wednesday 9AM| PMSI PreDoc agenda sent (PMSI docs only)             |
| Wednesday 2:30PM | Enter Meeting Mode → Vanessa live-notes         |
| Any time     | Document submitted → email to Vanessa + Sylvia + CC  |

---

## Adding a New Client (Path B multi-tenancy)

1. Insert a new row in `organizations` table with their settings
2. Create their users in Supabase Auth + `users` table
3. Seed their `campuses` and `document_types` from their approval matrix
4. They get their own isolated data — zero crossover with IDEA
5. Configure `agenda_recipients` for their weekly workflow

That's it. The schema was built for this from day one.
