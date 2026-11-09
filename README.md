# URSINHO X BOT AUTOMATION — v1.1.2

**✨ BY Edilton Ronaldo**

Plataforma multi-tenant para operações telecom, com gestão comercial, inventário de Internet, prova operacional e automação controlada. Esta versão reúne o Bot WhatsApp V2, Backend Central, Tenant Panel, Master/Admin, Loja Pública, Android Agent e Tenant Android App.

> **Estado:** candidato v1.1.2 preparado para validação controlada. Em 08-11-2026, o utilizador informou que o servidor Wispbyte está online e que a versão anterior no servidor era a v1.1.1. Esta informação não foi confirmada por acesso remoto. A v1.1.2 ainda não está instalada no servidor. Os testes locais passaram, mas não houve validação com WhatsApp real, Cloudflare real, dispositivo Android ou rede Vodacom; portanto, não é correto apresentar esta versão como pronta para produção.

## O que esta versão entrega

- Preserva os serviços existentes do Bot V2 e os fluxos anteriores da plataforma.
- Backend central mantém autoridade sobre tenant, licença, dispositivo, SIM, tarefa, evidência e estado.
- Agent só executa tarefas emitidas pelo Backend; Tenant e WhatsApp não inventam estados finais.
- Isolamento multi-tenant, chaves Tenant/Device guardadas como hash e chave Admin separada.
- Saúde do Agent: online até 120 segundos sem heartbeat; timestamps inválidos/futuros não são considerados saudáveis.
- Saúde individual dos SIMs: telemetria padrão de 45 minutos.
- Alertas privados para o proprietário central, sem mensagens em grupos de clientes.
- Auditoria administrativa e área de saúde no Tenant Panel.
- Backup externo opcional, AES-256-GCM, Cloudflare KV, retenção padrão de 7 dias, blocos verificados e restauração somente em staging.
- Painel Bot V2 usa mesma origem HTTPS e formulário de acesso; nenhuma API key é gravada no HTML/JavaScript.
- Website institucional responsivo em `/site/`, com contacto público opcional (`PUBLIC_CONTACT_NUMBER`).
- Workflows manuais de GitHub Actions para validar Backend e compilar APKs debug, usando apenas quotas gratuitas disponíveis e sem execução automática por push.
- `AUTOMATION_ALLOW_EXECUTION=false` permanece obrigatório por padrão.

## Arquitetura

| Componente | Caminho | Função |
|---|---|---|
| Backend Central + WhatsApp Bot V2 | `platform/` | Node.js/Express, dados, autenticação, bot, serviços e APIs. |
| Tenant Panel | `platform/automation/painel/` | Gestão e acompanhamento operacional do tenant. |
| Master/Admin | `platform/master-admin/` | Administração central, licenças, dispositivos, revisões e auditoria. |
| Loja Pública | `platform/storefront/` | Catálogo e pedidos por tenant. |
| Android Agent | `android/agent/` | Telemetria SIM, receção/claim e execução USSD estritamente autorizada. |
| Tenant Android App | `android/tenant-app/` | WebView Android para o painel Tenant. |

**Regra de autoridade:** Backend decide → Android Agent executa → Backend valida evidências → Tenant App/WhatsApp apresenta.

## Desenvolvimento sem custos

Leia `docs/MODO-SEM-CUSTOS.md` antes de ativar qualquer integração externa. O núcleo de desenvolvimento não exige APIs pagas, domínio personalizado ou plano pago; serviços gratuitos têm quotas e podem falhar quando atingem os limites.

## Instalação e validação

Leia primeiro `docs/PLANO-DE-EXECUCAO-E-IMPLANTACAO-v1.1.2.md`. Não substitua o servidor atual antes de guardar `.env`, bases `data/`, sessão `sessions/` e código anterior.

Requisitos: Node.js 20+ e npm. Na pasta `platform/`:

```bash
npm ci
npm run preflight
npm run doctor
npm start
```

`npm run doctor` pode indicar pendências de Cloudflare, chaves ou sessão até serem configuradas. Nunca inclua `.env` no ZIP/GitHub nem envie credenciais em conversas.

## Backups

