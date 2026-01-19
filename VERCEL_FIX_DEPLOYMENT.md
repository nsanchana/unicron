# Fix Vercel Deployment - Step by Step

## Problem
You're getting: `404: NOT_FOUND Code: DEPLOYMENT_NOT_FOUND`

This means Vercel isn't deploying your `api/` folder because the Root Directory setting is wrong.

---

## Solution: Configure Root Directory

### Step 1: Go to Vercel Dashboard
1. Open: https://vercel.com/dashboard
2. Find your project: **myunicron**
3. Click on it

### Step 2: Go to Settings
1. Click **Settings** (top navigation bar)
2. Click **General** (left sidebar)

### Step 3: Verify Git Repository
Scroll down and check **Git Configuration** section:

**Should show:**
- Repository: `nsanchana/git-practice` ✓
- Production Branch: `master` ✓

If it shows something else, you connected the wrong repo.

### Step 4: Set Root Directory

Scroll down to find **Root Directory** section.

**Current setting:** Probably blank or `.` (WRONG)

**What it should be:**
```
options-trading-ai-enhanced
```

**How to change it:**
1. Click **Edit** next to Root Directory
2. Type: `options-trading-ai-enhanced`
3. Click **Save**

### Step 5: Verify Build Settings

While you're in Settings → General, check these:

| Setting | Value |
|---------|-------|
| Root Directory | `options-trading-ai-enhanced` |
| Framework Preset | `Vite` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Node.js Version | 18.x or 20.x |

### Step 6: Redeploy

After saving the Root Directory:
1. Go to **Deployments** tab
2. Vercel should automatically start a new deployment
3. Wait 2-3 minutes for it to complete

---

## How to Verify It Worked

### Test 1: Check API Endpoint

Open in browser:
```
https://myunicron.vercel.app/api/auth/logout
```

**Expected result:**
```json
{"success":true}
```

**If you still get 404:** Root Directory is still wrong

### Test 2: Check Deployment Logs

1. Go to **Deployments** tab
2. Click on the **latest deployment**
3. Click **Building** tab
4. Scroll through the logs

**Look for these lines:**
```
✓ Serverless Function "api/auth/login.js"
✓ Serverless Function "api/auth/me.js"
✓ Serverless Function "api/auth/logout.js"
```

**If you don't see these:** The API functions aren't being deployed

### Test 3: Try Logging In

1. Go to: https://myunicron.vercel.app
2. Enter credentials:
   - Username: `nsanchana`
   - Password: `Ns998923++`
3. Click Sign In

**Expected:** Should log in successfully and show the dashboard

---

## Still Getting 404?

### Double-check Root Directory

Sometimes the setting doesn't save properly. Try this:

1. Go to Settings → General
2. Look at Root Directory
3. If it shows `options-trading-ai-enhanced`, try:
   - Click Edit
   - Delete the value
   - Re-type: `options-trading-ai-enhanced`
   - Click Save
4. Wait for automatic redeploy

### Alternative: Use Vercel CLI

If the dashboard isn't working, you can deploy from command line:

```bash
cd /Users/nareshsanchana/git-practice/options-trading-ai-enhanced
npm install -g vercel
vercel --prod
```

Follow the prompts and it will deploy correctly.

---

## What's Happening Behind the Scenes

Your git repository structure is:
```
git-practice/                           ← Repository root
├── options-trading-ai/                 ← Old folder (ignored)
├── options-trading-ai-enhanced/        ← Your app is here!
│   ├── api/
│   │   └── auth/
│   │       ├── login.js               ← These need to be deployed
│   │       ├── me.js
│   │       └── logout.js
│   ├── src/
│   ├── package.json
│   └── vercel.json
└── options-trading-tool/               ← Another folder (ignored)
```

**Without Root Directory set:**
- Vercel looks at `git-practice/` root
- Can't find `api/` folder
- Returns 404

**With Root Directory = `options-trading-ai-enhanced`:**
- Vercel looks at `git-practice/options-trading-ai-enhanced/`
- Finds `api/` folder
- Deploys serverless functions correctly

---

## Need More Help?

Reply with a screenshot of Settings → General showing:
1. Git Repository
2. Root Directory
3. Build & Development Settings
