# Relatório de auditoria complementar 01

**Projeto:** URSINHO X BOT AUTOMATION v1.1.2
**Data:** 09-11-2026
**Base auditada:** ZIP integrado v1.1.2 já recuperado da biblioteca da conversa.

## Resultado desta passagem

Foi analisado o contrato entre o Android Agent e as rotas de dispositivo do Backend, incluindo obtenção de tarefas, claim, confirmação da identidade do SIM, envio da evidência de resultado e telemetria. Também foram revistos os pontos de entrada da Tenant App, o painel Tenant, Master/Admin, loja pública, autenticação e ponte entre WhatsApp Bot V2 e o serviço de operações.

A estrutura mantém a regra definida: Backend decide, Agent executa, Backend valida e os painéis apresentam. A Tenant App é uma WebView HTTPS do painel Tenant servido pelo mesmo Backend; Master/Admin usa uma chave administrativa separada. A loja pública recolhe pedidos e apresenta instruções de pagamento, mas não confirma M-Pesa/e-Mola automaticamente.

## Correção aplicada

A validação do nome da operadora aceitava qualquer texto contendo `vodacom`. Isso era permissivo demais: uma etiqueta malformada, como `NotVodacom`, passaria pela verificação. Foi substituída por uma allowlist normalizada e idêntica no Backend e Android Agent: `Vodacom`, `Vodacom MZ`, `Vodacom Moçambique` e `Vodacom Mozambique`. Não foi alterado o mecanismo de escolha de SIM, a associação slot/subscriptionId ou a regra de não utilizar Movitel como substituto.

## Testes executados

- Node: 19/19 testes aprovados.
- Sintaxe JavaScript: 242/242 ficheiros aprovados.
- Higiene do pacote: aprovada.
- Kotlin/JVM direto: 10 verificações aprovadas para a allowlist, classificador USSD, roteiro e parser de saldo.
- XML Android: 11 ficheiros válidos.
- JavaScript inline: 5 blocos em 8 páginas HTML sem erros de sintaxe.

## O que ainda impede declarar a versão pronta para mercado

1. Gradle/JUnit e os dois APKs debug ainda não foram executados/gerados porque este ambiente não tem Android SDK nem Gradle e não consegue resolver DNS para descarregar as ferramentas.
2. O servidor HTTP integrado ainda precisa ser iniciado com dependências instaladas e testado com chaves Tenant, Device e Admin separadas.
3. A instalação/integração com Wispbyte ainda não foi validada nesta passagem; não foi alterado nenhum servidor remoto.
4. Ainda faltam instalar os APKs no Samsung Galaxy A04e, validar permissões/serviço de acessibilidade/PhoneAccount e observar o fluxo USSD da interface Samsung.
5. Falta novo SIM Vodacom para telemetria real e transferência controlada; não foi executado qualquer USSD nesta auditoria.

## Estado

A base está mais consistente e passou nas verificações locais executáveis aqui, mas continua **candidato para validação controlada**, não produção. `AUTOMATION_ALLOW_EXECUTION=false` deve permanecer até completar os testes de API, Android, hospedagem e rede Vodacom. O patch não modifica nem substitui o servidor atualmente online.