Workers KV é exclusivamente destino de backup, não banco operacional. Por padrão, snapshot de hora em hora, retenção de 7 dias, limite de 20 MiB de fontes e 8 MiB por bloco. Na quota Free de 1 GB, 168 snapshots por 7 dias precisam ficar, em média, abaixo de aproximadamente 6 MiB cada; confira o tamanho real após o primeiro backup. A chave AES-256-GCM deve ser guardada fora do host. Com variáveis já configuradas:

```bash
npm run backup:now
npm run backup:list
npm run restore:stage -- <SNAPSHOT_ID>
```

A restauração fica em `restore-staging/` e não sobrescreve produção. O processo real de recuperação exige parar o bot e revisão manual.

## Testes locais deste pacote

- `npm run preflight`: **19/19 testes Node aprovados**, 242/242 ficheiros JavaScript aprovados e higiene do pacote aprovada. `npm run check` também aprovou 242/242 ficheiros JavaScript. Smoke test Kotlin/JVM direto: **10 verificações aprovadas** (operadora Vodacom, classificador USSD, roteiro e parser de saldo); os testes JUnit/Gradle e o build Android completo continuam pendentes. Foram também analisados **11 ficheiros XML Android**, todos válidos, e **5 blocos JavaScript inline** em 8 páginas HTML, sem erros de sintaxe.
- A validação local não substitui testes HTTP, Android, WhatsApp ou Cloudflare reais.
- `npm run setup:media` é opcional e só deve ser executado quando houver Internet/dados disponíveis.
- Backup/restore foi testado com Cloudflare simulado, chave errada, ciphertext adulterado e staging isolado.

Não foram concluídos neste ambiente: instalação `npm ci` com rede, HTTP integrado com dependências instaladas, API Cloudflare real, WhatsApp real, testes JUnit/Gradle, build/instalação dos APKs, comunicação Android, USSD ou transferência Vodacom. O ZIP contém os projetos Android em código-fonte, não APKs prontos, e não contém `.env`, sessões WhatsApp nem bases operacionais.

## Auditoria complementar 01

- A verificação de operadora no Backend e no Android Agent passou de correspondência parcial por texto para uma lista estrita de nomes conhecidos: `Vodacom`, `Vodacom MZ`, `Vodacom Moçambique` e `Vodacom Mozambique`.
- Etiquetas como `NotVodacom` e `Vodacom Fake` são rejeitadas. Foram acrescentados testes Node e Kotlin para impedir regressões.
- Este patch não altera o fluxo comercial nem a autoridade Backend → Agent → Backend → Painel.
- Relatório completo: `docs/RELATORIO-AUDITORIA-01.md`.

## Correções da versão v1.1.2

- O histórico USSD agora é preservado entre as sessões encadeadas de saldo antes, transferência e saldo depois.
- O serviço de acessibilidade distingue novas sessões, mesmo quando o primeiro menu repete o mesmo texto.
- A procura manual e o serviço em segundo plano usam um único executor; o Agent bloqueia a transferência quando não consegue obter o saldo antes e envia a falta de evidência ao Backend para revisão.
- O manifesto SHA-256 foi regenerado para refletir todos os ficheiros do pacote.

## Limite Android 15 do Agent

O Agent usa foreground service `dataSync`. Em apps target API 35+, Android 15 limita esse tipo a seis horas por janela móvel de 24 horas em background. O código encerra limpo no timeout, mas continuidade 24/7 em aparelhos Android 15+ ainda precisa de desenho e teste específicos. Isso não afeta o Samsung Galaxy A04e Android 13 pelo limite citado, mas não elimina as restrições de bateria do fabricante. Veja `docs/MODO-SEM-CUSTOS.md`.

## Regras que não podem ser removidas

- Não ativar `AUTOMATION_ALLOW_EXECUTION=true` antes de fechar a validação e autorização da operadora.
- Movitel não é selecionada para operações Vodacom.
- Nunca substituir o SIM escolhido pelo Backend por SIM1 ou SIM predefinido.
- Evidência incerta fica `PENDENTE_REVISAO`; não repetir automaticamente USSD.
- Pagamentos M-Pesa/e-Mola continuam fora da custódia URSINHO; revisão manual, sem fingir integração API.
- JSON atual pressupõe um único processo escritor e volume persistente; não executar múltiplas réplicas.
