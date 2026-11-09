# Arquitetura e fluxos — URSINHO X BOT AUTOMATION

## Camadas

1. **Backend Central**: autoridade de autenticação, tenant, licença, device, telemetria, SIM, tarefa, operação, idempotência, evidência e estado. Executa no processo Node/Express em `platform/`.
2. **Tenant App**: WebView Android e painel web servidos em `/tenant/`. Gestão comercial e operacional limitada ao contexto autenticado do tenant.
3. **Android Agent**: identifica linhas, recolhe telemetria, consulta fila, reclama uma tarefa, valida o SIM reservado e executa USSD.
4. **WhatsApp Bot V2**: atendimento, comandos, grupos, vendas, IA/OCR e ponte de compras aprovadas; não é autoridade de estado telecom.
5. **Storefront**: catálogo público e pedido; pedido fica pendente de pagamento até revisão externa.
6. **Master/Admin**: consola global, provisionamento, bloqueios, revisão de operação e pagamento. Separada do Tenant Panel.

## Isolamento e autenticação

- Tenant API: `x-api-key` individual por `tenantId`, armazenada como hash.
- Device API: `x-api-key` individual por device, armazenada como hash.
- Admin API: `x-admin-key` derivada de `ADMIN_API_KEY`; nunca usar a chave de tenant ou device. O Master permite renovar licença, bloquear/libertar Device e rotacionar a chave do Device.
- Rotas do tenant filtram por tenant autenticado; produtos, loja, pedidos e operações carregam `tenantId` no servidor.
- O Agent é autenticado pelo device; não pode enviar outro `tenantId` para trocar de proprietário.

## Fluxo de transferência de Internet Vodacom

1. Tenant pede destino e MB no painel ou fluxo WhatsApp autorizado.
2. Backend valida tenant ativo, licença ativa, device pertencente ao tenant, limites, referência idempotente e formato do destino.
3. Backend seleciona uma SIM Vodacom ligada ao mesmo tenant/device, com telemetria dentro da janela, `subscriptionId` válido, saldo de Internet livre suficiente e menos de 10 transferências diárias.
4. Backend persiste `simId`, `simSlot` e `subscriptionId` na operação e tarefa. Sem SIM elegível, a operação permanece `PENDENTE`; não há tarefa a executar.
5. Agent recebe a tarefa, verifica o claim e volta a encontrar a mesma SIM pelo `slotIndex` e `subscriptionId`. Se não corresponder, bloqueia; nunca usa SIM1/default como fallback.
6. Agent inicia USSD e lê saldo antes/depois. Envia log/resposta e identificadores usados.
7. Backend valida claim, dispositivo, SIM, slot, subscrição, leituras e resultado. A diferença exata do saldo mais confirmação explícita da rede são necessárias para `CONCLUIDA`.
8. Resposta desconhecida, leituras ausentes ou delta incompatível resultam em `PENDENTE_REVISAO`. Lease expirado bloqueia novo claim e exige reconciliação/revisão.
9. WhatsApp/tenant mostra o estado que veio do Backend.

### Estados

- `CRIADA`: pedido registado.
- `PENDENTE`: pedido aguardando SIM/condição válida, ainda sem tarefa.
- `AGUARDANDO_EXECUCAO`: tarefa autorizada e SIM reservada.
- `EXECUTANDO`: Agent reclamou a tarefa com token/lease.
- `CONCLUIDA`: evidência exigida passou.
- `FALHOU`: falha explicitamente reportada com evidência compatível definida pelo motor.
- `PENDENTE_REVISAO`: evidência incompleta/ambígua ou lease expirado.

`PENDENTE` e `PENDENTE_REVISAO` são estados de controle adicionais utilizados pelo motor para não inventar disponibilidade ou sucesso.

## Loja e pagamento

- Loja é única por tenant, com slug exclusivo e publicação explícita.
- O catálogo mostra apenas produtos ativos de uma loja publicada.
- O preço e total são recalculados no servidor usando os produtos atuais; o browser não determina o total.
- Pedido tem referência e chave de idempotência por tenant. Repetição idêntica devolve o mesmo pedido; reutilização com dados diferentes responde conflito.
- Estado inicial: `AGUARDANDO_PAGAMENTO` / `PENDENTE_VERIFICACAO`.
- Pagamento só é alterado por revisão Admin manual e fica em auditoria. Não há gateway de M-Pesa/e-Mola neste pacote.
- Código de licença é de uso único; renovação gera novo código e acrescenta o período ao fim da licença ainda ativa, sem eliminar dias já pagos. A licença anterior fica `SUBSTITUIDA`.

## Persistência

As bases JSON usam gravação atómica nos módulos reforçados; a base operacional de automação possui backup comprimido e política fail-closed para corrupção. A base principal do Bot também foi endurecida para cópia de preservação e bloqueio de inicialização em JSON corrompido. Este desenho pressupõe volume persistente e um único processo que escreve os ficheiros. Para várias réplicas, substituir armazenamento JSON por banco transacional compartilhado, com lock/índices e migrações.
