const { sendMenuNative } = require("../../services/mediaService");

const partidas = new Map();


function criarTabuleiro() {

    return [
        "1", "2", "3",
        "4", "5", "6",
        "7", "8", "9"
    ];

}


function mostrarTabuleiro(tabuleiro) {

    return `
┌───┬───┬───┐
│ ${tabuleiro[0]} │ ${tabuleiro[1]} │ ${tabuleiro[2]} │
├───┼───┼───┤
│ ${tabuleiro[3]} │ ${tabuleiro[4]} │ ${tabuleiro[5]} │
├───┼───┼───┤
│ ${tabuleiro[6]} │ ${tabuleiro[7]} │ ${tabuleiro[8]} │
└───┴───┴───┘
`;

}


function verificarVitoria(tabuleiro, simbolo) {

    const linhas = [

        [0,1,2],
        [3,4,5],
        [6,7,8],

        [0,3,6],
        [1,4,7],
        [2,5,8],

        [0,4,8],
        [2,4,6]

    ];


    return linhas.some(
        linha =>
            linha.every(
                posicao =>
                    tabuleiro[posicao] === simbolo
            )
    );

}


function empate(tabuleiro) {

    return tabuleiro.every(
        casa =>
            casa === "❌" ||
            casa === "⭕"
    );

}


function jogadaBot(tabuleiro) {

    const livres = tabuleiro
        .map(
            (casa, index) =>
                !["❌","⭕"].includes(casa)
                    ? index
                    : null
        )
        .filter(
            index =>
                index !== null
        );


    if (!livres.length) return;


    const escolha =
        livres[
            Math.floor(
                Math.random() * livres.length
            )
        ];


    tabuleiro[escolha] = "⭕";


    return escolha + 1;

}


module.exports = {

    name: "jogodavelha",

    aliases: [
        "velha",
        "jvelha"
    ],

    category: "jogos",

    description: "Jogo da velha contra o bot",


    run: async (sock, m, ctx) => {


        let jogo =
            partidas.get(ctx.chat);


        const movimento =
            Number(
                ctx.args?.[0]
            );


        if (!jogo || ctx.args?.[0] === "novo") {

            jogo = {

                tabuleiro:
                    criarTabuleiro()

            };


            partidas.set(
                ctx.chat,
                jogo
            );

        }


        else if (
            movimento >= 1 &&
            movimento <= 9
        ) {


            const posicao =
                movimento - 1;


            if (
                !["❌","⭕"]
                .includes(
                    jogo.tabuleiro[posicao]
                )
            ) {


                jogo.tabuleiro[posicao] =
                    "❌";


                if (
                    verificarVitoria(
                        jogo.tabuleiro,
                        "❌"
                    )
                ) {

                    partidas.delete(ctx.chat);

                    return sendMenuNative(

                        sock,
                        ctx.chat,

`🎯 𝐉𝐎𝐆𝐎 𝐃𝐀 𝐕𝐄𝐋𝐇𝐀

${mostrarTabuleiro(jogo.tabuleiro)}

🎉 VOCÊ GANHOU!

🐻 URSINHO X BOT V2`,

                        [
                            {
                                texto: "🔄 NOVA PARTIDA",
                                id: `${ctx.prefix}jogodavelha novo`
                            },
                            {
                                texto: "🎮 MENU JOGOS",
                                id: `${ctx.prefix}menujogos`
                            }
                        ],

                        {
                            quoted:m,
                            media:"principal",
                            mediaTitle:"🎯 JOGO DA VELHA",
                            mediaSubtitle:"URSINHO X BOT V2"
                        }

                    );

                }


                const jogada =
                    jogadaBot(
                        jogo.tabuleiro
                    );


                if (
                    verificarVitoria(
                        jogo.tabuleiro,
                        "⭕"
                    )
                ) {

                    partidas.delete(ctx.chat);

                    return sendMenuNative(

                        sock,
                        ctx.chat,

`🎯 𝐉𝐎𝐆𝐎 𝐃𝐀 𝐕𝐄𝐋𝐇𝐀

${mostrarTabuleiro(jogo.tabuleiro)}

🤖 O BOT GANHOU!

Jogada do bot:
${jogada}`,

                        [
                            {
                                texto:"🔄 NOVA PARTIDA",
                                id:`${ctx.prefix}jogodavelha novo`
                            },
                            {
                                texto:"🎮 MENU JOGOS",
                                id:`${ctx.prefix}menujogos`
                            }
                        ],

                        {
                            quoted:m,
                            media:"principal",
                            mediaTitle:"🎯 JOGO DA VELHA",
                            mediaSubtitle:"URSINHO X BOT V2"
                        }

                    );

                }


                if (
                    empate(
                        jogo.tabuleiro
                    )
                ) {

                    partidas.delete(ctx.chat);

                    return sendMenuNative(

                        sock,
                        ctx.chat,

`🎯 𝐉𝐎𝐆𝐎 𝐃𝐀 𝐕𝐄𝐋𝐇𝐀

${mostrarTabuleiro(jogo.tabuleiro)}

🤝 EMPATE!`,

                        [
                            {
                                texto:"🔄 NOVA PARTIDA",
                                id:`${ctx.prefix}jogodavelha novo`
                            },
                            {
                                texto:"🎮 MENU JOGOS",
                                id:`${ctx.prefix}menujogos`
                            }
                        ],

                        {
                            quoted:m
                        }

                    );

                }

            }

        }


        return sendMenuNative(

            sock,
            ctx.chat,

`🎯 𝐉𝐎𝐆𝐎 𝐃𝐀 𝐕𝐄𝐋𝐇𝐀

❌ Você
⭕ Bot

${mostrarTabuleiro(jogo.tabuleiro)}

Sua vez:

Use:
${ctx.prefix}jogodavelha número

Exemplo:
${ctx.prefix}jogodavelha 5`,

            [
                {
                    texto:"🔄 NOVA PARTIDA",
                    id:`${ctx.prefix}jogodavelha novo`
                },
                {
                    texto:"🎮 MENU JOGOS",
                    id:`${ctx.prefix}menujogos`
                }
            ],

            {
                quoted:m,
                media:"principal",
                mediaTitle:"🎯 JOGO DA VELHA",
                mediaSubtitle:"URSINHO X BOT V2"
            }

        );


    }

};
