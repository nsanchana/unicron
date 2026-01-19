# Vercel Deployment Troubleshooting

## Current Error
`Unexpected token 'T', "The page c"... is not valid JSON`

This means the login is trying to call `/api/auth/login` but Vercel is returning an HTML 404 page instead of the JSON response from your serverless function.

## Root Cause
Vercel needs the **Root Directory** setting to be configured correctly.

## Fix Instructions

### Step 1: Check Root Directory Setting

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Click on your project: `myunicron`
3. Click **Settings** (top navigation)
4. Click **General** (left sidebar)
5. Scroll down to **Root Directory**

**IMPORTANT:** It should be set to:
```
options-trading-ai-enhanced
```

If it's blank or set to `.` or anything else, this is the problem.

### Step 2: Update Root Directory

1. Click **Edit** next to Root Directory
2. Type: `options-trading-ai-enhanced`
3. Click **Save**
4. Vercel will automatically redeploy

### Step 3: Wait for Deployment

Wait 2-3 minutes for the deployment to complete, then try again.

---

## Alternative: Check if API Functions Exist

Go to: https://myunicron.vercel.app/api/auth/login

**If you see:**
- `{"error":"Method not allowed"}` → Good! The function exists, just needs POST request
- `404 Page Not Found` → Root directory is wrong

---

## If Root Directory is Already Correct

If the Root Directory is already set to `options-trading-ai-enhanced`, then we need to check the build output.

### Check Deployment Logs

1. Go to your Vercel dashboard
2. Click on your project
3. Click on the **latest deployment** (top of list)
4. Click on **Building** tab
5. Scroll to the bottom and check if you see:

```
✓ Serverless Function "api/auth/login.js"
✓ Serverless Function "api/auth/me.js"
✓ Serverless Function "api/auth/logout.js"
```

If you don't see these, the functions aren't being deployed.

---

## Test the API Directly

Open a new browser tab and try:

```
https://myunicron.vercel.app/api/auth/logout
```

**Expected response:**
```json
{"success":true}
```

If you get a 404 page, the Root Directory is definitely wrong.

---

## Quick Fix Checklist

- [ ] Root Directory = `options-trading-ai-enhanced`
- [ ] Framework Preset = `Vite`
- [ ] Build Command = `npm run build`
- [ ] Output Directory = `dist`
- [ ] Node.js Version = 18.x or 20.x

---

## Still Not Working?

If you've confirmed all the above and it still doesn't work, reply with:

1. A screenshot of Settings → General showing the Root Directory
2. What you see when you visit: https://myunicron.vercel.app/api/auth/logout
3. The full deployment logs from the Building tab
