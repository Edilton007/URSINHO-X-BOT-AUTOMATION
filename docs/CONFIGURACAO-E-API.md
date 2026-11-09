# Configuração e API

## Variáveis principais

Copiar `platform/.env.example` para `platform/.env`. Não colocar valores reais neste repositório.

| Variável | Uso |
|---|---|
| `OWNER` | Número do proprietário, apenas dígitos com código do país. |
| `API_KEY` | Chave da API/painel Bot V2. |
| `ADMIN_API_KEY` | Chave exclusiva da consola Master/Admin. |
| `PORT` / `API_PORT` | Porta HTTP atribuída pelo host / fallback local. |
| `PAIRING_NUMBER` | Número WhatsApp para pairing inicial, quando usado. |
| `AUTOMATION_ALLOW_EXECUTION` | Deixar `false` até validar HTTPS, Agent, SIM e evidências. |
| `DEVICE_OFFLINE_AFTER_SEC` | Heartbeat do Agent; padrão 120 s (limites seguros 30–600 s). |
| `SIM_TELEMETRY_STALE_MIN` | Telemetria individual do SIM; padrão 45 min (5–1440 min). |
| `OWNER_NUMBER` | Número privado que recebe alertas WhatsApp; se vazio, usa `OWNER`. |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_KV_NAMESPACE_ID` | Acesso ao namespace Workers KV usado somente para backup. |
| `CLOUDFLARE_API_TOKEN` | Token Cloudflare restrito a Workers KV Storage Read e Write. Nunca publicar ou enviar. |
| `OFFSITE_BACKUP_ENCRYPTION_KEY_BASE64` | Chave AES-256-GCM Base64 de 32 bytes; guardar fora do servidor. |
| `OFFSITE_BACKUP_INTERVAL_MIN` | Intervalo de backup (padrão 60 min; mínimo 15 min). |
| `OFFSITE_BACKUP_RETENTION_DAYS` | Retenção automática no KV (padrão 7 dias; 7–90 dias). |
| `OFFSITE_BACKUP_CHUNK_BYTES` | Tamanho por bloco KV (padrão 8 MiB; permitido 1–20 MiB). |
| `AUTOMATION_DB_FILE` | Caminho da base de automação. Deve apontar para volume persistente. |
| `AUTOMATION_ORDERS_FILE` | Histórico de acompanhamento das compras Bot→Backend. |
| `SALES_DB_FILE` | Base de vendas do Bot V2. |
| `BOT_DB_FILE` | Base principal do Bot V2. |
| `ALLOWED_ORIGINS` | Origens web permitidas quando painel externo exigir CORS. Separar por vírgula. |
| `AUTOMATION_GROUPS_JSON` | Mapeia grupo WhatsApp para tenant, incluindo a chave do tenant usada pela ponte interna. |

Gere chaves fortes separadas. Uma forma em Node.js: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Execute duas vezes, uma para `API_KEY` e outra para `ADMIN_API_KEY`.

## `AUTOMATION_GROUPS_JSON`

Formato:

```json
{
  "1203XXXXXXXXXXXX@g.us": {
    "tenantId": "TEN-...",
    "apiKey": "CHAVE_TENANT"
  }
}
```

É opcional; deixe `{}` até mapear um grupo, tenant e chave corretos. A ponte `automationBridgeService` é chamada a partir do fluxo de compra aprovado por administrador no Bot. Um comprovativo OCR sozinho não executa transferência.

## Endpoints do Backend

| Método | Caminho | Auth | Função |
|---|---|---|---|
| GET | `/automation/health` | Pública, sem dados sensíveis | Saúde básica do módulo. |
| GET | `/automation/tenants/:tenantId` | Tenant key | Resumo do tenant. |
| GET | `/automation/tenants/:tenantId/licenca` | Tenant key | Licença vinculada. |
| GET | `/automation/tenants/:tenantId/device` | Tenant key | Device, campos públicos apenas. |
| GET | `/automation/tenants/:tenantId/operacoes` | Tenant key | Operações do tenant. |
| GET | `/automation/tenants/:tenantId/sims` | Tenant key | Telemetria conhecida. |
| POST | `/automation/tenants/:tenantId/transferir` | Tenant key | Cria pedido de transferência; exige licença/device; execução pode ficar `PENDENTE`. |
| GET | `/automation/device/:deviceId/tarefas` | Device key | Consulta tarefas elegíveis. |
| POST | `/automation/device/:deviceId/tarefas/:taskId/iniciar` | Device key | Claim único/lease. |
| POST | `/automation/device/:deviceId/tarefas/:taskId/resultado` | Device key | Envia evidências da execução. |
| POST | `/automation/device/:deviceId/sim-status` | Device key | Envia telemetria SIM. |
| POST/GET/PATCH | `/automation/tenants/:tenantId/storefront`, `/products`, `/store-orders` | Tenant key | Configura loja, produtos e pedidos. |
| GET | `/api/storefront/:slug` | Pública | Catálogo publicado. |
| POST | `/api/storefront/:slug/orders` | Pública + limite rudimentar por IP e idempotency key | Regista pedido pendente. |
| GET/POST/PATCH | `/admin/*` | Admin key + rate limiter | Provisionamento, visão global, revisão e bloqueios. |

Cabeçalho Tenant/Agent: `x-api-key`. Cabeçalho Admin: `x-admin-key`. Não enviar esses segredos na query string.


## Saúde do Agent e SIMs

- `GET /automation/tenants/:tenantId/saude` (Tenant API key) devolve estado do Agent, telemetria individual dos SIMs, filas e estado do bloqueio de execução.
- Agent é considerado online quando o heartbeat foi recebido nos últimos 120 segundos. Timestamps inválidos ou mais de 120 segundos no futuro não são aceites como saudáveis.
- Cada SIM tem janela própria de telemetria, padrão 45 minutos. A saúde do SIM não é inferida a partir de outro SIM do mesmo aparelho.
- `GET /admin/tenants/:tenantId/auditoria` (Admin API key) devolve até 200 eventos recentes desse tenant.
- Alertas vão apenas por mensagem privada ao proprietário central (`OWNER_NUMBER`, ou `OWNER` como fallback). Não são enviados a grupos de clientes.
- Monitorização não autoriza operações. `AUTOMATION_ALLOW_EXECUTION=false` bloqueia a execução mesmo com o Agent online.

## Backup externo Cloudflare KV

O KV é usado somente para cópias de recuperação, nunca como base operacional. O backup compacta e cifra o conjunto com AES-256-GCM, emite blocos de até 8 MiB por padrão e grava o manifesto por último. Cada bloco/manifesto é lido novamente e verificado. A retenção padrão é 7 dias e o snapshot falha se as fontes excederem 20 MiB no total, para proteger a memória do servidor pequeno.

O serviço cobre `BOT_DB_FILE`, `AUTOMATION_DB_FILE`, `AUTOMATION_ORDERS_FILE`, `SALES_DB_FILE` e `sessions/principal`. Não inclui `.env`, `node_modules`, downloads nem temporários. Se a sessão não existir no momento do snapshot, o relatório marca a ausência; não considere esse snapshot uma recuperação integral do WhatsApp.

Com o `.env` configurado e somente após testar o servidor: `npm run backup:now` cria cópia manual, `npm run backup:list` lista manifests, `npm run restore:stage -- <SNAPSHOT_ID>` desencripta e valida numa pasta temporária. A restauração nunca substitui ficheiros de produção. A aplicação manual da recuperação deve ser feita com o processo parado e depois de guardar uma segunda cópia local.

O token necessita de permissões Workers KV Storage Read e Workers KV Storage Write no namespace escolhido. Não conceder acesso global/administrativo à conta. Na quota Free, o namespace tem 1 GB: com backups horários e retenção de 7 dias (168 snapshots), monitore o tamanho médio cifrado e reduza a frequência se a projeção de armazenamento se aproximar do limite. A API repete a verificação de novas chaves por até cerca de 116 segundos para lidar com propagação. Workers KV possui consistência eventual e limites próprios; por isso não serve para estado transacional, locks, inventário ou operações telecom.
