# Plano de execução e implantação — URSINHO X BOT AUTOMATION v1.1.2

**Objetivo:** colocar a plataforma em funcionamento com segurança, preservando o Bot V2, dados, sessão WhatsApp e arquitetura atual.

## 0. Situação atual conhecida

Atualização de 08-11-2026: o utilizador informou que o servidor Wispbyte está online e que a versão anterior que estava no servidor corresponde ao pacote v1.1.1 enviado para esta conversa. A versão v1.1.2 deste ZIP ainda não foi instalada. Não houve acesso remoto ao painel; por isso, não foi possível confirmar diretamente o processo Node, a porta atribuída, `.env`, sessão WhatsApp ou persistência.

**Antes de substituir o código no Wispbyte, criar e descarregar uma cópia de segurança datada do estado atual. Não apagar `.env`, `sessions/` nem bases operacionais.**

## 1. O que está incluído no candidato

- Bot WhatsApp V2 e Backend Central Express no mesmo processo Node.
- Tenant Panel, Master/Admin e Loja Pública.
- Projetos Android Agent e Tenant App (código-fonte, não APK).
- Heartbeat Agent com janela padrão de 120 segundos.
- Telemetria de cada SIM avaliada separadamente, padrão de 45 minutos.
- Alertas ao proprietário central em conversa privada, não em grupos.
- Rota de saúde do Tenant e consulta de auditoria Admin.
- Backup cifrado opcional Cloudflare KV, com retenção de 7 dias, limite de fontes de 20 MiB e restauração em staging.
- Dashboard do Bot V2 com formulário de autenticação e chave guardada apenas na sessão da aba.

## 2. Fase A — preservar o que está no Wispbyte

1. Abra o painel do Wispbyte e confirme qual servidor/projeto contém o Bot.
2. Consulte o estado do servidor e os logs atuais. Não reinicie antes de guardar o que já existe, se o processo estiver ligado.
3. Use o gestor de ficheiros do host para criar/baixar uma cópia datada de:
   - todo o código atual;
   - `.env` (guardar de forma privada; não enviar a ninguém);
   - `sessions/` (incluindo `sessions/principal/`);
   - `src/database/` e `src/automation/database/`;
   - `data/`, se existir;
   - `downloads/`, `tmp/` e ficheiros de backup locais relevantes.
4. Confirme que a cópia inclui `db.json`, `sales.json`, `automationOrders.json`, `automation.json`, `usedReceipts.json` e respetivos backups, conforme existirem.
5. Registe em privado o diretório de trabalho, a versão Node e o comando/startup file atuais.
6. Nunca apague nem substitua `sessions/`, `.env` ou bases de dados para “limpar” a instalação.

Se o painel não permitir criar um arquivo, descarregue os ficheiros/pastas por partes. A cópia `.env` e a pasta `sessions/` contêm credenciais.

## 3. Fase B — confirmar host, diretório e porta

O diretório de execução tem de ser aquele onde ficam `package.json`, `src/`, `painel/`, `automation/` e `master-admin/` do projeto Node (a pasta `platform/` deste ZIP). Não iniciar a partir da pasta exterior que contém `android/` e `docs/`.

Configuração de arranque recomendada:

- comando: `npm start`;
- alternativa Startup File: `src/index.js`;
- Node: versão 20 ou superior;
- bind da API: `0.0.0.0`;
- `PORT`: valor atribuído pelo painel do Wispbyte. Não presumir que a porta antiga 16292 continua ativa; confirme a porta no painel.

O servidor usa `PORT` primeiro, depois `API_PORT`, e por fim 3000. Se o Wispbyte encaminhar a porta pública para uma porta interna específica, a variável `PORT` tem de corresponder à porta interna atribuída pelo host, de acordo com a documentação/painel dele.

## 4. Fase C — preparar a versão sem perder dados

1. Só depois da cópia de segurança da Fase A, descarregue o ZIP v1.1.2 e extraia-o.
2. Para instalar no servidor, use o conteúdo de `platform/` como raiz Node do serviço. Não coloque o diretório exterior inteiro como raiz de `npm start`.
3. Antes de substituir código, compare os diretórios atuais e os novos. Preserve os dados e segredos separados do código.
4. **Preserve o `.env` existente.** Se ainda não existir, crie-o a partir de `.env.example` e preencha manualmente os campos privados.
5. Os caminhos padrão desta versão mantêm o layout histórico do Bot:
   - `BOT_DB_FILE=./src/database/db.json`;
   - `SALES_DB_FILE=./src/database/sales.json`;
   - `AUTOMATION_ORDERS_FILE=./src/database/automationOrders.json`;
   - `AUTOMATION_DB_FILE=./src/automation/database/automation.json`.
6. Se o `.env` atual já aponta para outros caminhos, mantenha esses mesmos caminhos e confirme que apontam para os ficheiros que contêm os dados reais. Não copie uma base antiga para uma pasta nova sem comparar e validar o conteúdo.
7. Preserve `sessions/principal`. O Baileys deve reutilizar a sessão existente; apagar esta pasta obriga a novo emparelhamento.

