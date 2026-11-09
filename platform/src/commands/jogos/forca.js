const { sendMenuNative } = require("../../services/mediaService");

const partidas = new Map();

const palavras = [
    {
        palavra: "URSINHO",
        dica: "Nome do bot 🐻"
    },
    {
        palavra: "MOZAMBIQUE",
        dica: "País da África"
    },
    {
        palavra: "WHATSAPP",
        dica: "Aplicativo de mensagens"
    },
    {
        palavra: "COMPUTADOR",
        dica: "Máquina usada para tecnologia"
    },
    {
        palavra: "PROGRAMADOR",
        dica: "Pessoa que cria códigos"
    },
    {
        palavra: "TECNOLOGIA",
        dica: "Área de inovação"
    },
    {
        palavra: "ELEFANTE",
        dica: "Animal grande"
    },
    {
        palavra: "FUTEBOL",
        dica: "Esporte popular"
    }
];


function iniciarJogo(chat) {

    const escolha =
        palavras[
            Math.floor(Math.random() * palavras.length)
        ];

    const jogo = {

        palavra: escolha.palavra,

        dica: escolha.dica,

        letras: [],

        erros: [],

        vidas: 6

    };

    partidas.set(chat, jogo);

    return jogo;

}


function mostrarPalavra(jogo) {

    return jogo.palavra
        .split("")
        .map(letra =>
            jogo.letras.includes(letra)
                ? letra
                : "_"
        )
        .join(" ");

}


module.exports = {

    name: "forca",

    aliases: [
        "hangman"
    ],

    category: "jogos",

    description: "Jogo da forca",


    run: async (sock, m, ctx) => {


        let jogo =
            partidas.get(ctx.chat);


        const letra =
            String(ctx.args?.[0] || "")
            .toUpperCase();


        if (!jogo || letra === "NOVO") {

            jogo = iniciarJogo(ctx.chat);

        }


        else if (
            letra.length === 1 &&
            /^[A-Z]$/.test(letra)
        ) {


            if (!jogo.letras.includes(letra) &&
                !jogo.erros.includes(letra)) {


                if (jogo.palavra.includes(letra)) {

                    jogo.letras.push(letra);

                } else {

                    jogo.erros.push(letra);

                    jogo.vidas--;

                }

            }

        }


        const estado =
            mostrarPalavra(jogo);


        const venceu =
            !estado.includes("_");


        const perdeu =
            jogo.vidas <= 0;


        let texto = `
❓ 𝐉𝐎𝐆𝐎 𝐃𝐀 𝐅𝐎𝐑𝐂𝐀

🐻 URSINHO X BOT V2

🔤 Palavra:

${estado}


❤️ Vidas:
${jogo.vidas}/6


❌ Letras erradas:

${jogo.erros.length
    ? jogo.erros.join(", ")
    : "-"}


💡 Dica:
${jogo.dica}

`;


        if (venceu) {

            texto += `
🎉 PARABÉNS!

Você descobriu:

${jogo.palavra}

🏆 Vitória!
`;

            partidas.delete(ctx.chat);

        }


        else if (perdeu) {

            texto += `
💀 GAME OVER!

A palavra era:

${jogo.palavra}

Tente novamente!
`;

            partidas.delete(ctx.chat);

        }


        else {

            texto += `
✏️ Digite uma letra:

Exemplo:
${ctx.prefix}forca A
`;

        }


        const buttons = [

            {
                texto: "🔄 NOVA PARTIDA",
                id: `${ctx.prefix}forca novo`
            },

            {
                texto: "🎮 MENU JOGOS",
                id: `${ctx.prefix}menujogos`
            }

        ];


        return sendMenuNative(

            sock,

            ctx.chat,

            texto,

            buttons,

            {

                quoted: m,

                media: "principal",

                mediaTitle: "❓ FORCA",

                mediaSubtitle:
                    "URSINHO X BOT V2"

            }

        );


    }

};
