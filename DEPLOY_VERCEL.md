# Deploy DR DXB Server to Vercel

Follow these steps exactly to avoid mistakes. The app is already configured for Vercel.

---

## Before you start

- [ ] You have a **GitHub**, **GitLab**, or **Bitbucket** account.
- [ ] The project code is in a **git repository** and pushed to GitHub (or GitLab/Bitbucket).
- [ ] You have a **Vercel** account (free at [vercel.com](https://vercel.com)).

---

## Step 1: Push code to GitHub

If the project is not yet on GitHub:

1. Create a new repository on GitHub (e.g. `dr-dxb-server`).
2. In your project folder, run:

```bash
cd /Users/belal/ahmad
git init
git add .
git commit -m "DR DXB Server - ready for Vercel"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your GitHub username and repository name.

---

## Step 2: Import project in Vercel

1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New…** → **Project**.
3. **Import** your repository (GitHub/GitLab/Bitbucket).
4. Select the repo that contains DR DXB Server.
5. Vercel will detect **Next.js** automatically. Do **not** change:
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build` (or leave default)
   - **Output Directory:** (leave default)
   - **Install Command:** `npm install` (or leave default)
6. **Root Directory:** leave blank unless the app is inside a subfolder.
7. Click **Deploy**.

---

## Step 3: Environment variables (optional)

The app works without any env vars. If you want custom RPC URLs:

1. In Vercel: open your project → **Settings** → **Environment Variables**.
2. Add (optional):
   - `NEXT_PUBLIC_ETH_RPC_URL` = your Ethereum RPC URL (e.g. from Infura/Alchemy).
   - `NEXT_PUBLIC_BSC_RPC_URL` = your BSC RPC URL.
3. Redeploy: **Deployments** → **⋯** on latest → **Redeploy**.

---

## Step 4: After first deploy

1. Wait for the build to finish (usually 1–2 minutes).
2. Vercel will show a URL like: `https://your-project.vercel.app`.
3. Open that URL in the browser.
4. Connect MetaMask and test: create a token (e.g. on a testnet first) and deploy.

---

## Step 5: Custom domain (optional)

1. In Vercel: **Settings** → **Domains**.
2. Add your domain (e.g. `app.drdxb.com`).
3. Follow Vercel’s instructions to add the DNS records at your registrar.

---

## Checklist before going live for clients

- [ ] Build completed successfully on Vercel.
- [ ] You opened the live URL and the page loads (black + gold theme).
- [ ] You connected MetaMask and switched to the correct network.
- [ ] You did a test deploy (e.g. on BSC or Ethereum testnet) and saw the success screen.
- [ ] You checked “Your Deployed Tokens” and the explorer link works.
- [ ] If you use env vars, they are set in Vercel and you redeployed once.

---

## If something goes wrong

- **Build fails on Vercel:** Check the build logs. Usually it’s a dependency or Node version. This project uses Node 18+.
- **Page is blank:** Hard refresh (Ctrl+Shift+R). Disable browser translation for the site.
- **“Compiler not ready”:** First load can take 10–30 seconds; ask the user to wait. They must allow the script from `binaries.soliditylang.org`.

---

## Summary

1. Push code to GitHub.
2. In Vercel: Add New → Project → Import repo → Deploy.
3. Test the live URL and do one test deploy.
4. Optionally add env vars and custom domain.

No server-side signing or secrets: everything runs in the browser. Safe for clients.
