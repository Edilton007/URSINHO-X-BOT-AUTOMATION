# Avanço de programação — v1.1.1

## O que foi acrescentado

1. Website institucional responsivo em `platform/site/`, servido em `/site/`. Mantém o painel antigo do Bot V2 na raiz, sem mudar a sua rota.
2. Endpoint público `GET /site/config`, que expõe somente o número de contacto público configurado em `PUBLIC_CONTACT_NUMBER`; não expõe chaves nem dados internos.
3. CI Backend em GitHub Actions: Node.js 24, instalação a partir do lockfile sem scripts de download opcionais, testes, sintaxe e higiene do pacote.
4. CI Android: instala Android SDK 35, executa testes JVM do Agent, compila APKs debug do Agent e Tenant App e conserva os artefactos por um dia.
5. Testes JVM para o classificador USSD: confirmação explícita, falha, ambiguidade e prioridade da falha.
6. Redesenho visual do Android Agent em grafite/verde esmeralda, com secções para SIM, Backend, monitorização e log. IDs antigos dos controlos bloqueados foram preservados para compatibilidade.
7. Tenant App com cabeçalho nativo, estado de carregamento, mensagem de erro offline e botão de nova tentativa; mantém HTTPS obrigatório e bloqueio de conteúdo misto.
8. `npm run preflight` executa testes Node, sintaxe JS e higiene de release. `npm run verify:release` verifica que nenhum `.env`, sessão, base operacional, APK, AAB ou chave privada foi incluído no pacote.
9. `.env.example` recebeu `PUBLIC_CONTACT_NUMBER` e o padrão de TTS deixou ElevenLabs fora do fluxo recomendado gratuito.
10. Download do yt-dlp deixou de acontecer automaticamente no `npm ci`; agora é opt-in por `npm run setup:media`.
11. O diagnóstico passou a marcar sessão WhatsApp e Cloudflare não configurados como itens opcionais, sem bloquear a validação do núcleo.
12. O Agent interrompe de forma limpa o foreground service quando o Android 15 comunica timeout de `dataSync` (proteção contra crash, não garantia de execução 24/7).

## Política de custo zero

- Não foi acrescentada dependência de serviço pago ao caminho principal de Backend, Tenant, Agent ou website.
- IA/serviços externos são opcionais; não colocar chaves nem ativar fornecedores com cobrança.
- O backup Cloudflare continua opcional e dentro da quota gratuita documentada; verificar a quota antes de aumentar frequência/tamanho.
- O workflow GitHub Actions usa runners padrão. Em repositório público, o uso padrão é gratuito; em repositório privado, aplicar as quotas do plano Free e manter limite de gastos em zero para evitar consumo faturável.
- A hospedagem Wispbyte atual continua provisória; este pacote não cria uma conta, não compra domínio e não garante que o host gratuito ofereça volume persistente ou disponibilidade 24/7.

## Limitações que continuam abertas

- Não foi possível acessar os repositórios GitHub do utilizador nesta sessão: a integração listou zero repositórios e retornou 404 para os endereços conhecidos `edilton07/ursinho-x-agent` e `edilton07/ursinho-x-tenant-app`. A comparação foi feita com os ZIPs enviados nesta conversa, não com o estado remoto atual.
- Os APKs ainda não foram compilados neste ambiente. Os novos workflows precisam ser executados depois que este pacote for enviado para um repositório GitHub acessível.
- Website e APIs não foram publicados no Wispbyte.
- Não foram testados WhatsApp real, Cloudflare real, Android físico, multi-SIM, USSD ou transferências Vodacom.
- O Agent ainda precisa de validação de execução prolongada, reinício após reboot e restrições de bateria. O código usa foreground service `dataSync`; em apps que target Android 15/API 35+, o sistema limita esse tipo a 6 horas totais por janela móvel de 24 horas em background e não permite iniciar `dataSync` a partir de `BOOT_COMPLETED`. O código agora termina limpo em timeout, mas o modelo de continuidade para aparelhos Android 15+ ainda precisa ser redesenhado/testado antes de prometer 24/7.
- Não há gateway de pagamento nem integração oficial M-Pesa/e-Mola; confirmação continua manual/auditável.


Referência Android: https://developer.android.com/develop/background-work/services/fgs/timeout e https://developer.android.com/reference/android/app/Service#onTimeout(int,int).
