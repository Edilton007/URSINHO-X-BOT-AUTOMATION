const { isAdmin } = require("../../services/permissionService");

const {
    setVendaIAEnabled,
    isVendaIAEnabled
} = require("../../services/salesService");

const {
    enviarBotoesOnOff
} = require("../../services/nativeButtonService");

module.exports = {

    name: "vendaia",

    aliases: [
        "venderia"
    ],

    category: "vendas",

    description: "Ativar ou desativar a VENDAIA",

    run: async (
        sock,
        m,
        ctx
    ) => {

        try {

            /*
            ============================================================
            OPÇÃO
            ============================================================
            */

            const option =
                String(ctx.args?.[0] || "")
                    .trim()
                    .toLowerCase();


            /*
            ============================================================
            PERMISSÃO
            ============================================================
            */

            const admin = await isAdmin(
                sock,
                ctx.chat,
                ctx.sender
            );

            if (
                !admin &&
                ctx.permission !== "owner"
            ) {

                return ctx.reply(
                    `╭━━━〔 💰 VENDAIA 🧠 〕━━━╮
┃
┃ ❌ SEM PERMISSÃO
┃
┃ Apenas administradores
┃ podem controlar a VENDAIA.
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
                );

            }


            /*
            ============================================================
            SEM OPÇÃO
            MOSTRAR PAINEL
            ============================================================
            */

            if (
                !["on", "off"].includes(option)
            ) {

                const status =
                    isVendaIAEnabled(ctx.chat);

                return enviarBotoesOnOff(
                    sock,
                    ctx.chat,
                    m,
                    {
                        titulo: "💰 VENDAIA 🧠",
                        status,
                        prefix: ctx.prefix,
                        texto:
                            "┃ Use os botões abaixo\n" +
                            "┃ para controlar a VENDAIA."
                    }
                );

            }


            /*
            ============================================================
            LIGAR / DESLIGAR
            ============================================================
            */

            const enabled =
                option === "on";


            setVendaIAEnabled(
                ctx.chat,
                enabled
            );


            /*
            ============================================================
            CONFIRMAÇÃO
            ============================================================
            */

            const statusAtual =
                isVendaIAEnabled(ctx.chat);


            if (enabled) {

                return enviarBotoesOnOff(
                    sock,
                    ctx.chat,
                    m,
                    {
                        titulo: "💰 VENDAIA 🧠",
                        status: statusAtual,
                        prefix: ctx.prefix,
                        texto:
                            "┃ ✅ VENDAIA ATIVADA\n" +
                            "┃\n" +
                            "┃ 🤖 O atendimento automático\n" +
                            "┃ de vendas está ativo."
                    }
                );

            }


            return enviarBotoesOnOff(
                sock,
                ctx.chat,
                m,
                {
                    titulo: "💰 VENDAIA 🧠",
                    status: statusAtual,
                    prefix: ctx.prefix,
                    texto:
                        "┃ 🔕 VENDAIA DESATIVADA\n" +
                        "┃\n" +
                        "┃ 🤖 O atendimento automático\n" +
                        "┃ de vendas foi pausado."
                }
            );


        } catch (error) {

            console.error(
                "vendaia erro:",
                error
            );

            return ctx.reply(
                "❌ Erro ao alterar o estado da VENDAIA."
            );

        }

    }

};
