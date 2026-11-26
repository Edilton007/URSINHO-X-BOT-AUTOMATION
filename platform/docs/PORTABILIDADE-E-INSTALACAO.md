# Instalação portátil e operação segura

A pasta `platform/` é a aplicação Node.js. Wispbyte é apenas um destino de instalação; o mesmo commit pode correr num PaaS, VPS, servidor dedicado ou servidor próprio.

## Regras invariáveis
- Node.js 20+ e npm.
- Uma única instância enquanto as bases JSON forem single-writer. Não iniciar réplicas paralelas.
- Armazenamento persistente para bases operacionais e sessão WhatsApp/Baileys.
- Usar `PORT` fornecida pelo host (fallback `API_PORT`); a API faz bind em `0.0.0.0` por omissão.
- O ficheiro `.env` nunca entra no Git, Docker image ou pacote público.
- Manter `AUTOMATION_ALLOW_EXECUTION=false` durante instalação e validação. Mesmo quando autorizado, `AUTOMATION_ALLOWED_DESTINATIONS` precisa de uma lista explícita; ausente/vazia bloqueia tudo.

## Instalação nativa
Na pasta `platform/`:

```bash
npm ci
npm run preflight
npm run doctor
npm start
```

Configurar a pasta de trabalho do host como `platform/` e o comando como `npm start`. Apontar os dados para um volume persistente:

```dotenv
BOT_DB_FILE=/data/database/db.json
AUTOMATION_DB_FILE=/data/automation/automation.json
SALES_DB_FILE=/data/database/sales.json
BAILEYS_SESSION_DIR=/data/sessions
OFFSITE_BACKUP_SESSION_DIR=/data/sessions/principal
AUTOMATION_ALLOW_EXECUTION=false
AUTOMATION_ALLOWED_DESTINATIONS=
```

## Docker Compose opcional
Docker é uma opção, não requisito. O repositório inclui `Dockerfile` e `compose.yaml`. Criar `.env` privado a partir de `.env.example`, verificar permissões de volumes e executar:

```bash
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100
```

Os volumes nomeados guardam bases e sessão. O container corre como utilizador não-root. A porta fica em `127.0.0.1` por omissão, para uso atrás de proxy HTTPS. Alterar `BIND_ADDRESS` apenas quando a topologia exigir exposição directa.

## Backup, actualização e migração
1. Parar o processo antigo para evitar duas instâncias a escrever.
2. Criar cópia segura de `.env`, bases indicadas por `*_DB_FILE`, `BAILEYS_SESSION_DIR` e backups existentes.
3. Confirmar os ficheiros e guardar uma cópia fora do servidor de origem.
4. Instalar o mesmo commit no destino e repor os dados nos caminhos configurados.
5. Executar `npm ci`, `npm run preflight`, `npm run doctor`; iniciar uma única instância.
6. Validar health, Tenant, Master, autenticação, licenças, tarefas, telemetria e WhatsApp.
7. Só retirar o servidor antigo depois de confirmar a integridade no destino e guardar rollback.

`npm run backup:portable` gera uma pasta datada com manifesto SHA-256, incluindo `.env` quando existe, bases conhecidas e sessão Baileys. O backup pode conter segredos: mantenha-o privado e cifrado. Faça a cópia com o serviço parado ou numa janela controlada. A restauração é intencionalmente manual: validar o manifesto, repor os dados com o serviço parado e só depois executar preflight. Cloudflare KV é opcional e não substitui uma cópia independente testada.

## Wispbyte
Usar o repositório principal, working directory `platform/`, Node 20+, `npm ci`, `npm start` e armazenamento persistente. Respeitar a porta atribuída pelo host e manter uma única instância. Fazer backup de `.env`, bases e sessões antes de actualizar. Não apagar dados nem trocar a versão actual em produção nesta etapa de preparação.

## Limites de validação
O armazenamento JSON continua single-writer; alta disponibilidade horizontal exigiria futura migração para uma base transaccional partilhada. Persistência e backup do fornecedor, Docker, proxy HTTPS, migração/restore real exigem validação no ambiente de destino. Testes automatizados não simulam USSD real nem comprovam transferências Vodacom.
