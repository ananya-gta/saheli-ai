# Deploying Saheli AI

Two parts: **A. put the code on GitHub** (from your laptop), **B. run it on the GoDaddy VPS**.
Then **C. verify everything on the hackathon checklist** and **D. submit**.

Everything you type is in a code block. Replace `<...>` with your own values.

---

## A. Code → GitHub (`github.com/ananya-gta/saheli-ai`)

> Working on an office laptop: your company may already have a GitHub login saved on it. The steps below use
> settings for **this folder only** and push with **your personal account**, so nothing mixes with work.
> (If your employer has a policy about personal projects on company devices, follow it.)

**A1. Unzip the new code next to your old folder, then copy your `.env` into it.**
Never put `.env` on GitHub (it is already in `.gitignore`).

```bash
cd ~/Desktop            # wherever you keep it
unzip saheli-ai-full.zip -d saheli-new
cp saheli-ai/.env saheli-new/saheli-ai/.env       # your existing keys
cd saheli-new/saheli-ai
```

**A2. Check the frontend compiles** (CI runs the same checks on GitHub):

```bash
cd frontend && npm install && npm run typecheck && npm run build && cd ..
```

**A3. Create the repository locally, with *your* name on the commits (this folder only):**

```bash
git init -b main
git config user.name  "Ananya Gupta"
git config user.email "<the email on your personal GitHub account>"
git add .
git status            # .env, data/, sites/, node_modules/ must NOT be in this list
```

Safety check — this must print only the `REPLACE_ME` placeholders from `.env.example`, nothing else:

```bash
git grep -n -E "sk-ant-|gd_pat_|SMTP_PASS=." -- . ':!*.md'
```

```bash
git commit -m "Saheli AI: voice-first AI business launch partner"
```

**A4. Log in to your personal GitHub.** Create a token: GitHub → Settings → Developer settings →
Personal access tokens → **Fine-grained** → *Repository access: only `saheli-ai`* → *Contents: Read and write* →
Generate. Copy it (it starts with `github_pat_`).

**A5. Push.** Putting your username in the URL makes the laptop ask for *your* login, not the office one:

```bash
git remote add origin https://ananya-gta@github.com/ananya-gta/saheli-ai.git
git push -u origin main
```

When asked for a password, paste the **token** (not your GitHub password).

**A6.** On GitHub: open the repo → **Actions** tab → the "CI" run should turn green (backend tests + frontend build).
Before submitting, make the repo **Public** (Settings → General → Danger zone → Change visibility) so judges can read it.

**Later changes:** edit → `git add . && git commit -m "what changed" && git push` → then on the VPS run `./scripts/deploy.sh`.

---

## B. GoDaddy VPS

You need from the GoDaddy VPS panel: the **IP address**, the **username** (often `root` or one you created) and its
**password or SSH key**.

**B1. Log in to the server** (Mac/Linux Terminal, or Windows PowerShell):

```bash
ssh <username>@<VPS-IP>
```

**B2. Install Docker, git and a firewall** (one time, ~3 minutes):

```bash
sudo apt-get update && sudo apt-get install -y git curl ufw
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable
exit
```

Log in again (`ssh <username>@<VPS-IP>`) so the Docker permission applies. Check: `docker run --rm hello-world`.

**B3. Get the code:**

```bash
git clone https://github.com/ananya-gta/saheli-ai.git
cd saheli-ai
```

(If the repo is still private, clone with `https://ananya-gta@github.com/ananya-gta/saheli-ai.git` and use the token as password.)

**B4. Create the production `.env`:**

```bash
cp .env.example .env
python3 -c "import secrets;print(secrets.token_urlsafe(48))"     # copy the output for SECRET_KEY
nano .env
```

Fill in (Ctrl+O, Enter, Ctrl+X to save):

