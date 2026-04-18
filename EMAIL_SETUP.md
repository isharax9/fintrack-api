# Email Service Setup Guide

FinTrack uses SMTP to send transactional emails (password reset OTPs). This guide covers three provider options.

---

## Option A: Resend (Recommended)

[Resend](https://resend.com) is a modern email API with a generous free tier (100 emails/day).

### Steps

1. **Create an account** at [resend.com/signup](https://resend.com/signup)
2. **Add and verify your domain** (or use the free `onboarding@resend.dev` sender for testing)
3. **Create an API Key** from the dashboard → API Keys → Create API Key
4. **Update your `.env`:**

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_your_api_key_here
EMAIL_FROM=FinTrack <noreply@yourdomain.com>
```

5. **Update `docker-compose.yml`** with the same values under `api.environment`

> **Note:** If you haven't verified a domain, use `EMAIL_FROM=FinTrack <onboarding@resend.dev>` — Resend allows this for testing.

---

## Option B: Ethereal (Local Development)

[Ethereal](https://ethereal.email) is a fake SMTP service. Emails are captured and viewable in a web inbox — nothing is actually delivered.

### Steps

1. **Go to** [ethereal.email](https://ethereal.email) and click **"Create Ethereal Account"**
2. You'll get credentials like:
   ```
   Host: smtp.ethereal.email
   Port: 587
   User: john.doe@ethereal.email
   Pass: abc123xyz
   ```
3. **Update your `.env`:**

```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=john.doe@ethereal.email
SMTP_PASS=abc123xyz
EMAIL_FROM=FinTrack <john.doe@ethereal.email>
```

4. When you trigger a password reset, the API will log a **Preview URL** to the console. Open that URL to see the email in Ethereal's web inbox.

---

## Option C: Gmail (Not recommended for production)

Gmail works but requires enabling "App Passwords" and has strict rate limits.

### Steps

1. Enable **2-Step Verification** on your Google Account
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Generate an app password for "Mail"
4. **Update your `.env`:**

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASS=your_16_char_app_password
EMAIL_FROM=FinTrack <your.email@gmail.com>
```

> ⚠️ Gmail limits sending to ~500 emails/day for personal accounts and may flag automated emails as suspicious.

---

## Testing the Setup

After updating your environment variables, restart the API:

```bash
docker compose down
docker compose up --build
```

Then test the forgot-password flow:

```bash
# Register a user first (if you haven't already)
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com", "password": "test123"}'

# Trigger forgot password
curl -X POST http://localhost:5001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

Check your email provider dashboard (Resend/Ethereal) or your inbox (Gmail) for the OTP.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Error: connect ECONNREFUSED` | SMTP host/port is wrong or unreachable from Docker |
| `Error: Invalid login` | SMTP_USER or SMTP_PASS is incorrect |
| Email sent but not received | Check spam folder; for Ethereal, use the Preview URL from logs |
| `Error: self signed certificate` | Add `NODE_TLS_REJECT_UNAUTHORIZED=0` to env (dev only!) |