## 5. Fase D — variáveis de ambiente

Configure apenas quando souber quais valores já existem no servidor:

| Variável | Regra |
|---|---|
| `OWNER` | Número do proprietário do Bot com código do país, só dígitos. |
| `API_KEY` | Chave forte usada pela API/painel Bot V2. Preservar a atual, se válida. |
| `ADMIN_API_KEY` | Chave distinta, forte, só para Master/Admin. |
| `PAIRING_NUMBER` | Número para pairing inicial, se o WhatsApp ainda não tiver sessão. |
| `PORT` | Porta atribuída pelo Wispbyte. |
| `AUTOMATION_ALLOW_EXECUTION` | Manter `false`. |
| `AUTOMATION_GROUPS_JSON` | Manter `{}` até haver mapeamento e revisão de cada grupo. |
| `DEVICE_OFFLINE_AFTER_SEC` | 120. |
| `SIM_TELEMETRY_STALE_MIN` | 45. |
| `OWNER_NUMBER` | Número que recebe os alertas privados; pode ficar vazio para usar `OWNER`. |

Não colocar chaves Gemini, Groq ou outros serviços se não as utilizar. Não reutilizar a chave Admin como API_KEY, Tenant key ou Device key.

## 6. Fase E — instalar dependências e fazer testes no host

A partir da raiz `platform/`:

```bash
npm ci
npm run preflight
```

Resultados esperados nesta versão:

- 18 testes automatizados aprovados;
- verificação sintática sem erros (242 ficheiros JavaScript).

O comando `npm ci` usa o `package-lock.json`. A instalação normal não descarrega automaticamente o binário yt-dlp. Para ativar os downloads de mídia, execute manualmente `npm run setup:media` apenas quando houver Internet e franquia de dados disponível. O serviço principal não deve depender desse download para iniciar.

`npm run doctor` verifica requisitos locais. Sessão Baileys e Cloudflare são itens opcionais e aparecem como pendências informativas; a ausência desses itens não impede a validação do núcleo. OWNER, chaves API distintas, porta e pastas operacionais são requisitos locais.

## 7. Fase F — iniciar e confirmar HTTP

1. Configure o startup command como `npm start` (ou Startup File `src/index.js`).
2. Inicie o servidor.
3. Leia os logs até aparecer a mensagem de API disponível na porta configurada e o estado da sessão WhatsApp.
4. No Termux/telefone, execute:

```bash
curl -i --max-time 20 https://ursinho.wispbyte.org/automation/health
```

A resposta esperada é HTTP 200 e JSON com `ok: true`, serviço `URSINHO X BOT AUTOMATION Backend` e versão `2.1.1`. Substitua o domínio de exemplo pela URL HTTPS atualmente mostrada no painel do Wispbyte, caso seja diferente.

Esse endpoint confirma apenas que a API responde. Não comprova WhatsApp, base persistente, APK, Cloudflare, Agent, SIM ou USSD.

5. Confirme também que `/painel/`, `/tenant/`, `/master/` e `/loja/` servem as páginas HTTPS esperadas. Os dados protegidos continuam a exigir suas chaves.
6. No painel Bot `/painel/`, introduza `API_KEY` no formulário. A chave é guardada em `sessionStorage` desta aba; termine a sessão ao usar dispositivo partilhado.

Se a rota falhar, pare aqui. Não avance para Agent, tenants reais ou transferências.

## 8. Fase G — Cloudflare KV (opcional, depois da API)

O namespace previamente criado pelo utilizador:

- nome: `ursinho-backups`;
- namespace ID: `089a3873b8254393b6a9b91a9cc32d46`.

O Account ID deve ser confirmado dentro da própria conta Cloudflare. Não inferir nem inventar esse ID.

1. Crie um API Token com permissões **Workers KV Storage Read** e **Workers KV Storage Write**, limitado ao namespace correto. Não conceda permissões de administração total.
2. Gere uma chave de cifragem com 32 bytes em Base64 num ambiente privado (Termux local, por exemplo):

```bash
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64')+'\\n')"
```

3. Guarde uma cópia da chave fora do servidor, num gestor de senhas ou local seguro. O serviço também precisa da chave nas variáveis privadas do servidor para cifrar/desencriptar. Nunca a envie em conversa nem a coloque no Git.
4. Configure `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_KV_NAMESPACE_ID`, `CLOUDFLARE_API_TOKEN` e `OFFSITE_BACKUP_ENCRYPTION_KEY_BASE64` no ambiente privado do host.
5. Execute:

```bash
npm run backup:now
npm run backup:list
npm run restore:stage -- <SNAPSHOT_ID>
```

6. Confirme no resultado que as fontes esperadas foram incluídas e que `sessionIncluded: true` quando existir sessão.
7. Revise o recibo e os ficheiros em `restore-staging/`. O script não substitui dados de produção.
8. Só depois desse teste deixe o ciclo automático horário ativo.

