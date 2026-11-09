const { isAdmin } = require("../../services/permissionService");

const {
    setSalesEnabled,
    isSalesEnabled
} = require("../../services/salesService");

const {
    enviarBotoesOnOff
} = require("../../services/nativeButtonService");


module.exports = {

    name: "compras",

    aliases: ["vendas"],

    category: "admin-vendas",

    permission: "admin",

    description: "Ativar ou desativar o sistema de vendas",


    run: async (sock, m, ctx) => {

        try {

            /*
            ==========================================
            PERMISSÃO
            ==========================================
            */

            const admin =
                await isAdmin(
                    sock,
                    ctx.chat,
                    ctx.sender
                );


            if (!admin && ctx.permission !== "owner") {

                return ctx.reply(
                    "❌ Apenas administradores podem usar este comando."
                );

            }


            /*
            ==========================================
            ARGUMENTO
            ==========================================
            */

            const option =
                String(ctx.args?.[0] || "")
                    .trim()
                    .toLowerCase();


            /*
            ==========================================
            SEM ARGUMENTO
            MOSTRAR PAINEL COM BOTÕES
            ==========================================
            */

            if (!option) {

                const status =
                    isSalesEnabled(ctx.chat);


                return enviarBotoesOnOff(
                    sock,
                    ctx.chat,
                    m,
                    {
                        titulo: "VENDAS",
                        status,
                        prefix: ctx.prefix,
                        comando: "compras",
                        texto:
                            "┃ Controle o sistema de vendas\n" +
                            "┃ deste grupo através dos botões."
                    }
                );

            }


            /*
            ==========================================
            ATIVAR
            ==========================================
            */

            if (option === "on") {

                setSalesEnabled(
                    ctx.chat,
                    true
                );


                return enviarBotoesOnOff(
                    sock,
                    ctx.chat,
                    m,
                    {
                        titulo: "VENDAS",
                        status: isSalesEnabled(ctx.chat),
                        prefix: ctx.prefix,
                        comando: "compras",
                        texto:
                            "┃ 🟢 SISTEMA DE VENDAS ATIVADO\n" +
                            "┃\n" +
                            "┃ 📦 O comando " +
                            ctx.prefix +
                            "compra\n" +
                            "┃ está disponível neste grupo."
                    }
                );

            }


            /*
            ==========================================
            DESATIVAR
            ==========================================
            */

            if (option === "off") {

                setSalesEnabled(
                    ctx.chat,
                    false
                );


                return enviarBotoesOnOff(
                    sock,
                    ctx.chat,
                    m,
                    {
                        titulo: "VENDAS",
                        status: isSalesEnabled(ctx.chat),
                        prefix: ctx.prefix,
                        comando: "compras",
                        texto:
                            "┃ 🔴 SISTEMA DE VENDAS DESATIVADO\n" +
                            "┃\n" +
                            "┃ 📦 O comando " +
                            ctx.prefix +
                            "compra\n" +
                            "┃ não poderá registrar novas vendas."
                    }
                );

            }


            /*
            ==========================================
            OPÇÃO INVÁLIDA
            ==========================================
            */

            return ctx.reply(
                `❌ Opção inválida.

Use:
${ctx.prefix}compras on
${ctx.prefix}compras off`
            );


        } catch (e) {

            console.log(
                "compras erro:",
                e
            );


            return ctx.reply(
                "❌ Erro ao configurar o sistema de vendas."
            );

        }

    }

};
