const { getGroup, updateGroup } = require("../../services/groupService");
const { isAdmin, isOwner } = require("../../services/permissionService");
const { enviarComBotoes } = require("../../services/nativeButtonService");

module.exports = {
    name: "x9",
    aliases: ["espiao", "monitor"],
    category: "admin",
    permission: "admin",
    description: "Ativa ou desativa o monitoramento de alterações do grupo",

    run: async (sock, m, ctx) => {
        try {
            if (!ctx.isGroup) {
                return ctx.reply(
                    "❌ Este comando só funciona em grupos."
                );
            }

            const dono = isOwner(ctx.sender);
            const admin = await isAdmin(
                sock,
                ctx.chat,
                ctx.sender
            );

            if (!dono && !admin) {
                return ctx.reply(
                    "🚫 Apenas administradores podem configurar o X9."
                );
            }

            const group = getGroup(ctx.chat);

            if (!group) {
                return ctx.reply(
                    "❌ Não foi possível carregar os dados deste grupo."
                );
            }

            const option = String(
                ctx.args?.[0] || ""
            ).toLowerCase();

            const active = group.x9?.active === true;

            /*
             * ============================================================
             * SEM ARGUMENTO → PAINEL COM BOTÕES
             * ============================================================
             */

            if (!option) {
                return enviarComBotoes(
                    sock,
                    ctx.chat,
                    m,
                    `╭━━━〔 🕵️ X9 〕━━━╮
┃
┃ 📡 MONITORAMENTO DO GRUPO
┃
┃ STATUS
┃ ┗ ${active ? "🟢 ATIVO" : "🔴 DESATIVADO"}
┃
┃ O X9 monitora alterações
┃ importantes realizadas no grupo.
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯
🐻 URSINHO X BOT V2`,

                    [
                        {
                            texto: "🟢 ATIVAR X9",
                            id: `${ctx.prefix}x9 on`
                        },
                        {
                            texto: "🔴 DESATIVAR X9",
                            id: `${ctx.prefix}x9 off`
                        }
                    ]
                );
            }

            /*
             * ============================================================
             * ATIVAR
             * ============================================================
             */

            if (option === "on") {
                if (active) {
                    return ctx.reply(
                        "ℹ️ O 🕵️ X9 já está 🟢 ativo neste grupo."
                    );
                }

                updateGroup(
                    ctx.chat,
                    {
                        x9: {
                            ...(group.x9 || {}),
                            active: true
                        }
                    }
                );

                return ctx.reply(
                    `╭━━━〔 🕵️ X9 〕━━━╮
┃
┃ 🟢 X9 ATIVADO
┃
┃ O grupo agora está sendo
┃ monitorado para alterações
┃ importantes.
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯
🐻 URSINHO X BOT V2`
                );
            }

            /*
             * ============================================================
             * DESATIVAR
             * ============================================================
             */

            if (option === "off") {
                if (!active) {
                    return ctx.reply(
                        "ℹ️ O 🕵️ X9 já está 🔴 desativado neste grupo."
                    );
                }

                updateGroup(
                    ctx.chat,
                    {
                        x9: {
                            ...(group.x9 || {}),
                            active: false
                        }
                    }
                );

                return ctx.reply(
                    `╭━━━〔 🕵️ X9 〕━━━╮
┃
┃ 🔴 X9 DESATIVADO
┃
┃ O monitoramento de alterações
┃ do grupo foi desativado.
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯
🐻 URSINHO X BOT V2`
                );
            }

            return enviarComBotoes(
                sock,
                ctx.chat,
                m,
                `╭━━━〔 🕵️ X9 〕━━━╮
┃
┃ ❌ Opção inválida.
┃
┃ Use:
┃ ${ctx.prefix}x9 on
┃ ${ctx.prefix}x9 off
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯`,

                [
                    {
                        texto: "🟢 ATIVAR X9",
                        id: `${ctx.prefix}x9 on`
                    },
                    {
                        texto: "🔴 DESATIVAR X9",
                        id: `${ctx.prefix}x9 off`
                    }
                ]
            );

        } catch (error) {
            console.error(
                "[X9] Erro no comando:",
                error?.message || error
            );

            return ctx.reply(
                "❌ Erro ao configurar o X9."
            );
        }
    }
};
