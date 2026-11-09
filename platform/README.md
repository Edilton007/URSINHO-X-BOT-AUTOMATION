# URSINHO X BOT AUTOMATION — Plataforma Node.js

Este diretório contém o processo central Node.js: WhatsApp Bot V2, API Express, autenticação, base JSON, automação telecom, Tenant/Master APIs, storefront, alertas e backup opcional.

## Requisitos

- Node.js 20 ou superior (Node 24 também é suportado).
- Volume persistente para os diretórios reais de base (por padrão `src/database/`, `src/automation/database/`) e `sessions/`.
- Uma instância apenas: o armazenamento operacional é JSON single-writer.
- HTTPS público no alojamento.

## Instalar e testar

```bash
npm ci
npm test
npm run check
npm run verify:release
npm run preflight
npm run doctor
```

Depois de preencher o `.env` e confirmar os testes, iniciar com `npm start`. Em alojamento gerido, respeitar o `PORT` atribuído pelo painel; `API_PORT` é fallback. A API faz bind em `0.0.0.0`.

## Rotas principais

- `/automation/health` — health check básico.
- `/tenant/` — Tenant Panel.
- `/tenant/loja.html` — gestão da loja do tenant.
- `/master/` — consola Master/Admin.
- `/loja/:slug` — loja pública.
- `/site/` — website institucional público; contacto de WhatsApp é opcional via `PUBLIC_CONTACT_NUMBER`.
- `/painel/` — dashboard privado do Bot V2 (pede `API_KEY` na própria interface).
- `/automation/tenants/:tenantId/saude` — saúde autenticada do tenant.
- `/admin/tenants/:tenantId/auditoria` — auditoria autenticada por Admin.

## Variáveis essenciais

Copie `.env.example` para `.env`, configure `OWNER`, `API_KEY`, `ADMIN_API_KEY`, `PAIRING_NUMBER` quando necessário e caminhos persistentes das bases. Use chaves fortes, diferentes entre si. Deixe `AUTOMATION_ALLOW_EXECUTION=false`. Nunca copie `.env` para repositórios ou partilhe os valores.

## Backup Cloudflare KV

O backup é opcional e permanece desativado sem todos os valores Cloudflare + chave AES. Workers KV guarda snapshots cifrados, não dados operacionais. Consulte `../docs/CONFIGURACAO-E-API.md`.

- `npm run backup:now` — snapshot manual.
- `npm run backup:list` — listar snapshots disponíveis.
- `npm run restore:stage -- <SNAPSHOT_ID>` — descarregar e validar em staging, sem substituir produção.

## Segurança e operação

- Tenant e Agent têm chaves separadas; são armazenadas como hash.
- Admin usa `ADMIN_API_KEY` separada.
- Claim tokens internos não são devolvidos ao Tenant Panel.
- Saúde do Agent considera offline após 120 segundos; cada SIM é avaliado individualmente.
- Alertas usam o JID privado do proprietário (`OWNER_NUMBER` ou `OWNER`), nunca grupos.
- Execução telecom continua desligada até validação do servidor, Android, SIM, evidências e autorização da operadora.
