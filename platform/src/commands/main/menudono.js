const { loadCommands } = require("../../core/commandLoader");

const {
    sendMenuMedia,
    sendMenuNative
} = require("../../services/mediaService");

module.exports = {

    name: "menudono",

    aliases: [
        "mdono"
    ],

    category: "owner",

    description: "Menu executivo do dono",

    run: async (sock, m, ctx) => {

        const { categories } = loadCommands();

        const comandos = categories.owner || [];

        const permitidos = new Set([
            "gerarcodigo",
            "listacodigos",
            "statusaluguel",
            "licencas",
            "postarcanal",
            "setprefix"
        ]);

        const disponiveis = comandos.filter(
            cmd => permitidos.has(cmd.name)
        );

        let menu = `👑 𝐂𝐄𝐍𝐓𝐑𝐀𝐋 𝐃𝐎 𝐃𝐎𝐍𝐎

🔐 𝐏𝐀𝐈𝐍𝐄𝐋 𝐄𝐗𝐄𝐂𝐔𝐓𝐈𝐕𝐎
⚡ Sistema: 🟢 ONLINE
👑 Acesso: OWNER

Escolha uma opção:
`;

        const buttons = [];

        const nomes = {
            gerarcodigo: "🔐 GERAR CÓDIGO",
            listacodigos: "📋 LISTAR CÓDIGOS",
            statusaluguel: "📊 STATUS DA LICENÇA",
            licencas: "🗂️ LICENÇAS DOS GRUPOS",
            postarcanal: "📢 POSTAR NO CANAL",
            setprefix: "⚙️ PREFIXO"
        };

        for (const cmd of disponiveis) {
            buttons.push({
                texto: nomes[cmd.name] || `⚙️ ${cmd.name.toUpperCase()}`,
                id: `${ctx.prefix}${cmd.name}`
            });
        }

        /*
        ============================================================
        ENVIO NATIVE FLOW
        ============================================================
        */

        try {

            await sendMenuNative(
                sock,
                ctx.chat,
                menu,
                buttons,
                {
                    quoted: m,
                    media: "owner",
                    mediaTitle: "👑 DONO",
                    mediaSubtitle: "CENTRAL EXECUTIVA"
                }
            );

            console.log("✅ Menu Dono Native Flow enviado");

        } catch (error) {

            console.error(
                "❌ Erro no Menu Dono Native Flow:",
                error?.message || error
            );

            /*
            ========================================================
            FALLBACK
            ========================================================
            */

            await sendMenuMedia(
                sock,
                ctx.chat,
                "owner",
                menu,
                {
                    quoted: m
                }
            );

        }

    }

};
