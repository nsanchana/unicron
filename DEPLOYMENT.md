# Deploying Unicron to Vercel

This guide will walk you through deploying your Unicron Options Trading AI application to Vercel for multi-device access.

## Prerequisites

Before deploying, ensure you have:
- A [Vercel account](https://vercel.com/signup) (free tier works fine)
- A [GitHub account](https://github.com/signup)
- Your Anthropic API key from [console.anthropic.com](https://console.anthropic.com/)
- Git installed on your machine

## Quick Start - Deploy in 5 Minutes! 🚀

**Your code is already on GitHub!** Follow these simple steps:

### Step 1: Connect Vercel to GitHub (One-Time Setup)

1. **Go to [vercel.com](https://vercel.com/) and sign in** with your GitHub account
2. **Click "Add New..." → "Project"**
3. **First time?** Vercel will ask to install the GitHub integration:
   - Click "Install" or "Configure GitHub App"
   - Select your GitHub account (`nsanchana`)
   - Choose "All repositories" or select specific repos
   - Click "Install & Authorize"

### Step 2: Import Your Project

1. **Find your repository** in the list: `nsanchana/git-practice`
2. **Click "Import"**
3. **Configure the project:**
   - **Root Directory:** Click "Edit" and select `options-trading-ai-enhanced`
   - **Framework Preset:** Vite (auto-detected)
   - **Build Command:** `npm run build` (auto-filled)
   - **Output Directory:** `dist` (auto-filled)

### Step 3: Add Environment Variables

Click "Environment Variables" and add these **4 variables**:

| Name | Value | How to Get It |
|------|-------|---------------|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-2wRwu...` | Your existing API key |
| `SESSION_SECRET` | Generate below ⬇️ | Run command below |
| `NODE_ENV` | `production` | Type manually |
| `FRONTEND_URL` | Leave blank | Will update after deploy |

**Generate SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output (it looks like: `c8bc0950a090d2bbb38b48b5b819aba0...`)

### Step 4: Deploy!

1. **Click "Deploy"**
2. ☕ Wait 2-3 minutes while Vercel builds your app
3. 🎉 **Done!** You'll see "Congratulations" when it's ready

### Step 5: Update FRONTEND_URL

1. **Copy your app URL** (looks like `https://git-practice-abc123.vercel.app`)
2. Go to **Settings → Environment Variables**
3. **Edit `FRONTEND_URL`** and paste your app URL
4. Click **Save**
5. Go to **Deployments → latest deployment → "..." menu → Redeploy**

### Step 6: Create Your Account

1. **Visit your app URL**
2. Click **"Register"**
3. Create your username and password
4. **Start trading!** 🎯

---

## That's It!

From now on, **every time you push code to GitHub, Vercel automatically deploys it!** No manual steps needed.

```bash
# Make changes, then:
git add .
git commit -m "Your changes"
git push

# Vercel automatically deploys! ✨
```

---

## Advanced Options

### Option: Deploy via CLI (Alternative Method)

If you prefer command-line deployment:

```bash
npm install -g vercel
vercel login
cd /Users/nareshsanchana/git-practice/options-trading-ai-enhanced
vercel
```

Then add environment variables via CLI:
```bash
vercel env add ANTHROPIC_API_KEY
vercel env add SESSION_SECRET
vercel env add NODE_ENV
vercel env add FRONTEND_URL
vercel --prod
```

---

## Environment Variables Details

### Required Environment Variables:

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `ANTHROPIC_API_KEY` | Your Claude API key for AI-powered company analysis | `sk-ant-api03-...` |
| `SESSION_SECRET` | Encrypts user sessions (generate with crypto) | `c8bc0950a090d2bbb...` |
| `NODE_ENV` | Tells the app it's in production mode | `production` |
| `FRONTEND_URL` | Your deployed app URL for CORS (add after first deploy) | `https://your-app.vercel.app` |

---

## Automatic Deployments

**The best part:** Once you've connected Vercel to GitHub, every time you push code changes, Vercel automatically rebuilds and deploys your app!

```bash
# Make changes to your code
git add .
git commit -m "Added new feature"
git push

# Vercel automatically detects the push and deploys! ✨
# You can watch the build progress in the Vercel dashboard
```

**No manual steps needed ever again!**

---

## Verification Checklist

After deployment, test these features:

- ✅ **Login/Logout** - Log out and log back in
- ✅ **Company Research** - Search for a company (e.g., AAPL)
- ✅ **AI Analysis** - Verify sections show AI-generated insights (not generic templates)
- ✅ **Trade Review** - Add a trade and verify it appears in Dashboard
- ✅ **Settings** - Update your portfolio settings
- ✅ **Export** - Export research or trade data to CSV
- ✅ **Mobile Access** - Open on your phone to confirm cross-device access

## Production Configuration

### Database Considerations

**Current Setup:** SQLite database stored in `/tmp` directory on Vercel

**Limitations:**
- SQLite files in `/tmp` are ephemeral on Vercel serverless functions
- User accounts may be lost between deployments
- This is fine for personal use with 1-2 users

**For Production Use:**

If you need persistent user accounts, consider upgrading to a hosted database:

1. **PostgreSQL on Vercel Postgres** (Recommended)
   - Free tier available
   - Fully managed
   - [Vercel Postgres Setup](https://vercel.com/docs/storage/vercel-postgres)

2. **Supabase** (Alternative)
   - Free tier generous
   - PostgreSQL + Authentication built-in
   - [Supabase Setup](https://supabase.com/docs)

To migrate from SQLite to PostgreSQL, you'll need to:
- Update `auth.js` database dialect from `sqlite` to `postgres`
- Add database connection URL to environment variables
- Redeploy

### Security Best Practices

1. **Use Strong Session Secret**
   - Never commit session secret to git
   - Generate a new random secret for production

2. **Enable HTTPS Only**
   - Vercel provides this automatically
   - Cookies are set with `secure: true` in production

3. **API Key Protection**
   - API key is only used server-side
   - Never exposed to frontend
   - Stored securely in Vercel environment variables

4. **Regular Updates**
   - Keep dependencies updated: `npm update`
   - Monitor security advisories

## Troubleshooting

### "Invalid API key" Error

**Problem:** AI analysis shows fallback text instead of Claude insights

**Solution:**
1. Go to Vercel → Settings → Environment Variables
2. Verify `ANTHROPIC_API_KEY` is set correctly
3. Check it starts with `sk-ant-`
4. Redeploy the application

### "Unauthorized" on API Calls

**Problem:** Can't perform actions after logging in

**Solution:**
1. Verify `FRONTEND_URL` matches your actual Vercel URL exactly
2. Check browser console for CORS errors
3. Clear browser cookies and log in again
4. Redeploy if environment variables were changed

### "Session expired" Immediately After Login

**Problem:** Can't stay logged in

**Solution:**
1. Verify `SESSION_SECRET` environment variable is set
2. Make sure cookies are enabled in your browser
3. Check that `FRONTEND_URL` doesn't have trailing slash

### Database/Users Reset After Deployment

**Problem:** Users disappear after redeployment

**Explanation:** SQLite database is stored in `/tmp` which is ephemeral on Vercel

**Solutions:**
- **For personal use:** Just re-register after deployments (infrequent)
- **For production:** Migrate to PostgreSQL (see "Database Considerations" above)

### Build Failures

**Problem:** Deployment fails during build

**Common causes:**
1. Missing dependencies - run `npm install` locally first
2. TypeScript errors - check build with `npm run build` locally
3. Environment variables not set

**Solution:**
- Check build logs in Vercel dashboard
- Test build locally: `npm run build`
- Ensure all dependencies are in `package.json`

## Updating Your Deployment

### Automatic Deployments (Recommended)

Any push to your `main` branch triggers automatic deployment:

```bash
git add .
git commit -m "Update feature X"
git push origin main
```

Vercel will automatically build and deploy the changes.

### Manual Redeployment

Via Vercel Dashboard:
1. Go to "Deployments"
2. Click "..." menu on latest deployment
3. Click "Redeploy"

Via CLI:
```bash
vercel --prod
```

## Custom Domain (Optional)

To use your own domain (e.g., `unicron.yourdomain.com`):

1. Go to Vercel → Settings → Domains
2. Click "Add Domain"
3. Enter your domain name
4. Follow DNS configuration instructions
5. Update `FRONTEND_URL` environment variable to your custom domain
6. Redeploy

## Monitoring and Analytics

### View Application Logs

**Via Vercel Dashboard:**
1. Go to your project
2. Click "Logs" tab
3. Filter by function (server.js) or deployment

**Via CLI:**
```bash
vercel logs
```

### Monitor API Usage

**Anthropic API Usage:**
- Visit [console.anthropic.com](https://console.anthropic.com/)
- Check "Usage" section for token consumption
- Set up billing alerts if needed

### Vercel Analytics (Optional)

Enable Web Analytics in Vercel dashboard for:
- Page views
- User sessions
- Performance metrics

## Cost Considerations

### Vercel Hosting
- **Hobby Plan:** Free
  - 100GB bandwidth/month
  - Unlimited deployments
  - Sufficient for personal use

### Anthropic API
- **Claude 3.5 Sonnet:**
  - Input: ~$3 per 1M tokens
  - Output: ~$15 per 1M tokens
  - Typical usage: ~$0.50/day for 5-10 researches
  - ~$15/month for regular use

### Database (if upgraded)
- **SQLite (current):** Free (but ephemeral on Vercel)
- **Vercel Postgres:** Free tier available (5GB storage)
- **Supabase:** Free tier available (500MB database, 2GB bandwidth)

## Support Resources

- **Vercel Documentation:** [vercel.com/docs](https://vercel.com/docs)
- **Vercel Support:** [vercel.com/support](https://vercel.com/support)
- **Anthropic Documentation:** [docs.anthropic.com](https://docs.anthropic.com)
- **Anthropic Status:** [status.anthropic.com](https://status.anthropic.com)

## Next Steps

After successful deployment:

1. ✅ **Bookmark your app URL** for easy access
2. ✅ **Add app to phone home screen** for mobile access
3. ✅ **Test from different devices** to verify cross-device functionality
4. ✅ **Set up browser notifications** (if you enable PWA features)
5. ✅ **Review your first AI-generated research** to ensure quality
6. ✅ **Consider upgrading to PostgreSQL** if you need persistent user accounts

Congratulations! Your Unicron Options Trading AI is now live and accessible from anywhere! 🎉
