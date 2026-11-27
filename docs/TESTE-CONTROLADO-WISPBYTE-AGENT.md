# Teste controlado — Wispbyte, WhatsApp Bot V2 e Android Agent

**Estado:** preparação de aceitação técnica. Este documento não autoriza por si só transferências reais.

## 1. Regras que não podem ser ultrapassadas

- Preservar a instalação atual do Wispbyte, a sessão Baileys, o `.env` e todas as bases operacionais.
- Não alterar o comando de arranque, repositório, branch, diretório de trabalho, DNS ou porta do servidor durante a verificação inicial.
- Manter `AUTOMATION_ALLOW_EXECUTION=false` durante a ligação e a validação de telemetria.
- Manter a allowlist vazia até existir um destino de teste escolhido e autorizado. Uma allowlist ausente ou vazia bloqueia a execução.
- Não usar Movitel para uma operação Vodacom. O Backend só deve considerar SIM Vodacom reconhecido e telemetria elegível.
- Pagamentos M-Pesa/e-Mola não são confirmados por API nesta integração. A aprovação é administrativa e só ocorre depois de verificação externa.
- Nunca repetir automaticamente um USSD quando o resultado for incerto. Usar `PENDENTE_REVISAO`.

## 2. Confirmar o servidor sem reiniciar

Verificar a rota pública:

```bash
curl -i --max-time 20 https://ursinho.wispbyte.org/automation/health
```

Esperado: HTTP 200 e JSON com `ok: true`.

O estado real da sessão WhatsApp é protegido por `API_KEY`. No Termux, introduzir a chave sem a expor no comando ou no histórico:

```bash
read -s -p "API_KEY do Bot: " API_KEY; echo
curl -sS --max-time 20 -H "x-api-key: $API_KEY" https://ursinho.wispbyte.org/api/health
unset API_KEY
```

Esperado quando o WhatsApp estiver autenticado: `"status":"online"` e `"socketConnected":true`. HTTP 401 sem a chave é esperado. Nunca colocar a chave na URL, num screenshot ou numa mensagem.

Endereços atuais:
- Bot V2: `https://ursinho.wispbyte.org/`
- Tenant: `https://ursinho.wispbyte.org/tenant/`
- Master: `https://ursinho.wispbyte.org/master/`
- Site: `https://ursinho.wispbyte.org/site/`

O painel Bot V2 está na raiz `/`; `/painel/` não está montado.

## 3. Fazer cópia de segurança antes de qualquer deployment

No gestor de ficheiros do Wispbyte, criar e descarregar uma cópia privada datada de:
- código que está atualmente no servidor;
- `.env`;
- `sessions/`, incluindo `sessions/principal/`;
- `src/database/` e `src/automation/database/`;
- outras bases, ficheiros de recibos e backups existentes.

Confirmar, quando existirem, `db.json`, `sales.json`, `automationOrders.json`, `automation.json` e `usedReceipts.json`.

Não enviar a cópia para o GitHub ou para esta conversa. Não apagar nem substituir estes ficheiros.

## 4. Criar um Tenant de teste e provisionar o Device

1. Abrir `/master/` e autenticar com a chave administrativa própria.
2. Entrar em **Provisionamento**.
3. Criar um Tenant de teste, atribuir uma licença e indicar um `Device ID` único, por exemplo `ANDROID-TEST-001`.
4. Copiar e guardar localmente, num local privado, o `TENANT ID`, `TENANT API KEY`, código de licença, `DEVICE ID` e `DEVICE API KEY` apresentados uma única vez.
5. Não partilhar qualquer uma dessas credenciais. Tenant API Key e Device API Key são diferentes e não podem ser trocadas.

Não criar um segundo Device para o mesmo teste se o primeiro já estiver associado.

## 5. Instalar e configurar o Android Agent

Usar apenas o APK Debug produzido pelo workflow de validação desta branch. É uma compilação de teste, não uma versão de produção assinada.

No Samsung Galaxy A04e:
1. Instalar o APK Agent.
2. Abrir o Agent.
3. No campo Servidor, introduzir exatamente `https://ursinho.wispbyte.org`, sem acrescentar `/tenant`, `/automation` ou outro caminho.
4. Introduzir o `Device ID` e a respetiva `DEVICE API KEY`.
5. Guardar a configuração.
6. Conceder as permissões Android solicitadas para identificar os SIMs e executar tarefas autorizadas.
7. Ativar o serviço de Acessibilidade apenas para interpretar os diálogos USSD quando o teste de execução for autorizado.

