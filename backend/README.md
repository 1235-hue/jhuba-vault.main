# JHUB Africa Vault API

Express + TypeScript + Prisma + PostgreSQL backend for the existing Angular application.

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`, and `PORT`.
2. Start PostgreSQL locally, or run `docker compose up --build` from the
   repository root to start PostgreSQL and the API together. The API container
   applies pending migrations before it starts.
3. Run `npm install` inside `backend/`.
4. Run `npx prisma generate`.
5. Run `npx prisma migrate deploy` for the existing migration history.
6. Run `npm run seed`.
7. Run `npm run dev`.

The API runs at `http://localhost:3000/api`. Development seed credentials are documented here only: `admin@jhubafrica.example` / `ChangeMe123!` and `innovator@jhubafrica.example` / `ChangeMe123!`. Change them before any real deployment.

Administrators can create a request on behalf of an innovator with `POST /api/admin/requests`. The endpoint accepts the normal request fields plus `innovatorId`, verifies that the user is an innovator and requested quantities are available, creates the request as pending, and records the action in the audit log.

Do not run `prisma migrate reset`, delete applied migrations, or regenerate the baseline. For a deliberate schema change, create an additive migration, review it, apply it with `prisma migrate deploy`, and verify with `prisma migrate status`.

## Validation

```powershell
npm test
npm run build
npx prisma validate
npx prisma generate
npx prisma migrate status
```

Cloudinary and mail integrations are environment-driven. The API never returns password hashes or secrets.
