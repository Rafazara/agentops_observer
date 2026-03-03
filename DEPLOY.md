# AgentOps Observer - Free Tier Deployment Guide

Deploy AgentOps Observer with **$0 hosting costs** using free tiers from Supabase, Upstash, Render, and Vercel.

---

## 💰 Cost Summary

| Service | Free Tier Limits | Cost |
|---------|------------------|------|
| **Supabase** (PostgreSQL) | 500MB storage, 2 connections | $0 |
| **Upstash** (Redis) | 10K commands/day, 256MB | $0 |
| **Render** (API) | 750 hours/month | $0 |
| **Vercel** (Frontend) | 100GB bandwidth/month | $0 |
| **Total** | - | **$0/month** |

---

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    Vercel        │     │    Render        │     │    Supabase      │
│  (Frontend)      │────▶│    (API)         │────▶│   PostgreSQL     │
│   Next.js 14     │     │   FastAPI        │     │    Free Tier     │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                 │
                                 ▼
                         ┌──────────────────┐
                         │    Upstash       │
                         │   Redis (HTTP)   │
                         └──────────────────┘
```

---

## Prerequisites

- GitHub account with this repository forked
- [Supabase](https://supabase.com) account (free)
- [Upstash](https://upstash.com) account (free)
- [Render](https://render.com) account (free)
- [Vercel](https://vercel.com) account (free)

---

## Step 1 — Create Supabase Database (5 min)

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Choose a name and generate a strong database password
3. Select a region (choose closest to your users)
4. Click **Create new project** and wait (~2 minutes)

### Get Connection Details

1. Go to **Settings** → **Database**
2. Scroll to **Connection string** → **URI**
3. Copy and note these values:
   - `POSTGRES_HOST`: e.g., `aws-0-us-east-1.pooler.supabase.com`
   - `POSTGRES_USER`: e.g., `postgres.abcd1234`
   - `POSTGRES_PASSWORD`: your password
   - `POSTGRES_DB`: `postgres`
   - `POSTGRES_PORT`: `5432`

### Run Database Setup

You can run migrations after API deployment, or use the SQL Editor now:

1. Go to **SQL Editor** in Supabase Dashboard
2. Create the ENUM types (copy from `scripts/seed_render.sh`)

---

## Step 2 — Create Upstash Redis (3 min)

1. Go to [upstash.com](https://upstash.com) → **Create Database**
2. Select **Redis**
3. Choose a name and region (match your Render region if possible)
4. Click **Create**

### Get REST API Credentials

1. In your database dashboard, go to **REST API**
2. Copy these values:
   - `UPSTASH_REDIS_REST_URL`: e.g., `https://us1-xyz.upstash.io`
   - `UPSTASH_REDIS_REST_TOKEN`: your token

---

## Step 3 — Deploy API to Render (10 min)

### Option A: One-Click Deploy (Recommended)