O Agent guarda servidor e credenciais cifrados com Android Keystore. Não usar a Tenant API Key neste ecrã.

## 6. Teste sem transferência: ligação e telemetria

Com `AUTOMATION_ALLOW_EXECUTION=false`:
1. Ligar o serviço do Agent e aguardar o contacto com o Backend.
2. Confirmar no Tenant Panel que o Device aparece autorizado/ligado.
3. Confirmar que os SIMs reportados correspondem aos cartões físicos, aos seus `slotIndex` e `subscriptionId`.
4. Verificar que a operadora aparece como Vodacom e que a telemetria tem timestamp atual.
5. Confirmar que a quota mensal transferível só é preenchida quando a resposta da operadora a identifica explicitamente como mensal. Saldo geral ou diário não substitui quota mensal.
6. Confirmar no painel que os dados desconhecidos aparecem como “Sem leitura”, “Sem dados” ou “Aguardando telemetria”, nunca como valores inventados.

Nesta fase não deve existir uma tarefa de transferência elegível, nem deve ser feito qualquer USSD de envio.

## 7. Pré-condições para um único teste telecom real

Só avançar quando TODOS os pontos seguintes forem verdadeiros:
- Existe uma SIM Vodacom física no dispositivo de teste.
- O Agent e o Tenant estão autorizados e a licença está ativa.
- A telemetria é recente e confirma quota mensal transferível suficiente.
- O destino é um número 84/85 controlado pelo responsável pelo teste e autorizado para esta finalidade.
- O backup da sessão, configuração e bases foi confirmado.
- O administrador sabe que será feito um único teste e verificou externamente qualquer pagamento envolvido.
- A operadora, o menu USSD e o comportamento de confirmação foram revistos para a SIM usada.

O Backend aceita quantidades inteiras entre 100 MB e 10.240 MB por operação individual. Começar pelo menor pacote que esteja realmente disponível e configurado para o Tenant; não inventar preço nem saldo.

Apenas depois destas verificações, o responsável pelo servidor pode configurar a allowlist com **um único destino de teste** e ativar temporariamente `AUTOMATION_ALLOW_EXECUTION=true`. Não usar uma allowlist ampla nem destinos de clientes.

## 8. Executar e validar uma única operação

1. Fazer o pedido no fluxo autorizado do Bot/ Tenant para o destino de teste.
2. Confirmar que o Backend faz a pré-verificação de SIM, Device, licença, quota e destino antes de mostrar instruções de pagamento.
3. Confirmar externamente qualquer pagamento e só então aprová-lo como administrador.
4. Verificar que a tarefa contém o Device, SIM slot, subscriptionId, destino e quantidade esperados.
5. No Android, acompanhar a consulta de saldo antes, a execução USSD e a leitura depois.
6. O botão **OK** só pode ser fechado automaticamente quando o classificador o reconhece como informativo. Um ecrã que pede confirmação, aceitação, pagamento, escolha ou repetição não pode ser aceite automaticamente.
7. Só considerar a operação concluída quando o Backend validar a evidência antes/depois e a diferença real corresponder à quantidade autorizada.
8. Confirmar que o painel e o WhatsApp apresentam o mesmo estado validado.

Se não houver saldo antes, se o menu for diferente, se a SIM/subscriptionId não coincidir, se o USSD falhar ou se a evidência for ambígua, parar e deixar `PENDENTE_REVISAO`. Não repetir a tarefa nem criar outra operação para a mesma referência.

## 9. Encerramento do teste

- Desativar novamente `AUTOMATION_ALLOW_EXECUTION` se não houver mais testes autorizados.
- Remover o destino da allowlist quando o teste terminar.
- Guardar os IDs da operação, horários, estado final e evidência externa sem divulgar credenciais.
- Não anunciar entrega concluída se o Backend não a validou.
- Não considerar um health check HTTP como prova de WhatsApp, Agent, SIM ou USSD funcionais.

## 10. O que este teste não substitui

Este procedimento não comprova automaticamente a estabilidade 24/7 do Android, a recuperação de uma sessão Baileys após reinício, o backup/restore do servidor, nem a compatibilidade de todos os menus USSD da Vodacom. Cada um desses cenários precisa de teste separado e evidência registada.
