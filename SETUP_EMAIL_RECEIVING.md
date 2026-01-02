# Email Receiving Setup

The CRM can now automatically receive emails via IMAP polling. This allows emails sent to `crm@hostado.net` (or your configured email) to appear in the CRM inbox automatically.

## Prerequisites

1. Install required packages:
```bash
npm install imap mailparser @types/imap @types/mailparser
```

2. Ensure your email provider supports IMAP access (most providers do, including Gmail, Outlook, etc.)

## Configuration

Add the following environment variables to your `.env.local` file:

```env
# IMAP Configuration for receiving emails
IMAP_HOST=imap.gmail.com                    # IMAP server hostname
IMAP_PORT=993                               # IMAP port (usually 993 for SSL, 143 for non-SSL)
IMAP_USER=crm@hostado.net                   # Email address to check
IMAP_PASSWORD=your_app_password             # Email password or app-specific password
IMAP_TLS=true                               # Use TLS/SSL (true for port 993, false for 143)
IMAP_REJECT_UNAUTHORIZED=false              # Set to false if using self-signed certificates
```

### Gmail Setup

If using Gmail, you'll need to:

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password:
   - Go to Google Account > Security > 2-Step Verification
   - Scroll down to "App passwords"
   - Generate a new app password for "Mail"
   - Use this app password as `IMAP_PASSWORD`

### Example Configuration

For Gmail:
```env
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=crm@hostado.net
IMAP_PASSWORD=xxxx xxxx xxxx xxxx
IMAP_TLS=true
IMAP_REJECT_UNAUTHORIZED=true
```

For Outlook/Office 365:
```env
IMAP_HOST=outlook.office365.com
IMAP_PORT=993
IMAP_USER=crm@hostado.net
IMAP_PASSWORD=your_password
IMAP_TLS=true
IMAP_REJECT_UNAUTHORIZED=true
```

## Setting Up Automatic Email Checking

### Option 1: Cron Job (Recommended for Production)

Set up a cron job to call the API endpoint every minute (or as frequently as needed):

```bash
# Add to your crontab (crontab -e)
*/1 * * * * curl -X GET "https://your-domain.com/api/cron/check-emails" -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Or use a service like:
- **Vercel Cron Jobs**: Add to `vercel.json`
- **GitHub Actions**: Set up a scheduled workflow
- **External cron service**: Use services like cron-job.org, EasyCron, etc.

### Option 2: Manual Testing

You can manually trigger email checking by calling:

```bash
curl -X GET "http://localhost:3000/api/cron/check-emails" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Make sure `CRON_SECRET` is set in your `.env.local`:

```env
CRON_SECRET=your-secret-key-here
```

## How It Works

1. The cron job calls `/api/cron/check-emails` every minute (or your configured interval)
2. The service connects to the IMAP server using your credentials
3. It searches for unread emails in the INBOX
4. For each unread email:
   - Parses the email content (HTML and text)
   - Creates an inbound email record in the CRM
   - Automatically creates or links to a client based on the sender's email
   - Marks the email as read in the IMAP mailbox
5. New emails appear in the CRM's inbox automatically

## Troubleshooting

### Emails Not Appearing

1. **Check IMAP credentials**: Verify your email and password are correct
2. **Check IMAP access**: Ensure IMAP is enabled for your email account
3. **Check cron job**: Verify the cron job is running and calling the endpoint
4. **Check logs**: Look at server logs for IMAP connection errors
5. **Test manually**: Try calling the API endpoint manually to see error messages

### Common Errors

- **"IMAP configuration missing"**: Add all required IMAP environment variables
- **"Authentication failed"**: Check your email and password (use app password for Gmail)
- **"Connection timeout"**: Verify IMAP_HOST and IMAP_PORT are correct
- **"TLS/SSL error"**: Try setting `IMAP_REJECT_UNAUTHORIZED=false`

## Security Notes

- Never commit `.env.local` to version control
- Use app-specific passwords when possible (especially for Gmail)
- Keep your `CRON_SECRET` secure and use a strong random value
- Consider using environment-specific secrets in production
