1. Go to [render.com](https://render.com/deploy)
2. Connect your GitHub repository
3. Select the repository containing AgentOps Observer
4. Render will detect `render.yaml` and configure automatically

### Option B: Manual Setup

1. Go to Render Dashboard → **New** → **Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Name**: `agentops-api`
   - **Region**: Oregon (us-west-2)
   - **Branch**: `main`
   - **Root Directory**: `apps/api`
   - **Runtime**: Docker
   - **Instance Type**: Free

### Set Environment Variables

In Render Dashboard → Your Service → **Environment**:

| Variable | Value |
|----------|-------|
| `POSTGRES_HOST` | `aws-0-us-east-1.pooler.supabase.com` |
| `POSTGRES_PORT` | `5432` |
| `POSTGRES_DB` | `postgres` |
| `POSTGRES_USER` | `postgres.your-project-id` |
| `POSTGRES_PASSWORD` | Your Supabase password |
| `UPSTASH_REDIS_REST_URL` | `https://your-redis.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Your Upstash token |
| `JWT_SECRET_KEY` | Generate: `openssl rand -hex 32` |
| `CORS_ORIGINS` | `["https://your-app.vercel.app"]` |
| `ENVIRONMENT` | `production` |
| `DEBUG` | `false` |

### Run Database Migrations

After deployment, use Render Shell or run locally:

```bash
# Set your DATABASE_URL
export DATABASE_URL="postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

# Run seed script
./scripts/seed_render.sh
```

### Copy API URL

After deployment:
- Your API URL: `https://agentops-api.onrender.com`
- Test it: `curl https://agentops-api.onrender.com/ping`

---

## Step 4 — Deploy Frontend to Vercel (5 min)

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`

### Set Environment Variables

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://agentops-api.onrender.com` |
| `NEXT_PUBLIC_WS_URL` | `wss://agentops-api.onrender.com` |
| `NEXT_PUBLIC_DEMO_MODE` | `true` |
| `NEXTAUTH_SECRET` | Generate: `openssl rand -hex 32` |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |

4. Click **Deploy**
5. Wait for build (~2 minutes)

---

## Step 5 — Update CORS & Keep-Alive

### Update CORS

1. Go to Render → API service → **Environment**
2. Update `CORS_ORIGINS` with your Vercel URL:
   ```
   ["https://your-app.vercel.app"]
   ```

### Set Up Keep-Alive (Prevent Cold Starts)

Render free tier sleeps after 15 minutes of inactivity. Set up one of these:

#### Option A: GitHub Actions (Recommended)

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Add secret: `API_URL` = `https://agentops-api.onrender.com`
3. The `.github/workflows/keep-alive.yml` will ping every 14 minutes

#### Option B: External Cron Service

Use [cron-job.org](https://cron-job.org) (free):
1. Create account
2. Add new cron job:
   - URL: `https://agentops-api.onrender.com/ping`
   - Schedule: Every 14 minutes

---

## Step 6 — Verify Deployment

### Health Check

```bash
curl https://agentops-api.onrender.com/health
```

Expected:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

### Test Demo

Visit: `https://your-app.vercel.app/demo`

You should see:
- ✅ Dashboard loads with demo data
- ✅ Demo mode banner visible
- ✅ All pages navigate correctly
- ✅ Charts render properly

---

## 🎉 Your Demo Link

Share with investors and beta customers:

```
https://your-app.vercel.app/demo
```

---

## Free Tier Limitations

### Render

- **Cold starts**: First request after 15 min idle takes ~30 seconds
- **Solution**: Use keep-alive cron job

### Supabase

- **Pausing**: Database pauses after 7 days of inactivity
- **Solution**: The keep-alive job prevents this

### Upstash

- **10K commands/day**: Sufficient for demo/light usage
- **Solution**: Upgrade to pay-as-you-go for production ($0.2/100K commands)

---

## Upgrading to Production

When ready to scale beyond free tiers:

| Service | Upgrade Path | Starting Cost |
|---------|-------------|---------------|
| Supabase | Pro Plan | $25/month |
| Upstash | Pay-as-you-go | $0.2/100K commands |
| Render | Starter Plan | $7/month |
| Vercel | Pro Plan | $20/month |

**Total production cost**: ~$50-75/month for moderate usage

---

## Troubleshooting

### "Connection refused" errors

- Check Supabase is not paused (Settings → General)
- Verify environment variables are correct
- Ensure migrations have run

### Slow first request

- Normal for Render free tier (cold start)
- Enable keep-alive workflow

### Redis errors

- Verify Upstash REST URL and token
- Check daily command limit not exceeded

---

## Demo Credentials

After running `seed_render.sh`:

- **Email**: `demo@agentops.observer`
- **Password**: `demo123`

---

## Support

- 📖 [Documentation](./docs/README.md)
- 🐛 [GitHub Issues](https://github.com/your-repo/issues)
- 💬 [Discord Community](https://discord.gg/your-invite)
