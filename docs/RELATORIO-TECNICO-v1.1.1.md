# Relatório técnico — URSINHO X BOT AUTOMATION v1.1.1

**Data da preparação:** 6 de novembro de 2026  
**Base comparada:** `URSINHO-X-BOT-AUTOMATION-CANDIDATO-INTEGRADO-v1.0.0` enviado nesta conversa.  
**Natureza:** candidato de atualização local. Não foi instalado no Wispbyte.

## 1. Resumo da entrega

A versão 1.1.0 integra o bloco de saúde do dispositivo, alertas privados e backup externo cifrado, mantendo a base funcional e as regras de segurança do candidato v1.0.0. Também atualiza a apresentação do painel legado do Bot V2 e acrescenta instruções operacionais.

O pacote não contém `.env`, tokens, chaves privadas, sessão WhatsApp, bases reais de clientes nem `node_modules`.

## 2. Alterações funcionais

### Backend e segurança

- Mantida autenticação Tenant/Device por hash SHA-256, com comparação `crypto.timingSafeEqual()` e migração segura de credenciais antigas.
- Mantidas as validações de tenant, licença, dispositivo e estado de autorização.
- Mantida a geração criptograficamente segura de IDs e chaves.
- Mantida a filtragem de `claimToken`, `claimDeviceId` e `leaseExpiresAtMs` nas respostas públicas do Tenant.
- Mantidas as rotas anteriores de Tenant, Loja Pública e Master/Admin; foram acrescentadas as rotas de saúde e auditoria.
- `startApi()` passa a aguardar a abertura do servidor e rejeitar erros de bind. A API anuncia versão 2.1.1.
- Falhas não tratadas no processo provocam encerramento controlado para permitir reinício pelo supervisor, em vez de deixar o processo potencialmente inconsistente.

### Saúde e telemetria

- Janela de offline do Agent: 120 segundos por padrão, configurável entre 30 e 600 segundos.
- Timestamp ausente, inválido ou mais de 120 segundos no futuro não é considerado saudável.
- Telemetria de cada SIM é avaliada individualmente; padrão de 45 minutos, configurável entre 5 e 1440 minutos.
- Telemetria futura não é aceite como evidência de execução.
- Heartbeat atualiza a memória a cada contacto, com persistência do contacto no máximo uma vez por minuto por dispositivo; o primeiro contacto é guardado.
- A verificação de saúde não ativa transferências e respeita `AUTOMATION_ALLOW_EXECUTION=false`.

### Alertas privados

- Alertas de Agent offline/recuperado, SIM com telemetria antiga/recuperada, revisão parada há mais de 30 minutos e falha do backup.
- O destinatário é o proprietário central configurado por `OWNER_NUMBER` (ou `OWNER` como fallback).
- O destino é convertido para JID individual `@s.whatsapp.net`; o serviço não envia alertas para grupos.
- O estado de deduplicação é persistido em `db.system.healthAlertState`.

### Backup externo

- Snapshot compactado e cifrado com AES-256-GCM.
- Verificação de integridade SHA-256 e autenticação GCM antes de aceitar restauração.
- Fontes configuráveis: `BOT_DB_FILE`, `AUTOMATION_DB_FILE`, `AUTOMATION_ORDERS_FILE`, `SALES_DB_FILE` e `sessions/principal`.
- `.env`, `.env.*`, `node_modules`, downloads e temporários são excluídos.
- Limite de 20 MiB de fontes por snapshot; blocos padrão de 8 MiB (configuráveis de 1 a 20 MiB).
- Manifesto é gravado por último; blocos e manifesto são relidos e verificados.
- Retenção padrão reduzida para 7 dias, considerando a quota de 1 GB do Workers KV Free; configurável entre 7 e 90 dias. Com 168 snapshots horários, a média precisa ficar abaixo de aproximadamente 6 MiB por snapshot para caber em 1 GB, ainda sem margem. O tamanho real deve ser acompanhado.
- Tentativas de leitura de novas chaves são repetidas por até cerca de 116 segundos para acomodar a consistência eventual do KV.
- Backups concorrentes são bloqueados dentro do mesmo processo.
- Restauração valida e extrai apenas para uma pasta `restore-staging/` protegida, sem sobrescrever dados de produção.
- A restauração não aplica automaticamente os ficheiros; a aplicação manual exige parar o bot e rever o conteúdo.
- Se a sessão WhatsApp não existir, o relatório do snapshot marca a fonte como ausente. Um backup sem a sessão não representa recuperação integral de emparelhamento.

### Painéis

- Tenant Panel: vista de saúde do Agent, SIMs individuais, filas e bloqueio de execução.
- Master/Admin: secção de auditoria.
- Painel legado do Bot V2: autenticação por formulário, API na mesma origem, chave guardada apenas em `sessionStorage` da aba e ação de terminar sessão. O visual foi atualizado para uma linha dark/emerald.

### Operação e scripts

Foram acrescentados:

- `npm run doctor`
- `npm run backup:now`
- `npm run backup:list`
- `npm run restore:stage -- <SNAPSHOT_ID>`

Não foram acrescentadas dependências npm novas.

## 3. Ficheiros alterados ou acrescentados

### Documentação e configuração

- `README.md`
- `docs/CONFIGURACAO-E-API.md`
- `docs/PLANO-DE-VALIDACAO.md`
- `docs/PLANO-DE-EXECUCAO-E-IMPLANTACAO-v1.1.1.md`
- `platform/.env.example`
- `platform/README.md`
- `platform/LEIA-PRIMEIRO-URSINHO-X-BOT-V2.md`
- `platform/package.json`
- `platform/package-lock.json`

