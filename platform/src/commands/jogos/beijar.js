const fs = require("fs");
const path = require("path");

function escolherGif() {

    const pasta = path.join(
        process.cwd(),
        "src/assets/gifs"
    );

    if (!fs.existsSync(pasta)) {
        return null;
    }

    const gifs = fs.readdirSync(pasta)
        .filter(file => file.endsWith(".gif"));

    if (!gifs.length) {
        return null;
    }

    return path.join(
        pasta,
        gifs[Math.floor(Math.random() * gifs.length)]
    );
}


module.exports = {

    name: "beijar",

    aliases: [
        "beijo"
    ],

    category: "jogos",

    description: "Dar um beijo em alguém",


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
                        "❌ Não encontrei ninguém."
                    );
                }


                alvo =
                    membros[
                        Math.floor(
                            Math.random() * membros.length
                        )
                    ].id;
            }


            const porcentagem =
                Math.floor(Math.random() * 101);


            const frases = [
                "💋 Beijo aprovado pelo URSINHO 😂",
                "😍 Esse beijo foi especial",
                "🔥 Clima romântico detectado",
                "😂 Beijo virtual enviado com sucesso"
            ];


            const texto = `
💋 𝐁𝐄𝐈𝐉𝐀𝐑
𝐔𝐑𝐒𝐈𝐍𝐇𝐎 𝐗 𝐁𝐎𝐓 𝐕2


🐻 @${ctx.sender.split("@")[0]}
𝐝𝐞𝐮 𝐮𝐦 𝐛𝐞𝐢𝐣𝐨 𝐞𝐦:

❤️ @${alvo.split("@")[0]}


💞 𝐂𝐨𝐦𝐩𝐚𝐭𝐢𝐛𝐢𝐥𝐢𝐝𝐚𝐝𝐞:
${porcentagem}%


${frases[Math.floor(Math.random() * frases.length)]}


🐻 𝐔𝐑𝐒𝐈𝐍𝐇𝐎 𝐗 𝐁𝐎𝐓 𝐕2
𝐛𝐲 𝐄𝐝𝐢𝐥𝐭𝐨𝐧 𝐑𝐨𝐧𝐚𝐥𝐝𝐨
`;


            const gif = escolherGif();


            const mensagem = {

                caption: texto,

                mentions: [
                    ctx.sender,
                    alvo
                ]

            };


            if (gif) {

                mensagem.gif =
                    fs.readFileSync(gif);

            } else {

                mensagem.text = texto;

                delete mensagem.caption;
            }


            return sock.sendMessage(
                ctx.chat,
                mensagem,
                {
                    quoted: m
                }
            );


        } catch (error) {

            console.error(
                "[BEIJAR] Erro:",
                error.message
            );

            return ctx.reply(
                "❌ Erro no jogo do beijo."
            );
        }

    }

};
