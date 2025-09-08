# Render.com Deployment Guide for FreeAgent OAuth Proxy

## Quick Setup for Render.com

### Step 1: Prepare Your Code

Make sure your proxy-server folder is pushed to GitHub:
```bash
git add proxy-server/
git commit -m "Add OAuth proxy server"
git push origin main
```

### Step 2: Create Render Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository

### Step 3: Configure Your Service

Fill in these exact settings:

| Setting | Value |
|---------|-------|
| **Name** | `freeagent-oauth-proxy` |
| **Region** | Choose closest to you |
| **Branch** | `main` |
| **Root Directory** | `proxy-server` (if in subdirectory) |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

### Step 4: Environment Variables

Click **"Advanced"** and add these environment variables:

| Key | Value |
|-----|-------|
| `FREEAGENT_CLIENT_ID` | `t7BdB9vrNrTG9rcxQXMy7Q` |
| `FREEAGENT_CLIENT_SECRET` | Your secret from FreeAgent |
| `PORT` | `10000` |

⚠️ **Important:** Get your `FREEAGENT_CLIENT_SECRET` from your FreeAgent app settings.

### Step 5: Deploy

1. Click **"Create Web Service"**
2. Wait for deployment (2-5 minutes)
3. Your service URL is: `https://freeagenttimedash.onrender.com`

### Step 6: Update Chrome Extension

Edit `auth.js` in your extension (already updated):

```javascript
getProxyUrl() {
    // Production Render.com URL
    return 'https://freeagenttimedash.onrender.com';
}
```

### Step 7: Test the Setup

1. Check server health:
```bash
curl https://freeagenttimedash.onrender.com/health
```

2. Reload your Chrome extension
3. Try connecting to FreeAgent

## Troubleshooting

### Service won't start
- Check logs in Render dashboard
- Ensure `npm start` is the start command
- Verify all environment variables are set

### "Token exchange failed"
- Double-check your `FREEAGENT_CLIENT_SECRET` is correct
- Ensure the Render service is fully deployed (green status)

### CORS errors
- The server is configured to accept Chrome extension origins
- Check that your extension ID hasn't changed

### Free tier limitations
- Render free tier spins down after 15 minutes of inactivity
- First request after idle will be slower (cold start)
- This is normal and won't affect functionality

## Monitoring

- View logs: Render Dashboard → Your Service → "Logs"
- Check metrics: Render Dashboard → Your Service → "Metrics"
- Service URL: Check under "Settings" tab

## Security Notes

✅ Your client_secret is stored securely on Render  
✅ HTTPS is automatic on Render  
✅ Environment variables are encrypted  
✅ Ready for Chrome Web Store submission

## Next Steps

1. ✅ Deploy to Render
2. ✅ Update extension with Render URL
3. ✅ Test OAuth flow
4. 🎉 Submit to Chrome Web Store!