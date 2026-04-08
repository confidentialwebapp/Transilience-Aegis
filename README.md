<div align="center">
   <img src="logo.png" alt="TAI-AEGIS Logo" width="200">
   <h1>TAI-AEGIS</h1>
   <p><strong>Threat Intelligence & Digital Risk Monitoring Platform</strong></p>

   [![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](LICENSE)
   [![CI/CD](https://github.com/confidentialwebapp/Transilience-Aegis/actions/workflows/deploy.yml/badge.svg)](https://github.com/confidentialwebapp/Transilience-Aegis/actions)
</div>

---

A full-stack external threat intelligence platform that continuously monitors the surface web, breach databases, paste sites, GitHub leaks, domain squatting, and social media for threats targeting your organization. Built entirely on free-tier infrastructure.

## Features

| Module | Description |
|--------|-------------|
| **Dark & Deep Web Monitoring** | HIBP breach checks, Pastebin monitoring, GitHub secret scanning, IntelX dark web search |
| **Brand Risk Monitoring** | Typosquat domain generation, URLScan.io phishing detection, VirusTotal reputation, DNS monitoring |
| **Data Leak Detection** | Regex-based secret scanning (AWS keys, Stripe tokens, etc.), GitHub code search, paste site monitoring |
| **Surface Web Monitoring** | Google dork automation via DuckDuckGo, Google News RSS monitoring, Shodan exposure scanning |
| **Certificate Transparency** | crt.sh subdomain enumeration, new certificate alerts, subdomain diff tracking |
| **Credential Exposure** | Email breach correlation, paste site exposure, domain-wide email pattern checks |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts, Supabase Realtime |
| **Backend** | Python 3.11+, FastAPI, APScheduler, httpx, BeautifulSoup4 |
| **Database** | Supabase (PostgreSQL + Auth + Realtime + Row Level Security) |
| **Hosting** | Vercel (frontend), Render (backend) |
| **CI/CD** | GitHub Actions |

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- Supabase project ([supabase.com](https://supabase.com))

### 1. Clone & setup

```bash
git clone https://github.com/confidentialwebapp/Transilience-Aegis.git
cd Transilience-Aegis
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Supabase and API keys
uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key
npm run dev
```

### 4. Database

Run the SQL migration in your Supabase SQL editor:
```
supabase/migrations/001_initial_schema.sql
```

Enable Realtime on the `alerts` table in Supabase Dashboard.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |
| `HIBP_API_KEY` | HaveIBeenPwned API key | No |
| `VIRUSTOTAL_API_KEY` | VirusTotal API key | No |
| `URLSCAN_API_KEY` | URLScan.io API key | No |
| `GITHUB_PAT` | GitHub Personal Access Token | No |
| `GREYNOISE_API_KEY` | GreyNoise Community API key | No |
| `SHODAN_API_KEY` | Shodan API key | No |
| `OTX_API_KEY` | AlienVault OTX API key | No |
| `RESEND_API_KEY` | Resend.com email API key | No |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | No |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `NEXT_PUBLIC_API_BASE_URL` | Backend API URL |

## Project Structure

```
TAI-AEGIS/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── config.py            # Settings
│   ├── db.py                # Supabase client
│   ├── scheduler.py         # APScheduler cron jobs
│   ├── routers/             # API endpoints
│   ├── modules/             # Scan engines (6 modules)
│   └── utils/               # Scoring, notifications, rate limiting
├── frontend/
│   ├── app/                 # Next.js 14 App Router pages
│   ├── components/          # React components
│   ├── hooks/               # Custom hooks (Realtime, data fetching)
│   └── lib/                 # API client, Supabase, utilities
├── supabase/migrations/     # SQL schema
├── render.yaml              # Render deployment config
├── vercel.json              # Vercel deployment config
└── .github/workflows/       # CI/CD pipeline
```

## Deployment

| Platform | Purpose | Guide |
|----------|---------|-------|
| **Supabase** | Database + Auth + Realtime | Create project, run migration, enable Realtime on `alerts` |
| **Render** | Backend API | Import `render.yaml` as Blueprint, set env vars |
| **Vercel** | Frontend | Connect repo, set root to `frontend`, set env vars |

## License

MIT
