# Mapa oficial do servidor — URSINHO X BOT AUTOMATION

Atualizado em 11-11-2026. Este documento separa o servidor Node, os aplicativos Android e o domínio público para evitar que um repositório de APK seja instalado por engano como Backend.

## 1. Identidade do servidor

- Hospedagem atual: **Wispbyte**.
- Domínio público confirmado pelo proprietário: **https://ursinho.wispbyte.org**.
- URL do Tenant Panel: **https://ursinho.wispbyte.org/tenant/**.
- URL do Android Agent (base do Backend): **https://ursinho.wispbyte.org**.
- Não utilizar RavenHost, `node.ravenhost.space:19542`, nem endereços/portas antigos como configuração atual.

O domínio deve continuar associado ao serviço Node correto dentro da conta Wispbyte. Não alterar o DNS/domínio nem substituir o servidor sem backup e validação.

## 2. Repositório que deve executar no Wispbyte

**Repositório de servidor:**
`edilton07/URSINHO-X-BOT-AUTOMATION`

**Diretório de trabalho / raiz Node dentro desse repositório:**
`platform/`

**Não instalar como servidor:**
- `edilton07/ursinho-x-tenant-app`: é um projeto Android WebView para compilar o APK do Tenant. Não contém o Backend Node nem serve o painel web.
- `edilton07/ursinho-x-agent`: é o projeto Android do Agent. Não é o Backend Node.
- A pasta exterior do repositório principal também não é a raiz Node; o `package.json` do servidor está dentro de `platform/`.

## 3. Arranque do serviço Node

No Wispbyte, no serviço que está associado ao domínio `ursinho.wispbyte.org`:

- Runtime: Node.js 20 ou superior (Node 24 é suportado).
- Working Directory: `platform/`.
- Start command: `npm start`.
- Startup file alternativo: `src/index.js`.
- O servidor Express usa `PORT` atribuído pelo host; não fixar a porta pública antiga.
- O servidor faz bind em `0.0.0.0`.
- Executar apenas **uma instância**: as bases JSON operacionais são single-writer.

O `package.json` correto é `platform/package.json`; o comando `npm start` executa `node src/index.js`.

## 4. Dados que têm de ser preservados antes de atualizar

Antes de trocar o código no Wispbyte, criar e descarregar um backup datado contendo, conforme existirem:

- `.env` (privado; nunca publicar ou enviar no GitHub);
- `sessions/`, sobretudo `sessions/principal/`;
- `src/database/`;
- `src/automation/database/`;
- `data/`, `downloads/`, `tmp/` e backups locais relevantes.

Não apagar, recriar ou substituir estes dados para “limpar” o servidor. Preservar as variáveis atuais e confirmar os caminhos que elas usam.

## 5. Variáveis e segurança

- Manter o `PORT` fornecido pelo Wispbyte.
- Manter `OWNER`, `API_KEY` e `ADMIN_API_KEY` existentes, confirmando que as chaves são distintas e válidas.
- Tenant API Key e Device API Key são próprias de cada entidade e não podem ser trocadas entre si.
- Manter `AUTOMATION_ALLOW_EXECUTION=false` durante instalação e testes.
- Não ativar operações USSD reais durante a correção de domínio/servidor.
- Não criar nem inventar novas chaves a partir deste documento.

## 6. Rotas a validar depois do arranque

1. `https://ursinho.wispbyte.org/automation/health` — deve devolver HTTP 200 e JSON com `ok: true`.
2. `https://ursinho.wispbyte.org/tenant/` — Tenant Panel web.
3. `https://ursinho.wispbyte.org/master/` — Master/Admin.
4. `https://ursinho.wispbyte.org/site/` — site institucional.
5. `https://ursinho.wispbyte.org/painel/` — painel web do Bot V2.

O health check comprova apenas que a API responde; não comprova sessão WhatsApp, credenciais Tenant/Device, SIM, telemetria ou execução USSD.

## 7. Configuração dos dois APKs de teste

- **Tenant App:** abre `https://ursinho.wispbyte.org/tenant/`.
- **Android Agent:** usa `https://ursinho.wispbyte.org` como base do Backend.
- O Agent recebe Device ID e Device API Key próprios.
- A Tenant App usa Tenant ID e Tenant API Key próprios no painel.

Os APKs são clientes Android. Não devem ser adicionados ao Wispbyte como substitutos do repositório do Backend.

## 8. Ordem de recuperação

1. Fazer backup do serviço Wispbyte atual.
2. Confirmar qual repositório está associado ao serviço do domínio.
3. Corrigir o serviço para o repositório principal `URSINHO-X-BOT-AUTOMATION`, com Working Directory `platform/`, sem apagar dados.
4. Confirmar `npm ci`, testes e arranque.
5. Validar `/automation/health` e `/tenant/` pelo domínio HTTPS.
6. Só depois instalar e testar os APKs.
7. Só depois de testes de API, Device, SIM e evidências autorizados considerar qualquer operação telecom.

## 9. Estado de verificação

Este mapa regista a configuração correta do projeto e o repositório esperado. A conta/painel Wispbyte não foi acedida nesta revisão; por isso, o repositório atualmente selecionado no host, o estado do processo, a porta efetiva, os volumes e a resposta HTTP ao domínio ainda precisam de confirmação no painel do proprietário.
