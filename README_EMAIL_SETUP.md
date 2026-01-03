# Email Integration Setup

## Installation

Install the required dependencies:

```bash
npm install nodemailer @types/nodemailer
```

For rich text editing (optional, currently using HTML textarea):
```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder
```

## Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME="Your Name"

# Optional: For cron job authentication
CRON_SECRET=your-secret-token
```

### Gmail Setup

1. Enable 2-Step Verification on your Google account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
   - Use this password as `SMTP_PASSWORD`

### Other SMTP Providers

The configuration works with any SMTP provider:
- **SendGrid**: Use `smtp.sendgrid.net` as host
- **Mailgun**: Use `smtp.mailgun.org` as host
- **Custom SMTP**: Use your provider's SMTP settings

## Database Setup

The email tables should already be created if you ran `supabase/SETUP_EMAILS.sql`. If not, run:

```sql
-- Run this in Supabase SQL Editor
-- See supabase/SETUP_EMAILS.sql for full schema
```

## Cron Job Setup

To enable scheduled email sending, set up a cron job to call:

```
GET https://your-domain.com/api/cron/process-emails
Authorization: Bearer YOUR_CRON_SECRET
```

### Using cron-job.org

1. Create an account at https://cron-job.org
2. Create a new cron job:
   - URL: `https://your-domain.com/api/cron/process-emails`
   - Schedule: Every 5 minutes (or as needed)
   - Method: GET
   - Headers: `Authorization: Bearer YOUR_CRON_SECRET`

### Using Vercel Cron

If deploying on Vercel, add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/process-emails",
    "schedule": "*/5 * * * *"
  }]
}
```

## Features

### 1. Email Composer
- Access at `/emails/compose`
- Rich HTML editor (currently textarea, can be upgraded to TipTap)
- Client selection with auto-fill
- Template support
- Signature support
- CC/BCC support
- Schedule for later

### 2. Email Signatures
- Access at `/emails/signatures`
- Create multiple signatures
- Set default signature
- HTML content support

### 3. Email Templates
- Access at `/emails/templates`
- Template variables: `{{client_name}}`, `{{client_email}}`, `{{client_company}}`
- Categories: follow_up, offer, welcome, custom
- Share templates with team

### 4. Email History
- Access at `/emails`
- View all emails (drafts, sent, scheduled, failed)
- Filter by status
- View email details

### 5. Client Integration
- Emails appear in client timeline
- Link to email details from interactions
- Quick compose from client page

## Usage

### Sending an Email

1. Go to `/emails/compose` or click "Send Email" from a client page
2. Select a client (auto-fills recipient)
3. Choose a template (optional)
4. Compose your email
5. Add signature (default is auto-added)
6. Click "Send" or "Schedule"

### Creating a Signature

1. Go to `/emails/signatures`
2. Click "New Signature"
3. Enter name and HTML content
4. Set as default (optional)
5. Save

### Creating a Template

1. Go to `/emails/templates`
2. Click "New Template"
3. Enter name, subject, and body
4. Use variables like `{{client_name}}` in subject/body
5. Save

## Troubleshooting

### Emails not sending

1. Check SMTP configuration in `.env.local`
2. Verify SMTP credentials are correct
3. Check email provider logs
4. Check application logs for errors

### Scheduled emails not sending

1. Verify cron job is set up correctly
2. Check `CRON_SECRET` matches in cron job and `.env.local`
3. Check cron job logs
4. Verify emails have `status = 'scheduled'` and `scheduled_at <= NOW()`

### Signature not appearing

1. Check if signature is set as default
2. Verify signature HTML is valid
3. Check email body includes signature HTML

## API Endpoints

### Process Scheduled Emails
```
GET /api/cron/process-emails
Authorization: Bearer CRON_SECRET
```

Returns:
```json
{
  "message": "Processed scheduled emails",
  "processed": 5,
  "success": 4,
  "failed": 1
}
```




























