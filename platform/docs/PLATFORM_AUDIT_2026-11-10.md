# Auditoria técnica inicial — URSINHO X BOT AUTOMATION
Data: 2026-11-10
Base analisada: branch `feat/tenant-commercial-isolation`.
Âmbito desta revisão: Backend de automação, licenças, autenticação, loja pública, métodos de pagamento, rotas WhatsApp/API e persistência. Esta é uma auditoria documental do código consultado; não representa execução de testes nem certificação de produção.

## Resumo executivo

O repositório já contém uma base funcional de automação telecom, autenticação separada para Tenant e Android Device, licenças de utilização única, catálogo por Tenant, pedidos com idempotência, revisão manual de pagamento, seleção de SIM Vodacom e validação de evidências pelo Backend.

O sistema ainda **não está pronto para comercialização multitenant completa**. A principal lacuna é a integração real entre o modelo de Tenant da Automation e o Bot V2/WhatsApp: as rotas atuais do Bot V2 usam uma única `API_KEY` global e as configurações de grupos são guardadas por `groupId`, sem associação comprovada a `tenantId`. Também não foi encontrada, no âmbito de ficheiros consultados, uma camada de identidade global de cliente com relações independentes por Tenant, nem gateway de SMS integrado ao fluxo comercial.

## Matriz de requisitos

| Requisito | Estado observado | Evidência / lacuna |
|---|---|---|
| Autenticação separada Tenant/Device | IMPLEMENTADO no Backend consultado | `auth.js` valida chave própria por Tenant e Device; `tenantService.js` guarda hashes SHA-256. |
| Licença por Tenant | PARCIALMENTE IMPLEMENTADO | Geração, ativação única, renovação e expiração existem. O fluxo de provisionamento ainda é composto por chamadas administrativas separadas. |
| Emparelhamento seguro do Agent | PARCIALMENTE IMPLEMENTADO | `registrarDevice` recebe um `deviceId` fornecido pelo cliente e emite uma chave; falta fluxo de pairing code temporário, expiração e aprovação guiada. |
| Isolamento comercial por Tenant | PARCIALMENTE IMPLEMENTADO | Produtos, lojas e pedidos filtram por Tenant. Necessário rever todas as rotas e serviços, incluindo superfícies Bot V2. |
| Métodos de pagamento por Tenant | IMPLEMENTADO na camada Storefront, sujeito a testes | Métodos são normalizados por loja e copiados para o snapshot do pedido. O titular e o nome do método são campos separados; a interface deve apresentar literalmente o titular configurado. |
| Catálogo e preços no WhatsApp | NÃO VERIFICADO / NÃO IMPLEMENTADO no fluxo consultado | A API pública da loja existe; não foi comprovada a leitura dinâmica deste catálogo pelo handler WhatsApp. |
| Um número WhatsApp para vários Tenants | NÃO IMPLEMENTADO no código consultado | A API do Bot V2 expõe uma sessão/socket global. Falta resolução determinística de Tenant para grupo e privado. |
| Associação de grupo a Tenant | PARCIALMENTE IMPLEMENTADO | Existe pairing por código temporário, validação de administrador do grupo no evento `messages.upsert`, registo único de grupo por Tenant, listagem e desassociação. A integração está escrita, mas ainda não foi executada contra uma sessão WhatsApp real. |
| Cliente global com relações por Tenant | PARCIALMENTE IMPLEMENTADO | Existem coleções `customers` e `customerTenantRelations`, identidade por JID normalizado e relações independentes; o listener `group-participants.update` atualiza entradas/saídas dos grupos associados. Falta ligar os pedidos comerciais e testar JID/LID em sessões reais. |
| Atendimento privado multi-loja | PARCIALMENTE IMPLEMENTADO na camada de identidade | O serviço resolve uma única relação e devolve `TENANT_SELECTION_REQUIRED` quando existem várias. Ainda falta integrar estado da conversa, menus de escolha e links individuais no handler WhatsApp. |
| Upload e gestão de comprovativos | NÃO IMPLEMENTADO nas rotas Storefront consultadas | Rotas consultadas criam pedidos e consultam catálogo; não há endpoint de upload/armazenamento/retensão de comprovativos nessa camada. |
| Validação automática por SMS/API | BLOQUEADO POR INTEGRAÇÃO EXTERNA / NÃO IMPLEMENTADO | Não foi encontrada integração de SMS de pagamento ou adaptadores oficiais nos ficheiros consultados. OCR/SMS não deve, isoladamente, confirmar pagamento. |
| Revisão manual de pagamento | IMPLEMENTADO parcialmente | Serviço permite decisão manual auditada, mas a rota de revisão consultada é administrativa; falta definir permissões e experiência do Tenant. |
| Execução telecom pelo Agent | IMPLEMENTADO na base consultada, testes existentes no repositório | Backend escolhe SIM e atribui tarefa; Agent reporta evidência; conclusão depende da validação do Backend. Execução real permanece dependente de ambiente e autorização. |
| Limpeza e retenção | PARCIALMENTE IMPLEMENTADO / A VALIDAR | Bot V2 chama serviço de limpeza automática, mas não foi demonstrada uma política unificada de retenção para pedidos, comprovativos, dados pessoais e auditoria da Automation. |
| Master Admin | PARCIALMENTE IMPLEMENTADO | Rotas administrativas de tenants, licenças, devices, overview e revisões existem; falta validar interface, provisionamento integrado e políticas de acesso. |
| Persistência para escala | LIMITAÇÃO ARQUITETURAL | `automationDb.js` persiste coleções num ficheiro JSON com cópias de segurança. Adequado apenas a uma fase limitada; concorrência, volume, consultas e retenção exigem migração planeada para base de dados transacional. |

