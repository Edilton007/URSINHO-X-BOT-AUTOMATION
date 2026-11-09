# Plano de validação antes de produção

## Já executado ao preparar esta entrega

- `node --test`: 19 testes aprovados na base v1.1.1 (mantida na v1.1.2 e patch de auditoria 01); inclui credenciais, licenças, isolamento, loja, pagamento manual, ciclo Backend/SIM/claim/evidência, persistência, heartbeat, telemetria, cifragem, manipulação de ciphertext, retenção e backup Cloudflare simulado/restauração em staging.
- `npm run check`: sintaxe de 242 ficheiros JavaScript em `src/` e `scripts/`.
- Painel original do Bot atualizado para usar a origem HTTPS atual, autenticação via formulário e `sessionStorage` (não existe chave embutida no frontend).
- Cloudflare REST foi testada por mock de `fetch`, incluindo PUT/GET/listagem/expiração/restauração. Não foi testada com conta real.
- `npm ci` não foi concluído neste ambiente por timeout de rede; portanto o servidor HTTP real/dependências completas não foram iniciados aqui.

## Ainda obrigatório

1. Preservar o servidor atual antes de qualquer substituição (código, `.env`, `data/`, `sessions/` e logs). Instalar dependências no ambiente de teste com `npm ci`, executar testes, e só depois arrancar a API/WhatsApp.
2. Testar os endpoints HTTP reais com tenant, device e admin separados; confirmar que uma chave de outro tenant não acede aos dados.
3. Compilar os dois APKs com o workflow Android e instalar em dispositivo de teste.
4. Confirmar a porta atribuída pelo painel Wispbyte, configuração HTTPS e persistência de `data/` e `sessions/` após reinício. Não assumir que a porta antiga 16292 continua atribuída.
5. Testar telemetria real de SIM Vodacom, slot físico 1/2 e `subscriptionId`; Movitel deve ser rejeitado como recurso Vodacom.
6. Realizar apenas operação controlada e autorizada com SIM Vodacom de teste, confirmar saldo antes/depois, texto USSD e estado final Backend.
7. Testar falha de rede, encerramento do processo no meio de claim, lease expirado, resposta USSD desconhecida e revisão manual sem repetir a operação.
8. Validar política e permissões de privacidade, proteção de dados dos clientes e requisitos legais aplicáveis antes da comercialização.

## Critério de aceitação

Não ativar `AUTOMATION_ALLOW_EXECUTION=true` até todos os itens relativos a API, HTTPS, credenciais, telemetria e teste real controlado estarem aprovados. Não afirmar compatibilidade de USSD para determinada versão/fabricante sem teste documentado.


## Estado da versão v1.1.2

Esta entrega é um **candidato pronto para validação controlada**, não uma implantação de produção. O teste Cloudflare é simulado. O servidor do usuário não foi acedido nem alterado. Não houve teste WhatsApp real, build APK neste ambiente, telemetria Android real, rede Vodacom nem transferência USSD.


## Risco Android 15/API 35

O Agent declara `dataSync` como tipo de foreground service e targetSdk 35. Em Android 15+ o sistema limita esse tipo a 6 horas totais por janela móvel de 24 horas quando em background. Foi adicionado encerramento limpo no callback `onTimeout`, mas a continuidade 24/7 em Android 15+ ainda exige desenho e teste próprios. Referência: https://developer.android.com/develop/background-work/services/fgs/timeout


## Verificações adicionais v1.1.2

- Corrigida a perda de evidências: o histórico USSD já não é apagado quando começa cada etapa de um fluxo composto.
- O fluxo de saldo antes → transferência → saldo depois mantém os registos na mesma sequência para classificação e envio ao Backend.
- O deduplicador de diálogos da Acessibilidade é reiniciado por geração de sessão, para não ignorar um menu repetido numa sessão posterior.
- O Agent agora falha em modo fechado quando não consegue ler o saldo antes: não inicia a transferência; envia evidência incompleta ao Backend, que deverá manter a operação em `PENDENTE_REVISAO`. A entrada manual de procura de tarefas foi unificada com o serviço automático para não manter dois executores diferentes.
- Adicionados testes unitários Kotlin para retenção e limpeza explícita do histórico USSD. Estes testes ainda precisam de ser executados no workflow Gradle/Android, que não pôde ser executado neste ambiente sem SDK Android e sem transferência das dependências.
- O manifesto SHA-256 foi reconstruído para incluir os ficheiros da release e a divergência pré-existente em `docs/AVANCO-SEM-CUSTOS-v1.1.1.md` deixou de existir.


## Auditoria complementar 01 (09-11-2026)

- Backend e Android Agent agora validam o operador por allowlist exata, em vez de aceitar qualquer texto que contenha a palavra `vodacom`.
- Testes de regressão cobrem `NotVodacom`, `Vodacom Fake`, `Movitel` e as quatro designações aceites.
- `npm test`: 19/19 aprovados.
- `npm run preflight`: 19/19 testes Node, 242/242 ficheiros JavaScript e higiene de release aprovados.
- Kotlin/JVM 1.9.0: 10 verificações diretas aprovadas em operador, classificador USSD, roteiro e parser de saldo.
- XML: 11 ficheiros Android analisados e válidos.
- JavaScript inline: 5 blocos em 8 páginas HTML sem erros de sintaxe.
- O build Android completo continua bloqueado neste ambiente: não há Android SDK, Gradle instalado nem acesso DNS para descarregar as ferramentas. Os APKs não foram gerados.
