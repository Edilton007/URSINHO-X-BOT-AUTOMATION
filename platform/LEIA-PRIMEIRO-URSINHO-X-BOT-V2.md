# URSINHO X BOT AUTOMATION v1.1.2 — LEIA PRIMEIRO

Este pacote é um **candidato de validação controlada**. Ele integra o Bot WhatsApp V2, Backend Telecom, Tenant Panel, Master/Admin, Loja Pública, Android Agent, Tenant App, monitorização e backup Cloudflare opcional.

## Estado de segurança

- `AUTOMATION_ALLOW_EXECUTION=false` permanece obrigatório.
- Não contém `.env` com credenciais, sessão Baileys, bases JSON de produção, `node_modules` nem APK pronto.
- Não substitua o que já está no Wispbyte antes de guardar código, `.env`, `sessions/`, bases e logs atuais.
- Preserve os caminhos existentes de bases. Os defaults desta versão seguem o layout histórico em `src/database/` e `src/automation/database/`.
- Não apague nem recrie `sessions/principal`; é a autenticação do WhatsApp.

## Arranque

- Diretório de execução: conteúdo da pasta `platform/` deste pacote.
- Requisitos: Node.js 20+ e npm.
- Ponto de entrada: `src/index.js`.
- Comando recomendado: `npm start`.
- O servidor usa `PORT` do host, depois `API_PORT`, e faz bind em `0.0.0.0`.
- Health básico: `/automation/health` (HTTPS público).

## Verificação local/host

Na raiz `platform/`, execute `npm ci` e `npm run preflight`. O candidato preparado passou 18 testes automatizados e 242 verificações sintáticas JavaScript. Isso não substitui teste HTTP integrado, teste de Cloudflare real, WhatsApp real, build de APK ou teste SIM/USSD.

## Bases e sessão preservadas

Defaults históricos do `.env.example`:

- `src/database/db.json` (Bot);
- `src/database/sales.json` (vendas);
- `src/database/automationOrders.json` (ponte Bot→Backend);
- `src/automation/database/automation.json` (tenants, licenças, dispositivos, SIMs e operações);
- `sessions/principal/` (WhatsApp Baileys).

Se o `.env` atual apontar para outros caminhos, preserve esses valores e confirme onde estão os dados reais antes de iniciar.

## O que foi acrescentado

- Agent offline após 120 s de heartbeat ausente.
- Telemetria de SIM analisada individualmente, padrão de 45 min.
- Alertas ao proprietário por conversa privada; nunca nos grupos dos clientes.
- Endpoints de saúde e auditoria acrescentados sem remover as rotas anteriores.
- Backup AES-256-GCM em KV, com verificação de chunks, retenção, listagem e restauração para staging.
- Dashboard Bot V2 com login de sessão; nenhuma chave API embutida no frontend.

Leia `../docs/PLANO-DE-EXECUCAO-E-IMPLANTACAO-v1.1.2.md` antes de qualquer deploy.
