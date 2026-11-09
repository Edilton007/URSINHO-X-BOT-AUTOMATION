const config = require("../../config/bot");
const db = require("../../database/database");
const { sendMenuNative } = require("../../services/mediaService");

module.exports = {

    name: "setprefix",

    category: "owner",

    permission: "owner",

    description: "Alterar o prefixo deste grupo",

    run: async (sock, m, ctx) => {

        try {

            const ownerNumber =
                String(config.OWNER_NUMBER || "");

            const sender =
                String(ctx.sender || "");

            const ownerLid =
                "132844076699658@lid";

            const isOwner =
                sender === ownerLid ||
                (ownerNumber && sender.includes(ownerNumber));

            if (!isOwner) {
                return ctx.reply(
                    "❌ Apenas o dono pode alterar o prefixo."
                );
            }

            const novoPrefixo =
                String(ctx.args?.[0] || "");

            /*
            ========================================================
            PAINEL DE PREFIXOS
            ========================================================
            */

            if (!novoPrefixo) {

                const prefixoAtual =
                    String(ctx.prefix || "!");

                const menu = `
╭──────────────────────────────╮
│       ⚙️ PREFIXO DO BOT      │
│       URSINHO X BOT V2       │
╰──────────────────────────────╯

🔐 CONFIGURAÇÃO DO GRUPO

Prefixo atual:
「 ${prefixoAtual} 」

🟢 ${prefixoAtual}  PREFIXO ATIVO

Escolha outro prefixo nos botões
abaixo para alterar a configuração.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ A aplicação é exclusiva deste grupo.

🐻 URSINHO X BOT V2
`;

                const prefixos = [
                    {
                        simbolo: "!",
                        nome: "EXCLAMAÇÃO"
                    },
                    {
                        simbolo: "#",
                        nome: "CERQUILHA"
                    },
                    {
                        simbolo: "$",
                        nome: "DÓLAR"
                    },
                    {
                        simbolo: "/",
                        nome: "BARRA"
                    },
                    {
                        simbolo: "?",
                        nome: "INTERROGAÇÃO"
                    },
                    {
                        simbolo: "+",
                        nome: "MAIS"
                    },
                    {
                        simbolo: ">",
                        nome: "MAIOR"
                    },
                    {
                        simbolo: ".",
                        nome: "PONTO"
                    }
                ];

                const buttons = prefixos.map(item => {

                    const ativo =
                        item.simbolo === prefixoAtual;

                    return {
                        texto: ativo
                            ? `🟢 ${item.simbolo} ATUAL`
                            : `⚙️ ${item.simbolo} ${item.nome}`,

                        id:
                            `${prefixoAtual}setprefix ${item.simbolo}`
                    };

                });

                buttons.push({
                    texto: "↩️ VOLTAR",
                    id: `${prefixoAtual}menudono`
                });

                buttons.push({
                    texto: "🏠 MENU PRINCIPAL",
                    id: `${prefixoAtual}menu`
                });

                try {

                    await sendMenuNative(
                        sock,
                        ctx.chat,
                        menu,
                        buttons,
                        {
                            quoted: m
                        }
                    );

                    console.log(
                        "✅ Painel SET PREFIX enviado"
                    );

                    return;

                } catch (error) {

                    console.error(
                        "❌ Erro Native Flow SET PREFIX:",
                        error?.message || error
                    );

                    return ctx.reply(
`⚙️ PREFIXO DO BOT

Prefixo atual:
${prefixoAtual}

Use:
${prefixoAtual}setprefix !

Opções:
!  #  $  /  ?  +  >  .

🐻 URSINHO X BOT V2`
                    );

                }

            }

            /*
            ========================================================
            VALIDAÇÃO
            ========================================================
            */

            if (/\s/.test(novoPrefixo)) {

                return ctx.reply(
                    "❌ O prefixo não pode conter espaços."
                );

            }

            if (novoPrefixo.length !== 1) {

                return ctx.reply(
                    "❌ O prefixo deve ter apenas 1 caractere."
                );

            }

            /*
            ========================================================
            SALVAR POR GRUPO
            ========================================================
            */

            const grupo =
                db.group(ctx.chat);

            const prefixoAnterior =
                String(grupo.prefix || ctx.prefix || "!");

            grupo.prefix =
                novoPrefixo;

            db.save();

            /*
            ========================================================
            CONFIRMAÇÃO
            ========================================================
            */

            return ctx.reply(
`╭──────────────────────────────╮
│     ✅ PREFIXO ALTERADO      │
╰──────────────────────────────╯

Prefixo anterior:
「 ${prefixoAnterior} 」

Novo prefixo:
「 ${novoPrefixo} 」

✅ Configuração aplicada com sucesso.

🏠 Alteração exclusiva deste grupo.

🐻 URSINHO X BOT V2`
            );

        } catch (error) {

            console.error(
                "❌ Erro SET PREFIX:",
                error?.message || error
            );

            return ctx.reply(
                `❌ Erro ao alterar o prefixo.\n\n⚠️ ${error?.message || error}`
            );

        }

    }

};
