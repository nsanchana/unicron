# Fix 404 Error on Vercel

## The Problem
You're seeing `404: NOT_FOUND` because Vercel isn't configured correctly for this monorepo structure.

## Quick Fix - Reconfigure Your Vercel Project

### Step 1: Delete Current Deployment (if exists)

1. Go to your Vercel dashboard
2. Click on your project
3. Go to **Settings** → **General**
4. Scroll to bottom → Click **"Delete Project"**
5. Confirm deletion

### Step 2: Re-import with Correct Settings

1. **Go to Vercel** → Click **"Add New..." → "Project"**

2. **Import `nsanchana/git-practice`**

3. **CRITICAL - Configure Root Directory:**
   - Click **"Edit"** next to "Root Directory"
   - Type or select: `options-trading-ai-enhanced`
   - Click **"Continue"**

4. **Verify Build Settings:**
   - Framework Preset: **Vite** (should auto-detect)
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

5. **Add Environment Variables** (click "Environment Variables"):

   Add these 4 variables:

   | Variable | Value |
   |----------|-------|
   | `ANTHROPIC_API_KEY` | `sk-ant-api03-2wRwu...` (from your `.env` file) |
   | `SESSION_SECRET` | `c8bc0950a090d2bbb38b48b5b819aba08bed93de59c56d840c6ffaf34d8450bb` |
   | `NODE_ENV` | `production` |
   | `VERCEL` | `1` |

   **Leave `FRONTEND_URL` blank for now** - we'll add it after first deploy.

6. **Click "Deploy"**

### Step 3: After Successful Deploy

1. **Copy your app URL** (e.g., `https://git-practice-abc123.vercel.app`)
2. Go to **Settings → Environment Variables**
3. Add new variable:
   - Name: `FRONTEND_URL`
   - Value: Your exact app URL (paste it)
4. **Redeploy**: Go to Deployments → Latest → "..." → Redeploy

---

## Alternative: Check Current Project Settings

If you don't want to delete and recreate, check these settings:

### 1. Verify Root Directory

Go to **Settings → General → Root Directory**

- Should be: `options-trading-ai-enhanced`
- If it's blank or wrong, update it and redeploy

### 2. Verify Build Settings

Go to **Settings → General**

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### 3. Verify Environment Variables

Go to **Settings → Environment Variables**

Make sure these exist:
- ✅ `ANTHROPIC_API_KEY`
- ✅ `SESSION_SECRET`
- ✅ `NODE_ENV` = `production`
- ✅ `VERCEL` = `1`

### 4. Redeploy

After fixing settings:
1. Go to **Deployments**
2. Click latest deployment → "..." menu → **Redeploy**

---

## Why This Happens

The 404 error occurs because:

1. **Wrong Root Directory**: Vercel is looking in the wrong folder
2. **Missing Build**: Vite isn't building the static files
3. **Wrong Framework**: Vercel isn't detecting it as a Vite project

The root directory **MUST** be set to `options-trading-ai-enhanced` because your repo has this structure:

```
nsanchana/git-practice/
├── options-trading-ai-enhanced/    ← Your app is HERE
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
└── other files...
```

---

## Check Your Deployment

After redeploying with correct settings:

1. ✅ Visit your URL - should see **Login page** (not 404)
2. ✅ Check browser console - no errors
3. ✅ Try to register - creates account
4. ✅ Login works - shows dashboard

---

## Still Getting 404?

Check the build logs:

1. Go to **Deployments** tab
2. Click the failed deployment
3. Click **"Building"** to see logs
4. Look for errors

Common issues:
- "Cannot find module" → Missing dependency in package.json
- "Build failed" → Check if `npm run build` works locally
- "No output directory" → Output directory should be `dist`

---

## Need More Help?

Run this locally to verify everything builds correctly:

```bash
cd /Users/nareshsanchana/git-practice/options-trading-ai-enhanced
npm install
npm run build
ls -la dist/
```

You should see files in the `dist/` folder including `index.html`.

If local build works but Vercel fails, the issue is definitely the root directory setting!
