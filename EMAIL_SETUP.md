# Email Setup

FinTrack sends transactional email for password reset OTPs using the Resend API.

## Environment

```env
RESEND_API_KEY=re_replace_with_resend_api_key
EMAIL_FROM=FinTrack <noreply@yourdomain.com>
```

## Resend Setup

1. Create a Resend API key.
2. Verify your sending domain in Resend.
3. Configure SPF, DKIM, and DMARC for that domain.
4. Set `EMAIL_FROM` to a sender on the verified domain, such as `FinTrack <noreply@yourdomain.com>`.
5. Store `RESEND_API_KEY` in the deployment secret manager, not source control.

For early development, Resend allows the test sender `onboarding@resend.dev`, but production should use a verified domain.

## Production Requirements

- Add email delivery monitoring in the Resend dashboard or webhooks.
- Add rate limits for OTP requests.
- Do not disclose whether an email is registered.
- Use cryptographically secure OTP generation.
- Avoid logging OTP values.

## Test Flow

```bash
curl -X POST http://localhost:5001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Then check the recipient inbox or the Resend dashboard.

## Troubleshooting

| Symptom | Likely Fix |
| --- | --- |
| `Invalid API key` | Check `RESEND_API_KEY`. |
| Sender rejected | Verify the sender domain and `EMAIL_FROM`. |
| Email sent but not received | Check spam, domain DNS records, and Resend delivery logs. |
| Only test recipients work | Use a verified production domain instead of the test sender. |
