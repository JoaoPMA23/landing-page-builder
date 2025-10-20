# Gestão de Segredos

Este projeto usa arquivos `.env*` apenas para desenvolvimento local. Os exemplos versionados indicam todos os campos obrigatórios e permanecem livres de segredos reais.

## Ambientes
- **Raiz (`.env`)**: credenciais de infraestrutura compartilhada pelo Docker Compose (Postgres etc.).
- **Backend (`apps/backend/.env`)**: configurações da API (nome do serviço, nível de log, URL do banco).
- **Frontend (`apps/frontend/.env.local`)**: chaves públicas ou IDs de integrações (pixels).

No Docker Compose, os valores da raiz são carregados automaticamente. O backend usa `dotenv` no bootstrap (`src/index.ts`) e sempre deve funcionar com `APP_NAME`, `LOG_LEVEL` e `DATABASE_URL` definidos.

## Recomendações
1. **Não versionar** arquivos `.env` locais (já estão ignorados em `.gitignore`).
2. **Produção**: utilizar um cofre (ex.: 1Password, AWS Secrets Manager ou Doppler) e injetar as variáveis via pipeline/infra (GitHub Actions usa `secrets.*`).
3. **Rotação**: centralizar a troca de credenciais no cofre e atualizar os serviços que consomem `DATABASE_URL`, integrações de pixels ou chaves OAuth.
4. **Auditoria**: manter um inventário de variáveis por ambiente; use este documento como base inicial e evolua com mudanças de arquitetura.

## Variáveis atuais

| Variável | Local | Descrição |
|----------|-------|-----------|
| `APP_NAME` | Backend | Identifica o serviço nos logs estruturados. |
| `LOG_LEVEL` | Backend | Controla a verbosidade do `pino` (`debug`, `info`, `warn`, `error`). |
| `DATABASE_URL` | Backend | Conexão Prisma/Postgres. |
| `PORT` | Backend | Porta HTTP da API. |
| `GA4_MEASUREMENT_ID` / `META_PIXEL_ID` / `TIKTOK_PIXEL_ID` | Raiz/Backend | IDs dos pixels para renderização e tracking do frontend. |
| `NEXT_PUBLIC_*` (pixels) | Frontend | Versões públicas das mesmas chaves para injeção no Next.js. |

A lista deve ser revisada sempre que novos módulos exigirem credenciais (ex.: OAuth, provedores de pagamento). Atualize os arquivos `.env.example` correspondentes ao adicionar variáveis.