| Setting | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your Claude key |
| `GODADDY_PAT` | your GoDaddy Personal Access Token |
| `SECRET_KEY` | the random string you just generated |
| `ENV` | `production` (the API refuses to start if `SECRET_KEY`, `DOMAIN` or SMTP are missing) |
| `PEXELS_API_KEY` | optional, better photos |
| `SMTP_USER` / `MAIL_FROM` / `MAIL_TO` | `hello@saheliai.com` |
| `SMTP_PASS` | the mailbox password (lives **only** in this file on the server) |
| `ADMIN_EMAILS` | your email (for the failure drill) |
| `DOMAIN` | your domain, e.g. `saheliai.com` (the app URL and each site's `https://<slug>.<DOMAIN>` are derived from it) |

Protect it: `chmod 600 .env`

**B5. Point the domain at the server with GoDaddy's `gddy` CLI** (also ticks "gddy CLI working"):

```bash
curl -fsSL https://github.com/godaddy/cli/releases/latest/download/install.sh | bash
export PATH="$HOME/.local/bin:$PATH"
gddy --version
grep GODADDY_PAT .env | cut -d= -f2 | gddy pat add --env prod "saheli-vps"
gddy domain list
./scripts/setup-dns.sh
```

> If `gddy dns set` says *forbidden / insufficient scope*, your token can only read. Create a new PAT on
> developer.godaddy.com with **DNS write** permission for saheliai.com (keep the old one for domain search), or run
> `gddy auth login` instead (opens a browser login link you can open on your laptop).

This sets three A records — `saheliai.com`, `www` and `*` (every business subdomain) — to the VPS IP.
Your email (MX/TXT) records are not touched. If `gddy` rejects the `*` name, add that one record by hand:
GoDaddy → My Products → saheliai.com → DNS → Add → Type **A**, Name `*`, Value `<VPS-IP>`.

Check (1–10 minutes): `dig +short saheliai.com` and `dig +short test.saheliai.com` both show the VPS IP.

**B6. Start Saheli:**

```bash
./scripts/deploy.sh
```

First start: Docker builds both images (~3–5 min). HTTPS certificates are issued automatically on the first visit.
In the background the 5 demo websites and landing photos are created (1–2 min).

**Useful commands**

```bash
docker compose ps                         # what's running (api should be "healthy")
docker compose logs -f --tail 100 api     # live logs (every line has a request id)
docker compose restart api                # restart after editing .env
docker compose exec api python -m app.manage users
docker compose exec api python -m app.manage claim-sites <your-email>   # own the demo sites in your dashboard
```

**Backup** (do this before the demo):

```bash
docker run --rm -v saheli-ai_data:/data -v saheli-ai_sites:/data/sites -v "$PWD":/backup alpine \
  tar czf /backup/saheli-backup-$(date +%F).tgz /data
```

---

## C. Hackathon checklist — how each item is met

| Checklist item | How to verify |
|---|---|
| Developer account + `gddy` CLI working | `gddy --version` and `gddy domain list` on the VPS (step B5) |
| Customer ID and hosting choice submitted | done in the hackathon portal (Docker VPS) |
| App deployed on your hosting path | `docker compose ps` on the VPS; https://saheliai.com opens |
| Own domain bought and pointed at the app | `dig +short saheliai.com` = VPS IP |
| Site loads over HTTPS | padlock on https://saheliai.com and https://demo-bakery.saheliai.com |
| Mailbox created + test email received | log in to https://saheliai.com — the 6-digit code arrives at your inbox |
| Contact form sends to your mailbox | open https://demo-bakery.saheliai.com → enquiry form → email arrives at `hello@saheliai.com` |
| Mailbox password kept out of code and repo | only in `.env` on the server; `.env` is in `.gitignore`; the `git grep` check in A3 |

Also try: create a business end to end, place an order on its website, confirm the payment in the dashboard,
and in the chat open **log** → *Failure drill* → "GoDaddy down", ask for domain names, and watch Saheli recover.

---

## D. Submit (by 20 November 2026, on HackerEarth)

- **Live link:** https://saheliai.com
- **GitHub repository:** https://github.com/ananya-gta/saheli-ai (public, CI green)
- **Project brief:** problem, who it helps, what Saheli does end to end, how Claude and GoDaddy are used, reliability,
  what is real vs. not built yet (see README → *Integration status*).