## Riscos e correções prioritárias

1. **Fronteira entre Bot V2 e Automation:** não permitir que uma rota autenticada apenas pela chave global do Bot V2 faça operações comerciais em nome de um Tenant sem contexto autenticado e validado.
2. **Mapeamento WhatsApp:** validar em sessão real o pairing já ligado ao socket Bot V2; confirmar presença do Bot no grupo, privilégio de administrador do utilizador e uso único do código. Garantir unicidade de `groupId` e auditoria de associação/desassociação.
3. **Privado ambíguo:** uma conversa privada não pode herdar automaticamente o Tenant do último grupo. Se o cliente estiver relacionado com várias lojas, exigir seleção explícita ou ligação de entrada com token válido.
4. **Identidade de cliente:** ligar o serviço `customerIdentityService` ao handler de conversas privadas e aos pedidos comerciais; testar resolução de JID/LID e impedir exposição cruzada. Não expor histórico ou dados de outro Tenant.
5. **Provisionamento:** substituir o fluxo manual de criar Tenant, emitir licença e registar Device por um fluxo administrativo consistente, com pairing code de uso único, prazo curto, limite de dispositivos e auditoria.
6. **Pagamentos:** manter snapshot imutável de método/titular/conta por pedido. Adicionar upload seguro de comprovativo e adaptadores de confirmação sem aceitar OCR/SMS do cliente como confirmação definitiva.
7. **SMS:** distinguir SMS do cliente, notificação recebida da operadora e confirmação via API. Exigir validação de origem, conta destinatária, referência, valor, unicidade e idempotência.
8. **Retenção:** criar política por categoria; limpar mensagens/contextos e ficheiros temporários conforme prazo, mas preservar pedidos, pagamentos, operações e evidências sob retenção aplicável e bloqueio de eliminação quando houver disputa.
9. **Persistência:** antes de escalar para dezenas de Tenants, migrar JSON para armazenamento transacional com índices, transações, backups testados e migrações.
10. **Testes:** adicionar testes de isolamento cruzado para cada endpoint e serviço; executar suite, lint/check, preflight e testes de integração antes de declarar qualquer fase concluída.

## Sequência de execução

- Fase A: fechar inventário de código e contratos entre Bot V2, Backend, Tenant App e Android Agent.
- Fase B: corrigir modelo multitenant e autenticação/contexto.
- Fase C: provisionamento e pairing de licenças/dispositivos.
- Fase D: concluir a integração WhatsApp do serviço de identidade já criado, incluindo eventos de grupo, estado de conversa privada e seleção de Tenant.
- Fase E: métodos de pagamento, comprovativos, revisão e adaptadores de SMS/API.
- Fase F: experiência simplificada do Tenant App e Master Admin.
- Fase G: retenção, observabilidade, segurança, testes integrados e preparação de release.

## Critério de conclusão

Nenhuma funcionalidade será marcada como concluída apenas por existir uma rota, botão ou serviço. Cada requisito deverá ter implementação identificável, testes automatizados relevantes e, quando depender de operadora, WhatsApp, SMS ou dispositivo físico, evidência de integração real. A execução de transferências permanece desativada por padrão até autorização e validação de segurança.
