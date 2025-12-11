# Pre-Sales CRM

A simple, intuitive pre-sales CRM platform built with Next.js, TypeScript, Supabase, and shadcn/ui.

## Features

- **Client Management**: Track potential clients with contact information, status, and source
- **Interactions**: Log calls, emails, meetings, and other interactions with clients
- **Notes**: Add and pin notes for each client
- **Reminders**: Set follow-up reminders for tasks and calls
- **Dashboard**: Overview of upcoming reminders and recent clients
- **Authentication**: Secure authentication with Supabase Auth

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Database & Auth**: Supabase
- **UI**: shadcn/ui + Tailwind CSS
- **State Management**: React state + Server Actions

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A Supabase account and project

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

2. Set up your Supabase project:

   - Create a new project at [supabase.com](https://supabase.com)
   - Go to Project Settings > API to get your URL and anon key

3. Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Set up the database schema:

   - Open the Supabase SQL Editor
   - Copy and paste the contents of `supabase/schema.sql`
   - Run the SQL script to create all tables, enums, RLS policies, and indexes

5. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### First User

1. Go to the Supabase Dashboard > Authentication > Users
2. Create a new user manually, or enable email signup in Authentication > Settings
3. Sign in with your credentials at `/login`

## Project Structure

```
├── app/
│   ├── actions/          # Server actions for CRUD operations
│   ├── clients/          # Client pages (list, new, detail)
│   ├── dashboard/        # Dashboard page
│   ├── login/            # Login page
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── components/
│   ├── clients/          # Client-specific components
│   ├── layout/           # Layout components (sidebar, topbar)
│   └── ui/               # shadcn/ui components
├── lib/
│   ├── supabase/         # Supabase client helpers
│   └── utils.ts          # Utility functions
├── types/
│   └── database.ts       # TypeScript types for database
└── supabase/
    └── schema.sql        # Database schema
```

## Database Schema

The application uses the following main tables:

- **clients**: Client/lead information
- **interactions**: Logged calls, emails, meetings
- **reminders**: Follow-up reminders
- **client_notes**: Notes for each client

All tables are protected with Row Level Security (RLS) to ensure users can only access their own data.

## Key Features

### Pre-Sales Workflows

1. **Cold Call Workflow**:
   - Open a client, add an interaction of type "call" with direction "outbound"
   - Log the result in notes
   - Quickly add a reminder for follow-up

2. **Follow-up Reminder Workflow**:
   - View reminders on the dashboard
   - Click a reminder to go directly to the client
   - Log an interaction and mark the reminder as done

3. **Quick Add**:
   - Add a new client from the clients page
   - Optionally add the first interaction immediately

## Development

### Adding New Components

The project uses shadcn/ui components. To add new components:

```bash
npx shadcn-ui@latest add [component-name]
```

### Type Safety

All database types are defined in `types/database.ts`. Server actions use these types for type safety.

### Server Actions

All data mutations use Next.js Server Actions located in `app/actions/`. These ensure:
- Server-side data validation
- Automatic revalidation of cached data
- Type-safe database operations

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon/public key

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add your environment variables
4. Deploy

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Ensure environment variables are set
- Run `npm run build` to verify the build works
- The app uses server-side rendering and server actions

## License

MIT



