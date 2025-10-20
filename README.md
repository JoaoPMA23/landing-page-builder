# Landing Builder Starter (Next.js + Express + Prisma + Postgres)

Monorepo simples com **frontend (Next 14 App Router)** e **backend (Express + Prisma)**, prontos para Docker Compose.

## Stack
- Frontend: Next.js 14 (TypeScript) + Tailwind + dnd-kit + TipTap (placeholder)
- Backend: Node.js (Express) + Prisma (PostgreSQL)
- DB: PostgreSQL (Docker)
- Infra Dev: Docker Compose, hot reload
- Código organizado em `apps/frontend` e `apps/backend`

## Como rodar (Docker)
1. Copie os envs:
   ```bash
   cp .env.example .env
   cp apps/backend/.env.example apps/backend/.env
   cp apps/frontend/.env.local.example apps/frontend/.env.local
   ```
2. Suba tudo:
   ```bash
   docker compose up --build
   ```
3. Aplicar migrações Prisma:
   ```bash
   docker compose exec backend npx prisma migrate dev --name init
   ```
4. Acesse:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:4000/health
   - Prisma Studio (opcional): `docker compose exec backend npx prisma studio`

## Sem Docker (local nativo)
- Requisitos: Node 18+, pnpm ou npm, Postgres local
- No backend: `npm i && npx prisma migrate dev && npm run dev`
- No frontend: `npm i && npm run dev`

## Pastas
- `apps/frontend`: Next.js App Router. Inclui um esqueleto de Editor e um `BlockRenderer` simples.
- `apps/backend`: Express + Prisma + rotas básicas (`/sites`, `/pages`, `/leads`, `/health`).

## Próximos passos
- Autenticação (JWT + OAuth).
- Upload de imagens (S3).
- ISR/Cache na publicação (gerar HTML estático por página).
- Domínios customizados + SSL (Cloudflare/ACME).
- Webhooks e integrações (RD Station, HubSpot, etc.).
