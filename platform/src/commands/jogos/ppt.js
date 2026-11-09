const { sendMenuNative } = require("../../services/mediaService");

module.exports = {

    name: "ppt",

    aliases: [
        "pedra",
        "papel",
        "tesoura"
    ],

    category: "jogos",

    description: "Pedra Papel Tesoura",

    run: async (sock, m, ctx) => {

        const escolha =
            String(ctx.args?.[0] || "")
                .toLowerCase();

        const opcoes = [
            "pedra",
            "papel",
            "tesoura"
        ];

        if (!opcoes.includes(escolha)) {

            return sendMenuNative(
                sock,
                ctx.chat,

`✊ 𝐏𝐄𝐃𝐑𝐀, 𝐏𝐀𝐏𝐄𝐋 𝐄 𝐓𝐄𝐒𝐎𝐔𝐑𝐀

Escolha uma opção:

✊ Pedra
📄 Papel
✂️ Tesoura

Exemplo:
${ctx.prefix}ppt pedra`,

                [
                    {
                        texto: "✊ PEDRA",
                        id: `${ctx.prefix}ppt pedra`
                    },
                    {
                        texto: "📄 PAPEL",
                        id: `${ctx.prefix}ppt papel`
                    },
                    {
                        texto: "✂️ TESOURA",
                        id: `${ctx.prefix}ppt tesoura`
                    },
                    {
                        texto: "🎮 MENU JOGOS",
                        id: `${ctx.prefix}menujogos`
                    }
                ],

                {
                    quoted: m,
                    media: "principal",
                    mediaTitle: "✊ PPT",
                    mediaSubtitle: "URSINHO X BOT V2"
                }
            );
        }


        const bot =
            opcoes[
                Math.floor(
                    Math.random() * opcoes.length
                )
            ];


        let resultado;


        if (escolha === bot) {

            resultado = "🤝 EMPATE!";

        } else if (
            (escolha === "pedra" && bot === "tesoura") ||
            (escolha === "papel" && bot === "pedra") ||
            (escolha === "tesoura" && bot === "papel")
        ) {

            resultado = "🎉 VOCÊ GANHOU!";

        } else {

            resultado = "😂 BOT GANHOU!";

        }


        const emojis = {
            pedra: "✊",
            papel: "📄",
            tesoura: "✂️"
        };


        const texto =

`✊ 𝐏𝐄𝐃𝐑𝐀, 𝐏𝐀𝐏𝐄𝐋 𝐄 𝐓𝐄𝐒𝐎𝐔𝐑𝐀

Você:
${emojis[escolha]} ${escolha}

Bot:
${emojis[bot]} ${bot}

━━━━━━━━━━━━━━

${resultado}

🐻 URSINHO X BOT V2
by Edilton Ronaldo`;


        return sendMenuNative(
            sock,
            ctx.chat,
            texto,

            [
                {
                    texto: "🔄 JOGAR NOVAMENTE",
                    id: `${ctx.prefix}ppt`
                },

                {
                    texto: "🎮 MENU JOGOS",
                    id: `${ctx.prefix}menujogos`
                }
            ],

            {
                quoted: m,
                media: "principal",
                mediaTitle: "✊ PPT",
                mediaSubtitle: "JOGO ONLINE"
            }
        );

    }

};
