# Vercel Deployment Checklist

## 🚀 Quick Deploy Steps

### 1. Go to Vercel
👉 **[vercel.com](https://vercel.com)** - Sign in with GitHub

### 2. Import Project
- Click **"Add New..." → "Project"**
- Find: `nsanchana/git-practice`
- Click **"Import"**

### 3. Configure Root Directory
- Click **"Edit"** next to Root Directory
- Select: `options-trading-ai-enhanced`
- Framework: Vite ✅ (auto-detected)
- Build Command: `npm run build` ✅ (auto-filled)
- Output: `dist` ✅ (auto-filled)

### 4. Add Environment Variables

**Add these 4 variables:**

| Variable | Where to Get Value |
|----------|-------------------|
| `ANTHROPIC_API_KEY` | Check your `.env` file (starts with `sk-ant-`) |
| `SESSION_SECRET` | `c8bc0950a090d2bbb38b48b5b819aba08bed93de59c56d840c6ffaf34d8450bb` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | *(leave blank for now)* |

**To find your API key:**
```bash
cat /Users/nareshsanchana/git-practice/options-trading-ai-enhanced/.env
```

### 5. Deploy
Click **"Deploy"** → Wait 2-3 minutes ☕

### 6. Update FRONTEND_URL
1. Copy your app URL (e.g., `https://git-practice-abc123.vercel.app`)
2. Go to: **Settings → Environment Variables**
3. Edit `FRONTEND_URL` → paste your URL
4. Click **Save**
5. Go to: **Deployments → "..." menu → Redeploy**

### 7. Create Account
1. Visit your app URL
2. Click **Register**
3. Create username & password
4. Start trading! 🎯

---

## ✅ Done!

From now on, every `git push` automatically deploys!

```bash
git add .
git commit -m "New feature"
git push
# Vercel auto-deploys! ✨
```

---

## 🆘 Troubleshooting

**Build fails?**
- Check build logs in Vercel dashboard
- Verify all 4 environment variables are set

**Can't login after deploy?**
- Make sure `FRONTEND_URL` matches your exact Vercel URL
- Try clearing browser cookies

**AI analysis not working?**
- Verify `ANTHROPIC_API_KEY` is correct in Vercel
- Check it starts with `sk-ant-`

**Need help?**
- Full guide: [DEPLOYMENT.md](DEPLOYMENT.md)
