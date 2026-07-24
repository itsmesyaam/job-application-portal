# Job Application & Recruiting Portal

A production-ready, highly interactive Job Application and Recruitment Platform built with Next.js, Tailwind CSS, Supabase (Auth, PostgreSQL, Storage, Real-time WebSockets), and Framer Motion. Engineered to manage candidate intake, shortlist workflows, and automated take-home coding challenges with a strict 48-hour deadline.

---

## 🛠️ Tech Stack & Architecture

*   **Frontend**: Next.js (App Router, TypeScript, React Hook Form, Zod)
*   **Styling & Motion**: Tailwind CSS (custom modern palettes, gradients) & Framer Motion (staggered step fade-ins, spring-based chat layouts, and pop micro-interactions)
*   **Backend & DB**: Supabase PostgreSQL database
*   **Authentication**: Supabase Auth (Sign-in with Google OAuth)
*   **File Storage**: Supabase Private Storage Buckets (`resumes`, `task-submissions`) with Row-Level Security (RLS)
*   **Real-time Synchronization**: Supabase Realtime Channels (PostgreSQL WAL replication for instant candidate-recruiter chat feeds)
*   **Hosting**: Netlify (`netlify.toml` configured with Next.js Runtime)
*   **Transactional Alerts**: Transactional mailer alerts triggered asynchronously upon candidate intake, shortlist assignment, and solution submissions.

---

## 🌟 Key Features

1.  **Candidate Application Portal (`/`)**
    *   Secure step-based application wizard.
    *   Google OAuth authentication integration.
    *   Private resume upload (strictly validating `.pdf`, `.docx` files under size limits).
    *   Staggered entry transitions and success confetti celebration (`canvas-confetti`).
2.  **Candidate Dashboard (`/dashboard`)**
    *   Real-time status board tracking reviews (Pending, Shortlisted, Task Assigned, Submitted, Rejected).
    *   Strict **48-Hour Live Countdown Timer** that initiates automatically upon take-home challenge assignment.
    *   Interactive solution submission form supporting repository links or zip file uploads directly to private storage.
    *   Overdue auto-lockout guarding: countdown timer glows red when under 12 hours and locks the solution form when the timer expires.
3.  **Admin Workspace (`/admin`)**
    *   Statistics cards detailing total applicants, pending reviews, shortlists, and rejections.
    *   Search and dynamic column filtering on positions and application statuses.
    *   Inspect Drawer: Details panel sliding from the right displaying cover letters, bios, and download buttons utilizing signed URL generators.
    *   Take-home Challenge Creator: Allows recruiters to assign personalized coding challenges that set off the candidate's 48-hour timer.
4.  **Real-time Recruiter-Candidate Chat**
    *   Direct instant communication channel built on Supabase WebSockets.
    *   Auto-marking read receipts dynamically as the recipient views the chat tab.
    *   Spring physics animations for incoming and outgoing chat bubble flows.

---

## 🔑 Environment Variables Setup

Create a `.env.local` file in the project root directory. Use the following template:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Admin Accounts (Comma-separated list of emails allowed to access /admin)
ADMIN_EMAILS=admin@yourdomain.com,jane.doe@example.com

# Cron Job Secret (To protect the check-deadlines endpoint)
CRON_SECRET=your-random-cron-secret-token

# SMTP Transactional Mail Configuration (Optional - logs to server console if blank)
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=recruiting@yourdomain.com
```

---

## 🚀 Local Installation & Setup

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/itsmesyaam/job-application-portal.git
    cd job-application-portal
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Run Database Migration**:
    *   Log in to your Supabase Console.
    *   Open the **SQL Editor** and run the contents of [supabase/schema.sql](file:///c:/Users/bella/OneDrive/Documents/job%20%20posting%20manager/supabase/schema.sql) to initialize tables, RLS rules, and real-time triggers.
4.  **Configure Storage Buckets**:
    *   In the Supabase dashboard, navigate to **Storage**.
    *   Create two **Private** buckets: `resumes` and `task-submissions`.
5.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) to view the portal.
6.  **Run Test Suite**:
    ```bash
    npx vitest run
    ```

---

## ☁️ Production Deployment (Netlify)

1.  **Configure Netlify Build**:
    Your repository is pre-configured with a [netlify.toml](file:///c:/Users/bella/OneDrive/Documents/job%20%20posting%20manager/netlify.toml) file. Netlify will automatically install the Next.js runtime plugin (`@netlify/plugin-nextjs`) and point the build directory to `.next`.
2.  **Environment Variables**:
    Add the environment variables listed in the `.env.local` section directly in **Netlify Project Settings > Environment Variables**.
3.  **Enable Database Webhooks & Cron Job**:
    *   Define an hourly scheduler targeting `https://your-netlify-domain.netlify.app/api/cron/check-deadlines` using Netlify Scheduled Functions or an external cron scheduler.
    *   Include the header `Authorization: Bearer <CRON_SECRET>` in the cron request to satisfy the route guards.
