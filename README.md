# Cable — Broadcast Console

Multi-platform social media broadcasting tool for think tanks and creators. Write once, customize per platform, broadcast everywhere.

## Supported Platforms

| Platform | Auth Method | Notes |
|----------|-------------|-------|
| **X (Twitter)** | OAuth 1.0a | Requires X Developer App with read+write |
| **LinkedIn** | OAuth 2.0 | Requires LinkedIn Developer App with `w_member_social` scope |
| **Bluesky** | App Password | Uses AT Protocol. Generate app password in Bluesky settings |
| **Substack Notes** | Clipboard | Copies text to clipboard and opens Substack Notes |

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Cable v1.0"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Import in Vercel

Go to [vercel.com/new](https://vercel.com/new), import your repository.

### 3. Set Environment Variables

In the Vercel dashboard → Settings → Environment Variables, add:

```
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
COOKIE_SECRET=<random string, at least 32 characters>

# X (Twitter) — from developer.twitter.com
X_API_KEY=<your key>
X_API_SECRET=<your secret>

# LinkedIn — from linkedin.com/developers
LINKEDIN_CLIENT_ID=<your client id>
LINKEDIN_CLIENT_SECRET=<your client secret>

# Bluesky (optional — users can also enter credentials in Settings)
BLUESKY_HANDLE=<your.handle.bsky.social>
BLUESKY_APP_PASSWORD=<your app password>
```

### 4. Configure OAuth Callback URLs

**X Developer Portal:**
- Callback URL: `https://your-app.vercel.app/api/auth/x/callback`
- Website URL: `https://your-app.vercel.app`

**LinkedIn Developer Portal:**
- Authorized redirect URL: `https://your-app.vercel.app/api/auth/linkedin/callback`

### 5. Deploy

```bash
vercel --prod
```

Or push to `main` for automatic deployment.

## Local Development

```bash
npm install
cp .env.example .env.local  # fill in your keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

- **Next.js 14** (App Router) — deployed as serverless on Vercel
- **iron-session** — encrypted cookie-based sessions (no database needed)
- **Custom OAuth 1.0a** — uses Node.js built-in `crypto` (no external OAuth library)
- **API Routes** — handle auth flows, posting, and OpenGraph metadata fetching
- **No database required** — all auth state is stored in encrypted cookies
