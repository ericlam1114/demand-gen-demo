# Nexum Collections - Demand Letter Automation MVP

A modern, deterministic platform for collections agencies to automate demand letter generation and tracking.

## Features

- 📤 **CSV Upload & Validation** - Drag-and-drop CSV upload with real-time validation
- 📧 **Automated Email Sending** - SendGrid integration with Handlebars templates  
- 📊 **Real-time Dashboard** - Live tracking of letter status and metrics
- 👁️ **Open Tracking** - Invisible pixel tracking for email opens
- 🔒 **Secure Database** - Supabase with Row Level Security (RLS)
- ⚡ **Real-time Updates** - WebSocket subscriptions for live data

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + React 19 + Tailwind CSS
- **Backend**: Next.js API Routes + Supabase Edge Functions
- **Database**: Supabase PostgreSQL with RLS
- **Email**: SendGrid API v3
- **UI Components**: Radix UI + Custom components
- **Authentication**: Supabase Auth (planned)

## Quick Start

### 1. Clone & Install
```bash
git clone <repo-url>
cd demand-gen-demo
npm install
```

### 2. Environment Setup
Copy `.env.local.example` to `.env.local` and configure:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Public Supabase Anon Key (safe for browser)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=collections@nexum.ai

# Application Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Database Setup
1. Create a new Supabase project
2. Run the SQL schema from `supabase/schema.sql` in your Supabase SQL editor
3. Enable Row Level Security on all tables

### 4. SendGrid Setup
1. Create a SendGrid account
2. Generate an API key with full send permissions
3. Set up domain authentication (recommended for production)

### 5. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to access the application.

## Project Structure

```
src/
├── app/                    # Next.js 15 App Router
│   ├── api/               # API routes
│   │   ├── process-csv/   # CSV processing & email sending
│   │   └── open/          # Tracking pixel endpoint
│   ├── dashboard/         # Dashboard page
│   ├── upload/           # CSV upload page
│   ├── layout.js         # Root layout with sidebar
│   └── page.js           # Home redirect
├── components/
│   ├── layout/           # Layout components
│   │   └── sidebar.js    # Navigation sidebar
│   └── ui/               # Reusable UI components
│       ├── button.js     # Button variants
│       └── toast.js      # Toast notifications
└── lib/
    ├── supabase.js       # Supabase client config
    └── utils.js          # Utility functions
```

## Database Schema

### Core Tables
- **agencies** - Multi-tenant support
- **debtors** - Debtor information from CSV uploads
- **templates** - HTML email templates with Handlebars
- **letters** - Individual letter records with status tracking
- **events** - Audit trail for all letter actions

### Status Flow
```
draft → sent → opened → paid
              ↓
         escalated
```

## CSV Format

Required columns:
- `name` - Debtor full name (min 2 chars)
- `email` - Valid email address
- `balance` - Outstanding balance (positive number)
- `state` - 2-letter state code (e.g., CA, NY)

Example CSV:
```csv
name,email,balance,state
John Smith,john@example.com,1250.00,CA
Jane Doe,jane@example.com,890.50,NY
```

## API Endpoints

### POST /api/process-csv
Processes uploaded CSV data:
- Validates and inserts debtors
- Generates letters from templates
- Sends emails via SendGrid
- Records events for tracking

### GET /api/open?id={letter_id}
Tracking pixel endpoint:
- Records email open events
- Updates letter status to "opened"
- Returns 1x1 transparent GIF

## Features by Milestone

### Day 1 ✅
- [x] Project setup with Next.js 15 + Tailwind
- [x] Database schema and Supabase integration
- [x] Basic UI components and layout

### Day 2 ✅
- [x] CSV upload with validation
- [x] Preview table with error highlighting
- [x] Step-by-step upload flow

### Day 3 🚧
- [x] SendGrid integration
- [x] Handlebars template compilation
- [x] Email tracking pixel implementation

### Day 4 🚧
- [x] Real-time dashboard with metrics
- [x] Letter status tracking
- [x] Search and filtering

### Day 5 📋
- [ ] End-to-end testing
- [ ] Production deployment
- [ ] Performance optimization

## Future Enhancements

### Phase 2 Features
- **SMS Channel** - Twilio integration for SMS letters
- **Physical Mail** - Lob API for printed letters  
- **Auto-escalation** - Scheduled follow-up letters
- **Multi-tenant Auth** - Full agency user management
- **Advanced Templates** - Template editor with preview

### Scalability
- Edge function optimization for high volume
- Database indexing and query optimization
- SendGrid sub-user management
- Rate limiting and queue management

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_ANON_KEY` | Public Supabase key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase key | ✅ |
| `SENDGRID_API_KEY` | SendGrid API key | ✅ |
| `FROM_EMAIL` | Sender email address | ✅ |
| `NEXT_PUBLIC_SITE_URL` | Application URL | ✅ |

## Deployment

### Vercel (Recommended)
1. Connect GitHub repository
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push

### Other Platforms
- Ensure Node.js 18+ runtime
- Set all environment variables
- Configure custom domains for email authentication

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

Private - Nexum Collections

---

**Contact**: Eric Lam - Product Lead/Dev
