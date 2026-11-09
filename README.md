# URSINHO X BOT AUTOMATION

**Repositório oficial do URSINHO X BOT AUTOMATION**  
✨ BY Edilton Ronaldo

## Importação da versão integrada v1.1.2

Este repositório está preparado para receber a fonte auditada da versão **v1.1.2** e executar a validação automática.

1. Envie para a raiz do branch `main`, sem alterar o nome, o ficheiro:
   `URSINHO-X-BOT-AUTOMATION-v1.1.2-AUDITORIA-01.zip`
2. Confirme o commit do upload.
3. O workflow **Importar fonte auditada e validar URSINHO** será iniciado automaticamente.

O workflow verifica a estrutura do ZIP, valida os 330 hashes SHA-256 do manifesto, rejeita ficheiros de segredos e dados operacionais, executa a pré-validação antes de publicar a fonte e importa os diretórios do projeto para a raiz do repositório. Depois instala as dependências Node.js, repete os testes e tenta compilar os dois APKs Android.

## O que é validado

- Testes Node.js e sintaxe JavaScript do Backend.
- Higiene do pacote antes de qualquer publicação.
- Testes unitários do Android Agent.
- Build debug do Android Agent e da Tenant App.
- APKs de teste disponibilizados como artefactos do GitHub Actions durante 7 dias.

Os APKs debug destinam-se a testes controlados. Não são versões assinadas para distribuição comercial.

## Arquitetura que deve ser preservada

**Backend decide → Android Agent executa → Backend valida → Painel apresenta.**

O Backend é a autoridade sobre tenant, licença, dispositivo, SIM elegível, tarefa e estado da operação. O Agent executa apenas o SIM atribuído pelo Backend e nunca escolhe um SIM alternativo. A interface apresenta apenas dados confirmados pelo Backend.

## Segurança operacional

- Não publicar `.env`, sessões WhatsApp, bases operacionais, tokens, chaves privadas ou APKs.
- `AUTOMATION_ALLOW_EXECUTION=false` continua a ser o padrão.
- Operações Vodacom nunca usam SIM Movitel.
- Evidência incompleta ou ambígua fica em `PENDENTE_REVISAO`; não há repetição automática de USSD incerto.
- Pagamentos M-Pesa/e-Mola são verificados manualmente; o sistema não guarda nem movimenta fundos.

O repositório é público: o código-fonte ficará visível. Nunca carregue credenciais ou dados de clientes.
