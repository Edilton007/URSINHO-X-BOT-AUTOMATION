const {
    getVendaIATabela,
    setVendaIATabela
} = require("../../services/salesService");

module.exports = {

    name: "vendatabela",

    category: "admin-vendas",

    permission: "admin",

    description: "Configurar a tabela de vendas do grupo",

    run: async (
        sock,
        m,
        ctx
    ) => {

        try {

            /* ==================================================
               SOMENTE GRUPOS
            ================================================== */

            if (!ctx.isGroup) {
                return ctx.reply(
                    "❌ Este comando só funciona em grupos."
                );
            }


            /* ==================================================
               PERMISSÃO
            ================================================== */

            if (
                ctx.permission !== "admin" &&
                ctx.permission !== "owner"
            ) {
                return ctx.reply(
                    "❌ Apenas administradores podem configurar a tabela."
                );
            }


            /* ==================================================
               TEXTO ORIGINAL DA MENSAGEM
               PRESERVAR QUEBRAS DE LINHA
            ================================================== */

            const textoOriginal =
                ctx.m?.message?.conversation ||
                ctx.m?.message?.extendedTextMessage?.text ||
                "";


            /*
             * Remove somente o comando .vendatabela
             * e preserva todo o restante exatamente
             * como foi enviado.
             */

            const tabela =
                textoOriginal
                    .replace(
                        new RegExp(
                            `^\\${ctx.prefix}vendatabela\\s*`,
                            "i"
                        ),
                        ""
                    )
                    .trim();


            /* ==================================================
               SEM TEXTO → MOSTRAR TABELA ATUAL
            ================================================== */

            if (!tabela) {

                const atual =
                    getVendaIATabela(
                        ctx.chat
                    );

                if (!atual) {

                    return ctx.reply(
`╭━━━〔 📋 TABELA DE VENDAS 〕━━━╮
┃
┃ ⚠️ Nenhuma tabela configurada
┃ para este grupo.
┃
┃ Para configurar:
┃ ${ctx.prefix}vendatabela
┃ seguido da tabela.
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
                    );
                }

                /*
                 * IMPORTANTE:
                 * Não alteramos "atual".
                 *
                 * A tabela é enviada exatamente
                 * como foi guardada.
                 */

                return ctx.reply(
                    atual
                );
            }


            /* ==================================================
               SALVAR TABELA
            ================================================== */

            const salva =
                setVendaIATabela(
                    ctx.chat,
                    tabela
                );


            if (salva === false) {

                return ctx.reply(
                    "❌ Não foi possível guardar a tabela."
                );

            }


            /* ==================================================
               CONFIRMAÇÃO
            ================================================== */

            return ctx.reply(
`╭━━━〔 📋 TABELA DE VENDAS 〕━━━╮
┃
┃ ✅ TABELA ATUALIZADA
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
            );

        } catch (error) {

            console.error(
                "vendatabela erro:",
                error
            );

            return ctx.reply(
                "❌ Erro ao configurar a tabela."
            );
        }
    }
};
