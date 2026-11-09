# Relatório de correções — URSINHO X BOT AUTOMATION v1.1.2

## Base

Esta release parte do ZIP `URSINHO-X-BOT-AUTOMATION-v1.1.1-SEM-CUSTOS`. Não houve reconstrução do sistema nem substituição da arquitetura.

## Correções feitas nesta sessão

1. **Histórico USSD composto:** `UssdRoteiro.iniciar()` já não apaga o histórico global de cada etapa. Foi introduzida limpeza explícita e a sequência da operação pode manter saldo antes, respostas da transferência e saldo depois.
2. **Menus repetidos:** o serviço de acessibilidade identifica a geração de cada sessão USSD e reinicia o deduplicador ao começar uma sessão nova.
3. **Execução fail-closed:** a transferência deixa de ser iniciada quando a leitura de saldo antes é nula. Como a tarefa já foi reclamada, o Agent comunica evidência incompleta e a operação fica para revisão, sem tentar novamente o USSD.
4. **Execução única:** o botão de procura de tarefa da MainActivity deixou de conter um segundo fluxo independente de claim/USSD e passou a iniciar o serviço automático, mantendo uma única implementação operacional.
5. **Testes:** foram adicionados testes Kotlin para verificar que o histórico se mantém entre sessões do mesmo fluxo e que pode ser limpo explicitamente.
6. **Integridade:** o manifesto `SHA256SUMS.txt` foi regenerado para cobrir os ficheiros da release. A divergência encontrada na versão recebida estava no checksum do documento `docs/AVANCO-SEM-CUSTOS-v1.1.1.md`; o ficheiro ZIP original não tinha erro estrutural.
7. **Versão dos APKs:** Agent `0.3.1` e Tenant App `1.1.2`.

## Testes executados neste ambiente

- `npm run preflight`: 18/18 testes Node aprovados.
- Verificação de sintaxe JavaScript: 242/242 ficheiros aprovados.
- Higiene de release: aprovada.
- `npm ci --ignore-scripts`: não concluído; a transferência de dependências excedeu o limite de execução deste ambiente.
- `npm run doctor`: não executado com sucesso porque `dotenv` não ficou instalado após a tentativa de instalação.
- Android Gradle build / APK: não executado; este ambiente não tem Android SDK configurado e as dependências Gradle não foram descarregadas.
- Não houve comunicação com servidor remoto, WhatsApp real, Cloudflare real, SIM Vodacom ou USSD real.

## Estado honesto

A v1.1.2 é um candidato de validação melhorado, não uma plataforma certificada para produção. O Backend mantém `AUTOMATION_ALLOW_EXECUTION=false` por padrão. Antes de operações reais continuam obrigatórios os testes HTTP autenticados, builds APK, teste em Android físico, confirmação de SIM/subscriptionId, teste USSD documentado, persistência e validação de hospedagem.


## Verificação adicional do pacote recebido e da release (08-11-2026)

- O pacote v1.1.1 enviado pelo utilizador foi usado como base desta release.
- Comparação de ficheiros: os 325 ficheiros do pacote v1.1.1 foram preservados; a v1.1.2 acrescenta 3 ficheiros e modifica 12 ficheiros existentes. Nenhum ficheiro da base foi removido.
- `npm run preflight`: 18/18 testes Node aprovados, 242/242 ficheiros JavaScript aprovados e higiene de release aprovada.
- `npm run check`: 242/242 ficheiros JavaScript aprovados.
- Smoke test Kotlin direto da classe `UssdRoteiro` com Kotlin/JVM 1.9.0: 2 cenários aprovados (retenção de evidências entre sessões do mesmo fluxo e limpeza explícita). Isto não substitui JUnit/Gradle.
- Integridade do manifesto SHA-256: todos os ficheiros listados foram verificados após a reconstrução do pacote.
- Integridade estrutural do ZIP: teste CRC aprovado.

O ambiente não tem Android SDK configurado. O build Gradle completo, os APKs, testes HTTP com dependências instaladas e as integrações remotas continuam por validar.


## Auditoria complementar 01 (09-11-2026)

1. **Validação do operador:** removida a correspondência parcial `contains("vodacom")` do Backend e do Agent. A aceitação agora usa uma allowlist normalizada e idêntica nas duas camadas.
2. **Regressões:** acrescentado teste Node que rejeita `NotVodacom` e `Vodacom Fake` e aceita `Vodacom Moçambique`; acrescentados testes JUnit para nomes permitidos e rejeitados.
3. **Revalidação:** 19/19 testes Node aprovados; 242/242 ficheiros JavaScript aprovados; higiene de release aprovada; 10 verificações Kotlin/JVM e 11 ficheiros XML aprovados.
4. **Limites:** sem SDK Android, Gradle ou acesso de rede neste ambiente, não foi possível executar Gradle/JUnit completo nem gerar APK. Também não foram executados HTTP real, WhatsApp real ou USSD Vodacom.
