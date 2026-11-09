const {
    isAdmin,
    isOwner
} = require("../../services/permissionService");

const {
    getGroup,
    updateGroup
} = require("../../services/groupService");

const {
    enviarBotoesOnOff
} = require("../../services/nativeButtonService");


module.exports = {

    name: "antistatus",

    aliases: [
        "anti-status",
        "anti-status-grupo",
        "anti-statusgrupo",
        "antimarcacaostatus",
        "anti-marcacao-status"
    ],

    category: "admin-protecao",

    permission: "admin",

    description:
        "Remove automaticamente membros que mencionarem o grupo em um Status.",

    run: async (sock, m, ctx) => {

        try {

            /*
            ========================================================
            SOMENTE GRUPOS
            ========================================================
            */

            if (!ctx.isGroup) {

                return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 📢 ANTI-STATUS 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

❌ Este comando só funciona em grupos.

🤖 URSINHO X BOT V2`
                );
            }


            /*
            ========================================================
            PERMISSÕES
            ========================================================
            */

            const dono =
                isOwner(ctx.sender);

            const admin =
                await isAdmin(
                    sock,
                    ctx.chat,
                    ctx.sender
                );

            if (!dono && !admin) {

                return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 📢 ANTI-STATUS 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

❌ Apenas administradores podem utilizar este comando.

🤖 URSINHO X BOT V2`
                );
            }


            /*
            ========================================================
            GRUPO
            ========================================================
            */

            const group =
                getGroup(ctx.chat);


            const atual =
                group?.anti?.status === true;


            /*
            ========================================================
            OPÇÃO
            ========================================================
            */

            const option =
                String(
                    ctx.args?.[0] || ""
                )
                    .trim()
                    .toLowerCase();


            /*
            ========================================================
            SEM ARGUMENTO
            ========================================================

            !antistatus

            Mostra o estado atual + botão.
            ========================================================
            */

            if (!option) {

                return enviarBotoesOnOff(
                    sock,
                    ctx.chat,
                    m,
                    {

                        titulo: "ANTI-STATUS",

                        status: atual,

                        texto:
`╭━━〔 📢 ANTI-STATUS 〕━━╮

📢 Proteção contra marcação
do grupo em Status.

𝐄𝐬𝐭𝐚𝐝𝐨 𝐚𝐭𝐮𝐚𝐥:
${atual ? "🟢 𝐀𝐓𝐈𝐕𝐀𝐃𝐎" : "🔴 𝐃𝐄𝐒𝐀𝐓𝐈𝐕𝐀𝐃𝐎"}

${
    atual
        ? `🚫 Quem mencionar este grupo
em um Status será removido automaticamente.

📸 Foto
📝 Texto
🎥 Vídeo`
        : `ℹ️ A proteção contra marcação
do grupo em Status está desativada.`
}

🐻 𝐔𝐑𝐒𝐈𝐍𝐇𝐎 𝐗 𝐁𝐎𝐓 𝐕𝟐`,

                        prefix:
                            ctx.prefix,

                        comando:
                            "antistatus"
                    }
                );
            }


            /*
            ========================================================
            VALIDAR OPÇÃO
            ========================================================
            */

            if (
                option !== "on" &&
                option !== "off" &&
                option !== "status"
            ) {

                return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 📢 ANTI-STATUS 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

Utilização:

${ctx.prefix}antistatus on
${ctx.prefix}antistatus off
${ctx.prefix}antistatus status

🟢 on  → Ativar
🔴 off → Desativar

🤖 URSINHO X BOT V2`
                );
            }


            /*
            ========================================================
            STATUS
            ========================================================

            !antistatus status

            Mostra estado + botão.
            ========================================================
            */

            if (option === "status") {

                return enviarBotoesOnOff(
                    sock,
                    ctx.chat,
                    m,
                    {

                        titulo: "ANTI-STATUS",

                        status: atual,

                        texto:
`╭━━〔 📢 ANTI-STATUS 〕━━╮

𝐄𝐬𝐭𝐚𝐝𝐨 𝐚𝐭𝐮𝐚𝐥:
${atual ? "🟢 𝐀𝐓𝐈𝐕𝐀𝐃𝐎" : "🔴 𝐃𝐄𝐒𝐀𝐓𝐈𝐕𝐀𝐃𝐎"}

𝐏𝐫𝐨𝐭𝐞çã𝐨:

🚫 Remover membros que
marcarem este grupo em um Status.

📸 Foto
📝 Texto
🎥 Vídeo

🐻 𝐔𝐑𝐒𝐈𝐍𝐇𝐎 𝐗 𝐁𝐎𝐓 𝐕𝟐`,

                        prefix:
                            ctx.prefix,

                        comando:
                            "antistatus"
                    }
                );
            }


            /*
            ========================================================
            NOVO ESTADO
            ========================================================
            */

            const novoEstado =
                option === "on";


            /*
            ========================================================
            CONFIGURAÇÃO REPETIDA
            ========================================================

            IMPORTANTE:

            Mesmo que já esteja no estado solicitado,
            NÃO usamos ctx.reply().

            Mostramos novamente o botão correto.

            OFF  -> botão ATIVAR
            ON   -> botão DESATIVAR
            ========================================================
            */

            if (novoEstado === atual) {

                return enviarBotoesOnOff(
                    sock,
                    ctx.chat,
                    m,
                    {

                        titulo: "ANTI-STATUS",

                        status: atual,

                        texto:
`╭━━〔 📢 ANTI-STATUS 〕━━╮

⚠️ O Anti-Status já está ${
    atual
        ? "𝐀𝐓𝐈𝐕𝐀𝐃𝐎"
        : "𝐃𝐄𝐒𝐀𝐓𝐈𝐕𝐀𝐃𝐎"
}.

𝐄𝐬𝐭𝐚𝐝𝐨 𝐚𝐭𝐮𝐚𝐥:
${atual ? "🟢 𝐎𝐍" : "🔴 𝐎𝐅𝐅"}

${
    atual
        ? `🚫 Quem mencionar este grupo
em um Status será removido automaticamente.`
        : `ℹ️ A proteção contra marcação
do grupo em Status está desativada.`
}

🐻 𝐔𝐑𝐒𝐈𝐍𝐇𝐎 𝐗 𝐁𝐎𝐓 𝐕𝟐`,

                        prefix:
                            ctx.prefix,

                        comando:
                            "antistatus"
                    }
                );
            }


            /*
            ========================================================
            SALVAR CONFIGURAÇÃO
            ========================================================
            */

            updateGroup(
                ctx.chat,
                {
                    anti: {
                        ...(group.anti || {}),

                        status:
                            novoEstado
                    }
                }
            );


            /*
            ========================================================
            CONFIRMAÇÃO + BOTÃO
            ========================================================
            */

            return enviarBotoesOnOff(
                sock,
                ctx.chat,
                m,
                {

                    titulo:
                        "ANTI-STATUS",

                    status:
                        novoEstado,

                    texto:
`📢 𝐀𝐍𝐓𝐈-𝐒𝐓𝐀𝐓𝐔𝐒 🛡️

✅ 𝐂𝐨𝐧𝐟𝐢𝐠𝐮𝐫𝐚çã𝐨 𝐚𝐭𝐮𝐚𝐥𝐢𝐳𝐚𝐝𝐚

𝐄𝐬𝐭𝐚𝐝𝐨: ${
    novoEstado
        ? "🟢 𝐀𝐓𝐈𝐕𝐀𝐃𝐎"
        : "🔴 𝐃𝐄𝐒𝐀𝐓𝐈𝐕𝐀𝐃𝐎"
}

${
    novoEstado
        ? "🚫 Quem mencionar este grupo\nem um Status será removido automaticamente.\n\n📸 Foto\n📝 Texto\n🎥 Vídeo"
        : "ℹ️ A proteção contra marcação\ndo grupo em Status está desativada."
}

🐻 𝐔𝐑𝐒𝐈𝐍𝐇𝐎 𝐗 𝐁𝐎𝐓 𝐕𝟐`,

                    prefix:
                        ctx.prefix,

                    comando:
                        "antistatus"
                }
            );


        } catch (error) {

            /*
            ========================================================
            ERRO
            ========================================================
            */

            console.error(
                "[ANTISTATUS COMMAND] Erro:",
                error?.message || error
            );

            return ctx.reply(
`❌ Erro ao configurar o Anti-Status.

🐻 𝐔𝐑𝐒𝐈𝐍𝐇𝐎 𝐗 𝐁𝐎𝐓 𝐕𝟐`
            );
        }
    }
};
