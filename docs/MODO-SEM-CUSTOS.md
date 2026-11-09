# URSINHO X BOT AUTOMATION — modo de desenvolvimento sem custos

Esta política define o que pode ser usado sem pagamentos e o que fica desativado até existir uma opção gratuita confirmada. O objetivo é não exigir cartão, saldo pré-pago, domínio pago ou assinatura para continuar o desenvolvimento.

## 1. Princípio de custo zero

- Não ativar planos pagos nem introduzir chaves de serviços com cobrança no caminho principal.
- Não configurar cartão ou método de pagamento para desbloquear serviços.
- Se um serviço gratuito atingir a quota, a função opcional deve parar ou ficar indisponível; não deve mudar automaticamente para um plano pago.
- Não realizar operações telecom reais até testes, condições da operadora e autorização estarem resolvidos.
- Não existe promessa de alojamento comercial 24/7 gratuito. Serviços gratuitos podem suspender, dormir, limitar recursos ou remover projetos.

## 2. O que é gratuito no desenvolvimento

| Componente | Estratégia gratuita | Limitação / cuidado |
|---|---|---|
| Código e versionamento | GitHub Free, repositório privado | A ligação GitHub desta sessão não disponibilizou os repositórios; não foi possível enviar commits remotamente. |
| Testes Backend | Node.js local ou workflow manual GitHub Actions | GitHub Free inclui quota de minutos para repositórios privados; standard runners para repositórios públicos são gratuitos. Sem método de pagamento, uso adicional após a quota incluída fica bloqueado, em vez de continuar. |
| Build Android | GitHub Actions manual, APK debug | Só depois do código estar num repositório acessível. Os artefactos de teste expiram em 1 dia. APK debug não é publicação Play Store. |
| Website | Ficheiros estáticos incluídos em `platform/site/`, servidos pela API em `/site/` | Requer que o host Node esteja ativo. Sem domínio personalizado pago. GitHub Pages pode servir site estático em repositório público, mas não fornece o endpoint dinâmico `/site/config`. |
| Backups | Cloudflare Workers KV Free, opcional | 1 GB de armazenamento, 1.000 escritas/dia, 100.000 leituras/dia e valor até 25 MiB. Ao exceder quota na modalidade Free, novas operações falham; não mudar para plano pago. |
| Base operacional | JSON local no volume persistente do host | Single-process / single-writer; não usar múltiplas réplicas. A ausência de volume persistente pode perder dados. |
| IA, voz e pesquisa | Integrações opcionais e desligadas quando não há chave gratuita válida | Quotas e modelos gratuitos mudam. Nunca usar chave com cobrança nem assumir que uma API gratuita será permanente. |
| Pagamentos | Confirmação manual e conciliação registada | Sem gateway, sem saldo de carteira e sem custódia URSINHO. Taxas cobradas pelo fornecedor de pagamento, se existirem, não são controladas pelo projeto. |
| Domínio | URL gratuita fornecida pelo host ou subdomínio estático elegível | Domínio próprio geralmente tem custo; fica fora do plano atual. |

## 3. GitHub Actions sem execução automática

Os workflows deste pacote usam apenas `workflow_dispatch`. Portanto, não executam em cada `git push` e não consomem minutos sem uma ação manual do responsável.

- `Backend validation`: instala dependências sem executar downloads opcionais, executa 18 testes, verifica sintaxe e higiene do pacote.
- `Android APKs`: instala Android SDK, testa o classificador USSD e compila os dois APKs debug num único runner.
- Não publique este repositório como público apenas para conseguir minutos gratuitos. O projeto contém lógica comercial e de segurança; avalie primeiro o risco de exposição.
- GitHub Free disponibiliza 2.000 minutos/mês para Actions em repositórios privados. Standard runners em repositórios públicos são gratuitos. Se a conta não tiver método de pagamento, após esgotar a quota incluída, o uso adicional fica bloqueado.
- Configure alertas de utilização incluída. Não autorize consumo faturável. Se as opções de orçamento e limite da conta não garantirem bloqueio de gastos, não execute workflows depois de esgotar a quota incluída.

Referências oficiais:
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/actions/concepts/billing-and-usage
- https://github.com/pricing

## 4. Cloudflare KV sem pagamentos

Cloudflare KV é opcional e só serve para backups cifrados. Não é a base operacional do produto.

- Manter a conta no plano Free.
- Não adicionar método de pagamento nem mudar para Workers Paid.
- Usar um token limitado ao namespace `ursinho-backups`, somente com leitura e escrita KV.
- Não enviar token nem chave de cifragem em chat, GitHub, ficheiros públicos ou screenshots.
- Se quota, espaço ou tamanho de snapshot forem excedidos, o backup deve falhar e emitir alerta; nunca tentar contratar quota.

Referências oficiais:
- https://developers.cloudflare.com/kv/platform/limits/
- https://developers.cloudflare.com/kv/platform/pricing/

## 5. Funcionalidades opcionais que ficam desligadas

- Gemini, Groq, Claude, OpenRouter, Tavily, RapidAPI e outros fornecedores externos: sem chaves por defeito; usar apenas quando a quota gratuita e os termos forem confirmados.
- Downloads de mídia: o `yt-dlp` não é descarregado durante `npm ci`; executar `npm run setup:media` só quando houver Internet/dados disponíveis.
- Cloudflare backup: desligado até existir configuração completa e teste de restauração.
- Alertas WhatsApp: dependem de sessão Baileys real e número privado de proprietário configurado.
- Automação telecom: `AUTOMATION_ALLOW_EXECUTION=false` sempre, até terminar a validação e a autorização aplicável.

## 6. Limite Android relevante para o Agent

O Android 15 introduz um limite de 6 horas em cada janela móvel de 24 horas para serviços foreground `dataSync` de aplicações que têm como alvo API 35 ou superior. O sistema também restringe o arranque desse tipo de serviço por `BOOT_COMPLETED`. O Agent implementa saída limpa no callback de timeout, mas isso não mantém o polling contínuo. O Samsung Galaxy A04e do utilizador está em Android 13, mas versões mais recentes de Android exigem um desenho de continuidade diferente antes de prometer disponibilidade permanente.

Referências oficiais:
- https://developer.android.com/develop/background-work/services/fgs/timeout
- https://developer.android.com/reference/android/app/Service#onTimeout(int,int)

## 7. O que não pode ser prometido gratuitamente

Não posso garantir neste momento alojamento permanente 24/7, domínio próprio, API oficial de pagamentos, serviço SMS, cota ilimitada de IA, conta Google Play Developer, ou autorização de automação da operadora. A estratégia é construir e validar com ferramentas gratuitas e só ativar recursos se houver uma opção gratuita real, segura e compatível.

## 8. Proteção contra perda de dados

A versão atual utiliza ficheiros JSON. Antes de qualquer atualização:

1. Parar o processo de escrita.
2. Fazer cópia local de todas as bases e `sessions/`.
3. Confirmar que a cópia abre e os ficheiros têm tamanho coerente.
4. Atualizar em diretório separado.
5. Nunca misturar dados de produção e dados de teste.
6. Não ativar múltiplas instâncias do Bot/Backend no mesmo conjunto de JSON.