### Interfaces

- `platform/automation/painel/index.html`
- `platform/master-admin/index.html`
- `platform/painel/index.html`
- `platform/painel/src/app.js`
- `platform/painel/src/style.css`

### Backend

- `platform/src/api/server.js`
- `platform/src/index.js`
- `platform/src/automation/routes/adminRoutes.js`
- `platform/src/automation/routes/tenantRoutes.js`
- `platform/src/automation/services/operationService.js`
- `platform/src/automation/services/simTelemetryService.js`
- `platform/src/automation/services/tenantService.js`

### Novos ficheiros

- `platform/scripts/backup-kv.js`
- `platform/scripts/doctor.js`
- `platform/scripts/listar-backups-kv.js`
- `platform/scripts/restaurar-backup-kv.js`
- `platform/src/automation/services/deviceHealthService.js`
- `platform/src/services/healthAlertService.js`
- `platform/src/services/offsiteBackupService.js`
- `platform/test/health-backup.test.js`

A comparação com o candidato v1.0.0 confirma que as alterações ficaram limitadas a estes caminhos e aos ficheiros de documentação listados. A v1.1.1 acrescenta melhorias de interface, segurança da WebView, build CI, testes do classificador USSD e encerramento limpo do foreground service no timeout Android 15. Os APKs ainda não foram compilados.

## 4. Verificações executadas nesta preparação

| Verificação | Resultado |
|---|---:|
| Testes Node (`node --test`) | 18 aprovados, 0 falhados |
| Sintaxe JavaScript (`npm run check`) | 242/242 ficheiros aprovados |
| XML Android | 11/11 ficheiros parseados |
| Scripts JavaScript inline em HTML | 5/5 sintaticamente válidos |
| Classificador USSD em Kotlin | compilado e 3 verificações rápidas aprovadas |
| Workflows YAML | 2/2 parseáveis
| Scripts inline nas páginas HTML | 4 verificados, 0 erros de sintaxe |
| Integridade do arquivo ZIP após criação | A executar antes da distribuição |

Os testes cobrem autenticação, licenças, isolamento, loja, pagamentos, operações com evidência, persistência, heartbeat, telemetria, cifragem, alertas, contratos de rotas, restauração em staging e configuração pública do website.

## 5. Limitações e testes ainda pendentes

Não foram executados neste ambiente:

- `npm ci` concluído com sucesso: a tentativa terminou por timeout de rede após 120 segundos.
- Arranque HTTP integrado com todas as dependências instaladas.
- Acesso ao servidor Wispbyte ou alteração do processo atual.
- Teste real da rota pública HTTPS.
- Ligação real à Cloudflare, token de API, gravação e recuperação no namespace do utilizador.
- Envio real de alertas por WhatsApp.
- Build Gradle, APK assinado ou instalação Android.
- Heartbeat real do Android Agent.
- Leitura física de SIM, mapeamento slot/subscriptionId ou USSD.
- Transferência real de dados Vodacom.
- Teste de concorrência multi-processo ou utilização multi-instância.

A validação atual é automatizada e local. Não equivale a homologação, teste de campo nem produção.

## 6. Regras operacionais preservadas

- `AUTOMATION_ALLOW_EXECUTION=false`.
- Backend é autoridade; Agent executa tarefa autorizada; Backend valida evidências.
- Movitel não é selecionada para operações de transferência Vodacom.
- SIM escolhido pelo Backend não pode ser substituído por SIM1 ou fallback.
- Resultado ambíguo permanece em `PENDENTE_REVISAO`; não há repetição automática.
- Pagamentos M-Pesa/e-Mola não passam pela custódia do URSINHO; confirmação manual até integração formal aprovada.
- O JSON local pressupõe um único processo escritor e armazenamento persistente.
- Antes de qualquer implantação, fazer backup privado do código atual, `.env`, sessões, bases e volumes do Wispbyte.

## 7. Decisão recomendada

O ZIP v1.1.1 é um **candidato de atualização para validação no host**, não um pacote declarado pronto para produção. Primeiro preservar o servidor atual; depois instalar em ambiente controlado, executar `npm ci`, testes, `doctor`, health HTTP, teste de persistência e validação do backup. Só então avançar para Android e, por último, para transferências reais autorizadas.


## Avanços adicionais v1.1.1

- Website institucional responsivo servido em `/site/`, sem alterar o painel legado na raiz.
- Endpoint público de configuração do website isolado num serviço que expõe somente marca e número de contacto validado.
- Teste específico para impedir que API_KEY e ADMIN_API_KEY sejam expostas na configuração pública.
- Fluxos GitHub Actions preparados para testes Backend e geração de APKs debug; dependem de os ficheiros serem enviados para repositório acessível.
- O AGP dos dois projetos Android foi alinhado para 8.6.1 com Gradle 8.7 no workflow.
- A instalação npm deixou de executar o download de yt-dlp automaticamente; `npm run setup:media` é opt-in para reduzir consumo de dados e evitar downloads inesperados.
- `npm run preflight`: 18/18 testes, 242/242 ficheiros JavaScript e higiene de release aprovados localmente.

## Limitações

Este relatório não declara build Android concluído. O ambiente atual não tinha Gradle/Android SDK e as dependências npm não foram instaladas (o `npm ci --offline --ignore-scripts` falhou porque o cache local não continha o pacote `@ffmpeg-installer/ffmpeg`). O workflow Android só pode produzir APK quando executado em GitHub Actions num repositório acessível. A integração GitHub ligada nesta sessão não disponibilizou os repositórios anteriormente indicados; a auditoria foi feita a partir dos ZIPs anexados nesta conversa.
