# OnlyZines — Production Deployment Guide

This guide will help you deploy the OnlyZines Builder (frontend) and API (backend) to production.

---

## Quick Overview

| Component | Technology | Deploy To |
|-----------|------------|-----------|
| Frontend | Single HTML file | Netlify (or any static host) |
| Backend | Node.js + Express + Prisma | Railway, Render, or Fly.io |
| Database | PostgreSQL | Railway, Render, Supabase, or Neon |

---

## PART 1: BACKEND DEPLOYMENT

### Step 1: Create a PostgreSQL Database

**Option A: Railway (Recommended)**
1. Go to https://railway.app
2. Create a new project
3. Click "Add Service" → "Database" → "PostgreSQL"
4. Click on the database → "Variables" tab
5. Copy the `DATABASE_URL` (looks like: `postgresql://postgres:xxx@xxx.railway.app:5432/railway`)

**Option B: Render**
1. Go to https://render.com
2. New → PostgreSQL
3. Copy the "External Database URL"

**Option B: Supabase**
1. Go to https://supabase.com
2. Create project
3. Settings → Database → Connection string (URI)

### Step 2: Deploy Backend to Railway

1. **Create a new GitHub repo** with the backend files:
   ```
   onlyzines-backend/
   ├── prisma/
   │   └── schema.prisma
   ├── src/
   │   ├── lib/
   │   │   ├── auth/
   │   │   │   ├── jwt.ts
   │   │   │   ├── middleware.ts
   │   │   │   └── password.ts
   │   │   ├── errors.ts
   │   │   ├── prisma.ts
   │   │   └── spreads.ts
   │   ├── routes/
   │   │   ├── auth.ts
   │   │   ├── index.ts
   │   │   └── publisher.ts
   │   ├── app.ts
   │   └── server.ts
   ├── package.json
   ├── tsconfig.json
   └── .env.example
   ```

2. **In Railway:**
   - New Project → Deploy from GitHub repo
   - Select your backend repo

3. **Set Environment Variables in Railway:**
   Click on your service → Variables → Add these:

   ```
   DATABASE_URL=<your database URL from Step 1>
   JWT_ACCESS_SECRET=<generate: openssl rand -base64 32>
   JWT_REFRESH_SECRET=<generate: openssl rand -base64 32>
   FRONTEND_URL=https://your-netlify-site.netlify.app
   NODE_ENV=production
   PORT=3001
   ```

   **To generate secrets on Mac/Linux:**
   ```bash
   openssl rand -base64 32
   ```
   
   **Or use this online generator:** https://generate-secret.vercel.app/32

4. **Set Build & Start Commands:**
   In Railway, go to Settings:
   - Build Command: `npm install && npm run db:generate && npm run db:migrate:prod && npm run build`
   - Start Command: `npm start`

5. **Get your backend URL:**
   After deployment, Railway gives you a URL like:
   `https://onlyzines-backend-production.up.railway.app`
   
   Your API will be at: `https://onlyzines-backend-production.up.railway.app/api`

6. **Verify it's working:**
   Visit: `https://your-backend-url.up.railway.app/api/health`
   Should return: `{"status":"ok","timestamp":"..."}`

---

## PART 2: FRONTEND DEPLOYMENT

### Step 1: Update the API URL

Open `index.html` and find this line (near the top of the `<script>` section):

```javascript
const CONFIG = {
  VERSION: '13.1',
  API_BASE_URL: window.location.hostname === 'localhost' 
    ? 'http://localhost:3001/api'
    : 'https://your-backend-url.com/api', // <-- UPDATE THIS
};
```

Change `'https://your-backend-url.com/api'` to your actual backend URL:

```javascript
    : 'https://onlyzines-backend-production.up.railway.app/api',
```

### Step 2: Deploy to Netlify

**Option A: Drag & Drop (Fastest)**
1. Go to https://app.netlify.com/drop
2. Drag your `index.html` file onto the page
3. Done! You get a URL like `random-name-123.netlify.app`

**Option B: From GitHub**
1. Create a repo with just `index.html` in the root
2. In Netlify: New site → Import from Git
3. Select your repo
4. Build command: (leave blank)
5. Publish directory: `.` (just a dot)
6. Deploy

### Step 3: Update CORS (Backend)

Go back to Railway and update the `FRONTEND_URL` variable to your Netlify URL:

```
FRONTEND_URL=https://your-site-name.netlify.app
```

Railway will auto-redeploy.

---

## PART 3: VERIFY EVERYTHING WORKS

### Test Checklist

1. **Open your Netlify URL** in a browser
2. **Sign up** with a new account
3. **Create a publisher profile**
4. **Create a zine**
5. **Create an issue**
6. **Add some elements** (text, shapes, images)
7. **Wait for autosave** (watch the "Unsaved changes" → "Saved" indicator)
8. **Refresh the page** - your content should still be there
9. **Publish** - you should get a live URL

---

## TROUBLESHOOTING

### "Failed to fetch" or CORS errors
- Check that `FRONTEND_URL` in Railway matches your Netlify URL exactly
- Make sure there's no trailing slash
- Redeploy backend after changing variables

### "Invalid credentials" on login
- Make sure you signed up first
- Check browser console for detailed error

### Autosave not working
- Open browser DevTools → Network tab
- Look for failed requests to `/api/publisher/issues/xxx/save`
- Check the response for error details

### Database connection errors
- Verify `DATABASE_URL` is correct
- Make sure database is running
- Check Railway logs for details

---

## FILE STRUCTURE SUMMARY

### Frontend (Netlify)
```
/
└── index.html    # The entire builder app
```

### Backend (Railway)
```
onlyzines-backend/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── jwt.ts
│   │   │   ├── middleware.ts
│   │   │   └── password.ts
│   │   ├── errors.ts
│   │   ├── prisma.ts
│   │   └── spreads.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── index.ts
│   │   └── publisher.ts
│   ├── app.ts
│   └── server.ts
├── package.json
├── tsconfig.json
└── .env.example
```

---

## LOCAL DEVELOPMENT

To run locally:

### Backend
```bash
cd onlyzines-backend
cp .env.example .env
# Edit .env with your database URL and secrets
npm install
npm run db:generate
npm run db:push
npm run dev
```

### Frontend
Just open `index.html` in a browser, or use a simple server:
```bash
cd onlyzines-builder
npx serve .
```

---

## ENVIRONMENT VARIABLES REFERENCE

| Variable | Required | Example |
|----------|----------|---------|
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/db` |
| `JWT_ACCESS_SECRET` | Yes | 32+ character random string |
| `JWT_REFRESH_SECRET` | Yes | 32+ character random string |
| `FRONTEND_URL` | Yes | `https://yoursite.netlify.app` |
| `PORT` | No | `3001` (default) |
| `NODE_ENV` | No | `production` |

---

## SUCCESS!

Once deployed, you have:
- ✅ A live builder at your Netlify URL
- ✅ Full auth (signup/login/logout)
- ✅ Zine and issue management
- ✅ Autosave with 2-second debounce
- ✅ Cmd/Ctrl+S manual save
- ✅ Publish with live URL
- ✅ View Live button after publishing

**Your OnlyZines Builder is ready to use!**
