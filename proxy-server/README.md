# FreeAgent OAuth Proxy Server

This proxy server securely handles OAuth token exchange for the FreeAgent Chrome Extension, keeping your client_secret safe on the server side.

## Quick Start (Local Development)

### 1. Install Dependencies
```bash
cd proxy-server
npm install
```

### 2. Configure Environment Variables
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your FreeAgent client_secret
# The client_id is already filled in from your extension
```

### 3. Start the Server
```bash
# For development (with auto-restart)
npm run dev

# For production
npm start
```

The server will run on http://localhost:3000

### 4. Test the Server
```bash
# Check if server is running
curl http://localhost:3000/health
```

## Deployment Options

### Option 1: Deploy to Vercel (Recommended - FREE)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard:
- Go to your project settings
- Add `FREEAGENT_CLIENT_ID` and `FREEAGENT_CLIENT_SECRET`

4. Update your extension's `auth.js`:
```javascript
getProxyUrl() {
    return 'https://your-app.vercel.app';
}
```

### Option 2: Deploy to Heroku

1. Create a Heroku app:
```bash
heroku create your-app-name
```

2. Set environment variables:
```bash
heroku config:set FREEAGENT_CLIENT_ID=t7BdB9vrNrTG9rcxQXMy7Q
heroku config:set FREEAGENT_CLIENT_SECRET=your_secret_here
```

3. Deploy:
```bash
git push heroku main
```

4. Update your extension's `auth.js`:
```javascript
getProxyUrl() {
    return 'https://your-app-name.herokuapp.com';
}
```

### Option 3: Deploy to Render (FREE) - RECOMMENDED

1. **Push your proxy-server folder to GitHub**
   - Create a new repository or add to existing one
   - Push the proxy-server folder

2. **Create a Render Web Service**
   - Go to https://render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub account if not already connected
   - Select your repository

3. **Configure the Web Service**
   - **Name:** `freeagent-oauth-proxy` (or your choice)
   - **Region:** Choose closest to you
   - **Branch:** `main` (or your default branch)
   - **Root Directory:** `proxy-server` (if proxy-server is in a subdirectory)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`

4. **Add Environment Variables**
   Click "Advanced" and add:
   - Key: `FREEAGENT_CLIENT_ID` | Value: `t7BdB9vrNrTG9rcxQXMy7Q`
   - Key: `FREEAGENT_CLIENT_SECRET` | Value: `[Your secret from FreeAgent]`
   - Key: `PORT` | Value: `10000` (Render uses port 10000)

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (takes 2-5 minutes)
   - Your URL will be: `https://freeagenttimedash.onrender.com`

6. **Update your extension's auth.js**
   ```javascript
   getProxyUrl() {
       return 'https://freeagenttimedash.onrender.com';
   }
   ```

### Option 4: Deploy to Railway

1. Install Railway CLI:
```bash
npm i -g @railway/cli
```

2. Deploy:
```bash
railway login
railway init
railway up
```

3. Set environment variables in Railway dashboard

## Security Considerations

✅ **Client secret is stored only on the server**
✅ **CORS is configured to accept only Chrome extension origins**
✅ **All sensitive data is in environment variables**
✅ **HTTPS is required in production**

## API Endpoints

### POST /api/freeagent/token
Exchanges authorization code for access tokens
```json
{
  "code": "authorization_code_from_oauth",
  "redirect_uri": "chrome_extension_redirect_uri"
}
```

### POST /api/freeagent/refresh
Refreshes an expired access token
```json
{
  "refresh_token": "your_refresh_token"
}
```

### GET /health
Health check endpoint

## Troubleshooting

### "Token exchange failed"
- Check that your CLIENT_SECRET is correct in .env
- Ensure the redirect_uri matches exactly what's registered in FreeAgent

### CORS errors
- Make sure your extension ID is correct
- For local testing, the server allows localhost origins

### Connection refused
- Ensure the proxy server is running
- Check firewall settings for port 3000

## Local Testing with Extension

1. Start the proxy server locally
2. In your extension's `auth.js`, ensure proxy URL is set to `http://localhost:3000`
3. Load the extension in Chrome
4. Test the authentication flow

## Production Checklist

- [ ] Deploy proxy server to hosting service
- [ ] Set environment variables on hosting platform
- [ ] Update extension's `auth.js` with production proxy URL
- [ ] Test authentication flow in production
- [ ] Enable HTTPS (automatic on most platforms)
- [ ] Monitor server logs for errors