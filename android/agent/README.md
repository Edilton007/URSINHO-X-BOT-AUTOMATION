# URSINHO X BOT AUTOMATION — Android Agent 0.3.1

**✨ BY Edilton Ronaldo**

O Agent é o executor Android da plataforma. Ele deteta SIMs, publica telemetria, consulta tarefas autenticadas, reclama uma tarefa e executa apenas o SIM/slot/subscriptionId definido pelo Backend. Não escolhe tenant, licença, preço, quantidade, destino ou estado final.

## Requisitos e compilação

- Android minSdk 24 para instalação/interface/deteção.
- Java 17, Android Gradle Plugin 8.5.2, compileSdk 35 e Gradle 8.7.
- O modelo de compilação está em `docs/ci-templates/android-build.yml`. A compilação também é executada pelo workflow principal `import-and-build.yml`.
- O repositório contém o código-fonte, não APKs versionados. O workflow GitHub Actions `Platform validation` compila os APKs Debug do Agent e Tenant e publica o artefacto `URSINHO-X-APKs-DEBUG-TESTE` por 7 dias. São builds de teste, não APKs de produção assinados.

## Configuração no aparelho

1. Instale o APK debug produzido pelo workflow.
2. Abra o app e conceda as permissões solicitadas para leitura dos SIMs e chamadas USSD.
3. Informe o endereço base HTTPS do Backend, a chave individual do Device e o `Device ID` provisionado na consola `/master/`. Não acrescente `/tenant` nem `/automation` ao endereço base.
4. Detete os SIMs e confirme operadora, `slotIndex` e `subscriptionId`.
5. Ative o serviço de acessibilidade somente quando necessário para interpretar o diálogo USSD.
6. Ligue o serviço automático ou use Buscar Tarefa. O Backend precisa ter uma tarefa elegível e uma SIM Vodacom com telemetria recente.

## Limites de segurança

- A transferência manual e o envio livre de códigos USSD foram desativados na interface do Agent. A procura manual e o serviço em segundo plano delegam para o mesmo executor, evitando fluxos paralelos com regras diferentes. A transferência operacional só começa depois do claim aceite pelo Backend. A leitura de saldo antes é obrigatória; sem ela, o Agent não inicia a transferência e reporta evidência incompleta para revisão.
- O Agent verifica que a SIM local tem o mesmo `slotIndex`, `subscriptionId`, operadora e `simId` da tarefa. Divergência bloqueia a operação; não há fallback para SIM1 ou SIM predefinida.
- O classificador de texto USSD só retorna `true` para frases positivas explícitas, `false` para falhas explícitas e `null` para respostas ambíguas. O Backend valida o saldo antes/depois e mantém casos duvidosos em revisão.
- Embora a instalação comece no Android API 24, esta versão só executa USSD quando consegue mapear inequivocamente `PhoneAccountHandle` para o `subscriptionId`. Em API inferior a 30, a implementação atual bloqueia a transferência se não puder provar a linha correta. Não declarar suporte universal a USSD multi-SIM em Android 7–10.
- Não teste transferência real sem licença, SIM Vodacom de teste, autorização e `AUTOMATION_ALLOW_EXECUTION=true` configurado no Backend depois de todos os testes.

## Validação

Em 27-11-2026, o workflow `Platform validation` concluiu com sucesso os testes unitários do Agent e a compilação dos APKs Debug do Agent e Tenant. Isto confirma apenas a compilação automatizada. A instalação física no Samsung Galaxy A04e, o contacto com o Wispbyte, a deteção de SIM Vodacom e a execução USSD/transação real continuam pendentes de aceitação no aparelho.
