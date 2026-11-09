const db = require("../../database/database");

const {
    enviarBotoesOnOff
} = require("../../services/nativeButtonService");

module.exports = {

    name: "vozauto",

    aliases: [
        "vozia",
        "iavoz"
    ],

    category: "ia",

    iaGroup: "inteligencia",

    description: "Chat IA responde sempre também em áudio (voz automática)",

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
                "❌ Apenas administradores podem controlar a voz automática."
            );
        }

        const opcao =
            String(ctx.args?.[0] || "")
                .toLowerCase()
                .trim();

        const group =
            db.group(ctx.chat);

        if (opcao === "on" || opcao === "off") {

            group.aiVoiceAuto = opcao === "on";

            db.save();
        }

        const status =
            group.aiVoiceAuto === true;

        return enviarBotoesOnOff(
            sock,
            ctx.chat,
            m,
            {
                titulo: "🎙️ VOZ AUTOMÁTICA",
                status,
                prefix: ctx.prefix,
                comando: "vozauto",
                texto:
                    "┃ Quando ligada, o Chat IA responde\n" +
                    "┃ em texto E em áudio.\n" +
                    "┃ Desligada: só responde em áudio\n" +
                    "┃ se pedirem ou mandarem áudio."
            }
        );
    }
};
