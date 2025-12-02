This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Authentication
AUTH_SECRET=your-auth-secret-here

# Internal API Key (for cron jobs)
INTERNAL_API_KEY=your-secret-api-key-here

# API Base URL (for cron jobs, defaults to http://localhost:3000)
API_BASE_URL=http://localhost:3000

# OpenAI API Key (for AI agents)
OPENAI_API_KEY=your-openai-api-key
```

## Background Jobs

The app includes a background job scheduler for automated reward calculation and outcome tracking. See [CRON.md](./CRON.md) for setup instructions.

**Quick start:**
```bash
# Run cron scheduler
npm run cron
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

For background jobs on Vercel, see [CRON.md](./CRON.md) for Vercel Cron configuration.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
