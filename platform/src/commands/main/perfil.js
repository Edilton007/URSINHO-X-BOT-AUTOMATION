const {
    isOwner
} = require("../../services/permissionService");

module.exports = {

    name: "perfil",

    aliases: [
        "profile"
    ],

    category: "principal",

    description:
        "Mostra informações e o perfil de um usuário do grupo.",

    run: async (sock, m, ctx) => {

        try {

            if (!ctx.isGroup) {
                return ctx.reply(
`👤 𝐏𝐄𝐑𝐅𝐈𝐋

❌ Este comando só pode ser usado em grupos.

🐻 𝐔𝐑𝐒𝐈𝐍𝐇𝐎 𝐗 𝐁𝐎𝐓 𝐕𝟐`
                );
            }

            /*
            ========================================================
            IDENTIFICAR MENÇÃO REAL
            ========================================================
            */

            const message =
                m?.message || {};

            const contextInfo =
                message?.extendedTextMessage?.contextInfo ||
                message?.imageMessage?.contextInfo ||
                message?.videoMessage?.contextInfo ||
                {};

            let mentionedJid =
                contextInfo?.mentionedJid?.[0] ||
                contextInfo?.mentionedJids?.[0] ||
                null;

            /*
            ========================================================
            SE RESPONDEU À MENSAGEM DE ALGUÉM
            ========================================================
            */

            if (!mentionedJid) {
                mentionedJid =
                    contextInfo?.participant ||
                    null;
            }

            /*
            ========================================================
            ALVO
            ========================================================
            */

            let target =
                mentionedJid ||
                ctx.sender;

            /*
            ========================================================
            NÚMERO DIGITADO
            ========================================================
            */

            const argumento =
                String(
                    ctx.args?.[0] || ""
                ).trim();

            if (
                argumento &&
                !mentionedJid
            ) {

                const numero =
                    argumento.replace(
                        /\D/g,
                        ""
                    );

                if (numero) {

                    const metadata =
                        await sock.groupMetadata(
                            ctx.chat
                        );

                    const encontrado =
                        metadata.participants.find(
                            p => {

                                const id =
                                    String(
                                        p.id || ""
                                    );

                                const phone =
                                    String(
                                        p.phoneNumber || ""
                                    );

                                const idNumero =
                                    id.replace(
                                        /\D/g,
                                        ""
                                    );

                                const phoneNumero =
                                    phone.replace(
                                        /\D/g,
                                        ""
                                    );

                                return (
                                    idNumero.endsWith(numero) ||
                                    phoneNumero.endsWith(numero)
                                );
                            }
                        );

                    if (encontrado) {

                        target =
                            encontrado.id;

                    } else {

                        return ctx.reply(
`❌ 𝐌𝐞𝐦𝐛𝐫𝐨 𝐧ã𝐨 𝐞𝐧𝐜𝐨𝐧𝐭𝐫𝐚𝐝𝐨.

Marque diretamente a pessoa:

${ctx.prefix}perfil @pessoa

🐻 𝐔𝐑𝐒𝐈𝐍𝐇𝐎 𝐗 𝐁𝐎𝐓 𝐕𝟐`
                        );
                    }
                }
            }

            /*
            ========================================================
            METADATA
            ========================================================
            */

            const metadata =
                await sock.groupMetadata(
                    ctx.chat
                );

            let participante =
                metadata.participants.find(
                    p => p.id === target
                );

            /*
            ========================================================
            CORRESPONDÊNCIA ALTERNATIVA
            ========================================================
            */

            if (!participante) {

                const targetClean =
                    String(target)
                        .replace(
                            /@.*$/,
                            ""
                        );

                participante =
                    metadata.participants.find(
                        p => {

                            const id =
                                String(
                                    p.id || ""
                                )
                                    .replace(
                                        /@.*$/,
                                        ""
                                    );

                            const phone =
                                String(
                                    p.phoneNumber || ""
                                )
                                    .replace(
                                        /\D/g,
                                        ""
                                    );

                            return (
                                id === targetClean ||
                                phone === targetClean
                            );
                        }
                    );
            }

            /*
            ========================================================
            JID REAL DO PARTICIPANTE
            ========================================================
            */

            const participantJid =
                participante?.id ||
                target;

            /*
            ========================================================
            LID → PN
            ========================================================
            */

            let mentionJid =
                participantJid;

            try {

                if (
                    String(participantJid)
                        .endsWith("@lid")
                ) {

                    const pn =
                        await sock
                            ?.signalRepository
                            ?.lidMapping
                            ?.getPNForLID(
                                participantJid
                            );

                    if (pn) {

                        mentionJid =
                            pn;

                        console.log(
                            "[PERFIL] LID → PN:",
                            participantJid,
                            "=>",
                            mentionJid
                        );
                    }
                }

            } catch (error) {

                console.log(
                    "[PERFIL] LID → PN falhou:",
                    error?.message || error
                );
            }

            /*
            ========================================================
            NOME
            ========================================================
            */

            const nome =
                participante?.notify ||
                participante?.name ||
                participante?.verifiedName ||
                ctx.pushName ||
                "Membro";

            /*
            ========================================================
            CARGO
            ========================================================
            */

            let cargo =
                "Membro";

            if (
                isOwner(
                    participantJid
                )
            ) {

                cargo =
                    "Proprietário";

            } else if (
                participante?.admin === "superadmin"
            ) {

                cargo =
                    "Administrador principal";

            } else if (
                participante?.admin === "admin"
            ) {

                cargo =
                    "Administrador";
            }

            /*
            ========================================================
            FOTO
            ========================================================
            */

            let profileImage =
                null;

            const fotoTargets =
                [
                    participantJid,
                    mentionJid,
                    participante?.phoneNumber
                ].filter(Boolean);

            for (
                const fotoTarget
                of fotoTargets
            ) {

                try {

                    profileImage =
                        await sock.profilePictureUrl(
                            fotoTarget,
                            "image"
                        );

                    if (profileImage) {
                        break;
                    }

                } catch (error) {

                    console.log(
                        "[PERFIL] Foto indisponível:",
                        fotoTarget
                    );
                }
            }

            /*
            ========================================================
            DADOS
            ========================================================
            */

            const randomPercent =
                Math.floor(
                    Math.random() * 100
                );

            const programPrice =
                (
                    Math.random() * 5000 +
                    1000
                ).toFixed(2);

            const beautyLevel =
                Math.floor(
                    Math.random() * 100
                ) + 1;

            const gado =
                Math.min(
                    randomPercent + 7,
                    100
                );

            const passiva =
                Math.min(
                    randomPercent + 5,
                    100
                );

            /*
            ========================================================
            MENÇÃO CLICÁVEL
            ========================================================

            O @ é obrigatório no texto.
            O JID correspondente é enviado em mentions.
            ========================================================
            */

            const mentionText =
                `@${mentionJid.split("@")[0]}`;

            const mensagem =
`👤 𝐏𝐄𝐑𝐅𝐈𝐋

🧑 𝐍𝐨𝐦𝐞:
${mentionText}

🎖️ 𝐂𝐚𝐫𝐠𝐨:
${cargo}

🌚 𝐏𝐫𝐨𝐠𝐫𝐚𝐦𝐚:
𝐑$ ${programPrice}

🐮 𝐆𝐚𝐝𝐨:
${gado}%

🎱 𝐏𝐚𝐬𝐬𝐢𝐯𝐚:
${passiva}%

✨ 𝐁𝐞𝐥𝐞𝐳𝐚:
${beautyLevel}%

🐻 𝐔𝐑𝐒𝐈𝐍𝐇𝐎 𝐗 𝐁𝐎𝐓 𝐕𝟐`;

            /*
            ========================================================
            ENVIAR
            ========================================================
            */

            if (profileImage) {

                await sock.sendMessage(
                    ctx.chat,
                    {
                        image: {
                            url: profileImage
                        },

                        caption:
                            mensagem,

                        mentions: [
                            mentionJid
                        ]
                    },
                    {
                        quoted: m
                    }
                );

            } else {

                await sock.sendMessage(
                    ctx.chat,
                    {
                        text:
                            mensagem,

                        mentions: [
                            mentionJid
                        ]
                    },
                    {
                        quoted: m
                    }
                );
            }

        } catch (error) {

            console.error(
                "[PERFIL] Erro:",
                error?.message || error
            );

            return ctx.reply(
`❌ 𝐄𝐫𝐫𝐨 𝐚𝐨 𝐜𝐚𝐫𝐫𝐞𝐠𝐚𝐫 𝐩𝐞𝐫𝐟𝐢𝐥.

🐻 𝐔𝐑𝐒𝐈𝐍𝐇𝐎 𝐗 𝐁𝐎𝐓 𝐕𝟐`
            );
        }
    }
};
