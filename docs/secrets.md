# Gestao de Segredos

Este projeto usa arquivos `.env*` apenas para desenvolvimento local. Os exemplos versionados indicam todos os campos obrigatorios e permanecem livres de segredos reais.

## Ambientes
- **Raiz (`.env`)**: credenciais de infraestrutura compartilhada pelo Docker Compose (Postgres etc.).
- **Backend (`apps/backend/.env`)**: configuracoes da API (nome do servico, nivel de log, URL do banco).
- **Frontend (`apps/frontend/.env.local`)**: chaves publicas ou IDs de integracoes (pixels).

No Docker Compose, os valores da raiz sao carregados automaticamente. O backend usa `dotenv` no bootstrap (`src/index.ts`) e sempre deve funcionar com `APP_NAME`, `LOG_LEVEL` e `DATABASE_URL` definidos.

## Recomendacoes
1. **Nao versionar** arquivos `.env` locais (ja estao ignorados em `.gitignore`).
2. **Producao**: utilizar um cofre (ex.: 1Password, AWS Secrets Manager ou Doppler) e injetar as variaveis via pipeline/infra (GitHub Actions usa `secrets.*`).
3. **Rotacao**: centralizar a troca de credenciais no cofre e atualizar os servicos que consomem `DATABASE_URL`, integracoes de pixels ou chaves OAuth.
4. **Auditoria**: manter um inventario de variaveis por ambiente; use este documento como base inicial e evolua com mudancas de arquitetura.

## Variaveis atuais

| Variavel | Local | Descricao |
|----------|-------|-----------|
| `APP_NAME` | Backend | Identifica o servico nos logs estruturados. |
| `LOG_LEVEL` | Backend | Controla a verbosidade do `pino` (`debug`, `info`, `warn`, `error`). |
| `DATABASE_URL` | Backend | Conexao Prisma/Postgres. |
| `PORT` | Backend | Porta HTTP da API. |
| `GA4_MEASUREMENT_ID` / `META_PIXEL_ID` / `TIKTOK_PIXEL_ID` | Raiz/Backend | IDs dos pixels para renderizacao e tracking do frontend. |
| `JWT_SECRET` | Backend/Raiz | Segredo HMAC para assinar os tokens JWT. |
| `JWT_ACCESS_MINUTES` | Backend | Duracao (min) do token de acesso. |
| `JWT_REFRESH_DAYS` | Backend | Duracao (dias) do refresh token. |
| `MAGIC_LINK_MINUTES` | Backend | Tempo de validade dos links magicos. |
| `INVITE_DAYS` | Backend | Expiracao (dias) dos convites. |
| `GOOGLE_CLIENT_ID` | Backend | Client ID usado para validar tokens Google. |
| `NEXT_PUBLIC_*` (pixels) | Frontend | Versoes publicas das mesmas chaves para injecao no Next.js. |

A lista deve ser revisada sempre que novos modulos exigirem credenciais (ex.: OAuth, provedores de pagamento). Atualize os arquivos `.env.example` correspondentes ao adicionar variaveis.
