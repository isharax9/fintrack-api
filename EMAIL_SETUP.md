# Email Setup

FinTrack sends transactional email for password reset OTPs.

Current implementation uses Nodemailer with SMTP settings from environment variables:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_your_api_key_here
EMAIL_FROM=FinTrack <noreply@yourdomain.com>
```

## Recommended Provider

Use Resend, Postmark, SendGrid, or Amazon SES for production. Avoid Gmail for production because it is fragile for app email and has account-level sending limits.

## Local Development

Use Ethereal for local testing:

```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your_ethereal_user
SMTP_PASS=your_ethereal_password
EMAIL_FROM=FinTrack <your_ethereal_user>
```

When Ethereal is used, Nodemailer can expose a preview URL in the API logs.

## Production Requirements

- Verify the sending domain.
- Configure SPF, DKIM, and DMARC.
- Use a real product sender such as `FinTrack <noreply@yourdomain.com>`.
- Store SMTP credentials in the deployment secret manager, not source control.
- Add email delivery monitoring.
- Add rate limits for OTP requests.
- Do not disclose whether an email is registered.
- Use cryptographically secure OTP generation.

## Test Flow

```bash
curl -X POST http://localhost:5001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Then check the provider inbox, provider dashboard, or Ethereal preview URL.

## Troubleshooting

| Symptom | Likely Fix |
| --- | --- |
| `ECONNREFUSED` | Check SMTP host and port. |
| `Invalid login` | Check SMTP username and password. |
| Email sent but not received | Check spam, sender domain verification, and provider logs. |
| TLS/certificate errors | Fix provider TLS settings; only bypass TLS in local throwaway environments. |
