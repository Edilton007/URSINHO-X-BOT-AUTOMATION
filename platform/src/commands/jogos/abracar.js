const mensagens = [
    "Um abraço apertado cheio de carinho 🤗",
    "Esse abraço foi tão forte que quase quebrou a internet 😂",
    "Abraço recebido com sucesso 💞",
    "Um abraço de amizade do URSINHO 🐻",
    "Esse abraço trouxe energia positiva ✨"
];


module.exports = {

    name: "abracar",

    aliases: [
        "abraçar",
        "abraco"
    ],

    category: "jogos",

    description: "Dar um abraço em alguém",


    run: async (sock, m, ctx) => {

        try {

            if (!ctx.isGroup) {
                return ctx.reply(
                    "❌ Esta brincadeira funciona apenas em grupos."
                );
            }


            const info =
                ctx.m?.message?.extendedTextMessage?.contextInfo;


            const mencionado =
                info?.mentionedJid?.[0];


            let alvo = mencionado;


            if (!alvo) {

                const metadata =
                    await sock.groupMetadata(ctx.chat);


                const membros =
                    metadata.participants.filter(
                        p => p.id !== ctx.sender
                    );


                if (!membros.length) {
                    return ctx.reply(
                        "❌ Não encontrei ninguém para abraçar."
                    );
                }


                alvo =
                    membros[
                        Math.floor(
                            Math.random() * membros.length
                        )
                    ].id;
            }


            const intensidade =
                Math.floor(
                    Math.random() * 100
                ) + 1;


            const texto = `
🤗 𝐀𝐁𝐑𝐀Ç𝐀𝐑
𝐔𝐑𝐒𝐈𝐍𝐇𝐎 𝐗 𝐁𝐎𝐓 𝐕2


🐻 @${ctx.sender.split("@")[0]}
𝐝𝐞𝐮 𝐮𝐦 𝐚𝐛𝐫𝐚ç𝐨 𝐞𝐦:

🤗 @${alvo.split("@")[0]}


💞 𝐅𝐨𝐫ç𝐚 𝐝𝐨 𝐚𝐛𝐫𝐚ç𝐨:
${intensidade}%


${mensagens[
    Math.floor(
        Math.random() * mensagens.length
    )
]}


🐻 𝐔𝐑𝐒𝐈𝐍𝐇𝐎 𝐗 𝐁𝐎𝐓 𝐕2
𝐛𝐲 𝐄𝐝𝐢𝐥𝐭𝐨𝐧 𝐑𝐨𝐧𝐚𝐥𝐝𝐨
`;


            return sock.sendMessage(
                ctx.chat,
                {
                    text: texto,

                    mentions: [
                        ctx.sender,
                        alvo
                    ]
                },
                {
                    quoted: m
                }
            );


        } catch (error) {

            console.error(
                "[ABRACAR] Erro:",
                error.message
            );

            return ctx.reply(
                "❌ Erro ao executar abraço."
            );
        }

    }

};
