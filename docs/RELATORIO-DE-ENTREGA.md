# Relatório de entrega — candidato integrado v1.0.0

## Conteúdo consolidado

- Fonte do Bot WhatsApp V2 original preservada (com comandos, serviços, painel, assets e ponte operacional), sem `.env`, credenciais, sessão de WhatsApp, `node_modules` ou bases runtime.
- Backend Central embutido no mesmo serviço Express, com rotas Tenant, Device, Admin, monitor de operação, telemetria, fila, leases e validação de evidência.
- Autenticação própria por tenant/device com segredo aleatório e armazenamento SHA-256; Admin usa chave separada. Licença criptograficamente aleatória e de uso único, renovável sem perder período restante. Rotação de chave do Device e bloqueio/reativação na consola.
- Master/Admin separado, com provisionamento, resumo global, bloqueio de tenant/device, revisão operacional e aprovação manual de pagamento.
- Loja pública e gestão de loja por tenant: slug único, produtos isolados, total calculado no Backend, idempotência obrigatória e pedido inicialmente pendente.
- Android Agent atualizado: HTTPS obrigatório, configuração cifrada com Android Keystore, execução manual livre de USSD desativada, tarefa operacional somente via claim do Backend, SIM/slot/subscriptionId conferidos, classificação conservadora da resposta.
- Tenant Android App atualizado: endereço configurável, HTTPS obrigatório e navegação limitada ao mesmo host.
- Workflow GitHub Actions incluído para construir APK debug do Agent e Tenant App.
- Guias de arquitetura, configuração/API e validação incluídos em `docs/`.

## Validações executadas neste pacote

| Verificação | Resultado |
|---|---:|
| Testes Node integrados da plataforma | 7 aprovados, 0 falhas |
| Sintaxe JavaScript (`src/` e `scripts/`) | 232/232 aprovados |
| JavaScript inline Master/Admin | Aprovado |
| JavaScript inline Loja Pública | Aprovado |
| JavaScript inline Gestão da Loja | Aprovado |
| HTTP real Express / Baileys | Não executado neste ambiente: dependências externas não foram instaladas |
| Compilação Gradle / APK | Não executada neste ambiente: Android SDK/Gradle não disponíveis |
| USSD real Vodacom | Não executado nesta versão |
| Deploy/servidor remoto | Não realizado |

## Decisões e restrições mantidas

- Não alterar o Wispbyte nem qualquer servidor remoto.
- Não publicar no GitHub automaticamente. O workflow fica pronto para executar quando o proprietário decidir enviar o repositório.
- `AUTOMATION_ALLOW_EXECUTION=false` permanece como padrão.
- Não existem credenciais reais no pacote.
- Pagamento M-Pesa/e-Mola não é consultado por API; a revisão de loja é manual.
- JSON é adequado para a implementação single-process atual, não para múltiplas réplicas simultâneas. Um banco transacional compartilhado é necessário antes de escalar horizontalmente.
- O Agent mantém minSdk 24 para instalação e funções de interface/deteção; a execução USSD exige mapeamento inequívoco de `PhoneAccountHandle` para `subscriptionId`, e em API <30 esta versão falha fechada.

Esta entrega é uma versão candidata de código consolidada e testada nos limites indicados, não uma declaração de produção certificada.