**Limites e desenho:** Workers KV Free documenta 1.000 escritas/dia, 100.000 leituras/dia, 1 GB de armazenamento por namespace e valor individual até 25 MiB. O código limita o bloco a 8 MiB por padrão, usa retenção padrão de 7 dias e não excede 20 MiB de fontes por snapshot. Com snapshots horários, 7 dias representam até 168 snapshots; para caber em 1 GB, a média armazenada precisa ficar abaixo de aproximadamente 6 MiB por snapshot, deixando ainda espaço para margem. Depois do primeiro backup, verifique `encryptedBytes` e reduza a frequência ou use armazenamento de backup maior se o consumo projetado exceder a quota. O serviço tenta confirmar cada bloco/manifesto com novas leituras por até cerca de 116 segundos para acomodar a propagação. KV é eventualmente consistente; não usar como base de operações, inventário, filas ou transações.

## 9. Fase H — saúde e Alertas

Depois da API, sessão WhatsApp e Cloudflare (se escolhida) estarem confirmadas:

1. Configure `OWNER_NUMBER` para o número privado do proprietário que receberá alertas; confirme que o bot consegue enviar mensagem privada a esse número.
2. A rota autenticada do Tenant `GET /automation/tenants/:tenantId/saude` apresenta estado do Agent, SIMs individuais, fila e se execução está permitida.
3. O monitor de alertas começa quando o socket WhatsApp estiver ligado. Alertas de Agent/SIM/revisão vão só para o JID privado do proprietário central, não aos grupos dos clientes.
4. O painel usa 120 segundos para Agent e 45 minutos por SIM. Heartbeat do Agent e telemetria SIM são conceitos separados.
5. Monitorização não ativa execução e não cria tarefas por si.

## 10. Fase I — Android Agent e Tenant App

Os APKs ainda não foram compilados nesta preparação. O repositório/arquivo contém código-fonte e workflow GitHub Actions, não APKs prontos.

1. Compilar `android/agent` e `android/tenant-app` no workflow GitHub Actions.
2. Instalar Tenant APK no telefone do proprietário e configurar URL HTTPS base.
3. Instalar Agent APK num Android separado, dedicado, com bateria/energia e rede estável.
4. Provisionar Device no Master/Admin; guardar `Device ID` e `Device API KEY`.
5. Configurar o Agent com HTTPS, Device ID e chave individual.
6. Verificar heartbeat, autorização, SIM slot, `subscriptionId` e telemetria sem executar transferências.
7. Confirmar que o backend não considera um SIM Movitel elegível para uma transferência Vodacom.
8. Fazer testes com SIMs reais apenas quando o utilizador tiver SIM Vodacom de teste e condições para validar telemetria. Não criar dados falsos no painel.

## 11. Fase J — transferência real (última etapa)

Não ativar a execução real até:

- API e HTTPS confirmados;
- persistência de dados e sessão confirmadas após reinício;
- backup e recuperação testados;
- autenticação Tenant/Device/Admin verificada;
- Agent online e telemetria verdadeira de SIM;
- correspondência inequívoca de slot e `subscriptionId`;
- respostas USSD e saldo antes/depois validados;
- falhas e revisões manuais testadas;
- condições/termos e autorização comercial/automação confirmados com a Vodacom.

Só então, com decisão explícita do proprietário, será considerado um teste controlado mínimo de 100 MB com SIM Vodacom, destino autorizado e prova do saldo antes/depois. Uma operação ambígua nunca é repetida automaticamente.

## 12. Rollback

Se uma atualização falhar:

1. Pare o processo Node.
2. Preserve os logs do erro.
3. Não apague as novas bases nem a sessão.
4. Restaure o código anterior da cópia datada, mantendo o `.env`, as bases e a sessão intactos.
5. Se uma base tiver sido modificada pela nova versão, não a substitua cegamente pela antiga. Compare os ficheiros e valide os dados antes de restaurar.
6. Reinicie a versão anterior e confirme `/automation/health` ou o health endpoint do Bot V2 correspondente.

## 13. Estado final de aceitação

A implantação só pode ser marcada como concluída quando as fases A–I estiverem documentadas e o teste controlado da fase J tiver autorização e evidência válida. Até lá, mantenha `AUTOMATION_ALLOW_EXECUTION=false`.


### Atenção ao Android 15/API 35

O Agent declara foreground service `dataSync`. Em apps que target Android 15/API 35+, esse tipo é limitado a 6 horas totais por janela móvel de 24 horas em background. O callback `onTimeout(startId, fgsType)` agora encerra o serviço de forma limpa, mas o monitoramento contínuo/24-7 em Android 15+ não está resolvido por esta versão. O Samsung Galaxy A04e Android 13 do utilizador não está sujeito a este limite específico de Android 15, mas restrições de bateria e fabricante ainda precisam de teste. Referência: https://developer.android.com/develop/background-work/services/fgs/timeout
