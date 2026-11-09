const db = require("../../database/database");

const {
    enviarBotoesOnOff
} = require("../../services/nativeButtonService");

module.exports = {

    name: "chat",

    aliases: [
        "chatia"
    ],

    category: "ia",

    iaGroup: "inteligencia",

    description: "Ativar ou desativar conversa automática com IA",

    run: async (
        sock,
        m,
        ctx
    ) => {

        if (!ctx.isGroup) {
            return ctx.reply(
                "❌ Este comando só pode ser usado em grupos."
            );
        }

        if (
            ctx.permission !== "owner" &&
            ctx.permission !== "admin"
        ) {
            return ctx.reply(
                "❌ Apenas administradores podem controlar o chat IA."
            );
        }

        const opcao =
            String(ctx.args?.[0] || "")
                .toLowerCase()
                .trim();

        const group =
            db.group(ctx.chat);

        /*
        ============================================================
        SEM OPÇÃO
        MOSTRAR PAINEL
        ============================================================
        */

        if (!opcao) {

            const status =
                group.chatAI === true;

            return enviarBotoesOnOff(
                sock,
                ctx.chat,
                m,
                {
                    titulo: "🤖 CHAT IA",
                    status,
                    prefix: ctx.prefix,
                    comando: "chat",
                    texto:
                        "┃ Controle da conversa automática\n" +
                        "┃ com inteligência artificial."
                }
            );
        }

        /*
        ============================================================
        LIGAR
        ============================================================
        */

        if (opcao === "on") {

            group.chatAI = true;

            db.save();

            return enviarBotoesOnOff(
                sock,
                ctx.chat,
                m,
                {
                    titulo: "🤖 CHAT IA",
                    status: true,
                    prefix: ctx.prefix,
                    comando: "chat",
                    texto:
                        "┃ ✅ CHAT IA ATIVADO\n" +
                        "┃\n" +
                        "┃ O URSINHO X BOT V2 pode\n" +
                        "┃ conversar automaticamente."
                }
            );
        }

        /*
        ============================================================
        DESLIGAR
        ============================================================
        */

        if (opcao === "off") {

            group.chatAI = false;

            db.save();

            return enviarBotoesOnOff(
                sock,
                ctx.chat,
                m,
                {
                    titulo: "🤖 CHAT IA",
                    status: false,
                    prefix: ctx.prefix,
                    comando: "chat",
                    texto:
                        "┃ 🔕 CHAT IA DESATIVADO\n" +
                        "┃\n" +
                        "┃ A conversa automática foi\n" +
                        "┃ desligada neste grupo."
                }
            );
        }

        /*
        ============================================================
        OPÇÃO INVÁLIDA
        ============================================================
        */

        return ctx.reply(
            `❌ Opção inválida.

Use os botões do painel ou:
${ctx.prefix}chat on
${ctx.prefix}chat off`
        );
    }
};
