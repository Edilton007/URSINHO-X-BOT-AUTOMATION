const { sendMenuNative } = require("../../services/mediaService");

const historico = new Map();


const verdades = [
    "Qual foi a maior vergonha que já passaste?",
    "Qual foi a maior mentira que já contaste?",
    "Quem foi a primeira pessoa por quem te apaixonaste?",
    "Qual é o teu maior medo?",
    "Qual foi o dia mais feliz da tua vida?",
    "Qual foi a coisa mais louca que já fizeste?",
    "Qual segredo nunca contaste a ninguém?",
    "Qual pessoa mais te inspira?",
    "Qual é o teu maior sonho?",
    "Já fingiste estar feliz quando não estavas?",
    "Qual foi o teu maior erro?",
    "Qual hábito gostarias de mudar?",
    "Quem é a pessoa mais engraçada que conheces?",
    "Qual foi a pior decisão que já tomaste?",
    "O que mais valorizas numa amizade?",
    "Qual foi a última coisa que te fez rir muito?",
    "Qual é a tua maior qualidade?",
    "Qual é o teu maior defeito?",
    "Já julgaste alguém sem conhecer?",
    "Qual foi a maior surpresa que recebeste?",
    "O que mais gostas em ti?",
    "O que menos gostas em ti?",
    "Qual lugar gostarias de visitar?",
    "Qual é a tua comida favorita?",
    "Qual música nunca cansas de ouvir?",
    "Qual foi o último filme que viste?",
    "Quem é o teu melhor amigo?",
    "Qual foi a situação mais estranha que viveste?",
    "Já te arrependeste de algo?",
    "Qual foi o momento mais emocionante da tua vida?",
    "Qual pessoa gostarias de conhecer?",
    "Qual foi a maior loucura por amor que fizeste?",
    "Já quebraste uma promessa?",
    "Qual é o teu maior objetivo?",
    "O que te deixa feliz rapidamente?",
    "O que te deixa irritado facilmente?",
    "Qual foi o presente mais marcante que recebeste?",
    "Qual é uma coisa que ninguém sabe sobre ti?",
    "Já choraste por alguém?",
    "Qual foi a última vez que pediste desculpa?",
    "Qual foi a coisa mais engraçada que fizeste?",
    "Se pudesses mudar algo no passado, o que seria?",
    "Qual é o teu maior talento?",
    "Qual pessoa confias mais?",
    "Qual é a tua maior motivação?",
    "O que nunca farias?",
    "Qual foi o conselho mais importante que recebeste?",
    "Já ajudaste alguém escondido?",
    "Qual é o teu maior orgulho?",
    "O que significa amizade para ti?",
    "Qual foi a decisão mais difícil que tomaste?",
    "Qual foi o teu primeiro emprego ou trabalho?",
    "Que pessoa marcou a tua vida?",
    "Qual foi o teu maior aprendizado?",
    "Que sonho ainda queres realizar?",
    "Qual coisa te faz perder a paciência?",
    "O que te faz sorrir?",
    "Qual foi o maior desafio que superaste?",
    "O que mudarias no mundo?",
    "Qual é a tua maior esperança?"
];


const desafios = [
    "Envie uma mensagem dizendo: Eu sou o rei do grupo 👑",
    "Faça uma declaração engraçada para alguém do grupo 😂",
    "Mande um áudio cantando uma música.",
    "Dance por 10 segundos e envie um vídeo.",
    "Conte uma piada no grupo.",
    "Mude a foto de perfil por 5 minutos.",
    "Escreva uma frase usando apenas emojis.",
    "Elogie três pessoas do grupo.",
    "Mande uma mensagem positiva para alguém.",
    "Faça uma imitação de alguém famoso.",
    "Envie o último emoji usado no teclado.",
    "Diga uma coisa engraçada sobre você.",
    "Escreva seu nome ao contrário.",
    "Mande uma mensagem como se fosse um robô.",
    "Fale uma frase sem usar a letra A.",
    "Envie um áudio dizendo uma frase engraçada.",
    "Faça uma pergunta aleatória para alguém.",
    "Conte uma história curta engraçada.",
    "Mande um bom dia diferente no grupo.",
    "Use apenas emojis por 2 minutos.",
    "Faça uma cantada engraçada.",
    "Envie uma foto de algo perto de você.",
    "Diga três coisas boas sobre você.",
    "Crie um apelido para alguém do grupo.",
    "Escreva uma frase de motivação.",
    "Faça uma avaliação engraçada do grupo.",
    "Mande uma mensagem usando muitas gírias.",
    "Diga seu maior talento.",
    "Faça uma rima com seu nome.",
    "Escreva uma frase de filme.",
    "Mande um emoji que representa seu humor.",
    "Diga algo que poucas pessoas sabem.",
    "Faça uma promessa engraçada.",
    "Envie uma mensagem de agradecimento.",
    "Faça uma mini apresentação sua.",
    "Diga uma palavra difícil rapidamente.",
    "Crie uma frase usando três palavras escolhidas pelo grupo.",
    "Faça uma imitação de animal.",
    "Mande uma frase misteriosa.",
    "Conte uma memória engraçada.",
    "Diga uma previsão para o futuro.",
    "Faça uma brincadeira com um amigo.",
    "Escreva uma frase em maiúsculas.",
    "Mande uma mensagem usando somente números.",
    "Diga uma curiosidade sobre você.",
    "Crie uma legenda engraçada.",
    "Faça uma homenagem para alguém.",
    "Envie uma mensagem de coragem.",
    "Diga uma coisa que ama fazer.",
    "Faça uma pergunta para o próximo jogador.",
    "Escreva uma frase sem pontuação.",
    "Faça uma saudação diferente.",
    "Mande uma frase motivacional.",
    "Conte uma aventura que viveu.",
    "Faça uma brincadeira de palavras.",
    "Diga um objetivo para este ano.",
    "Envie uma mensagem engraçada.",
    "Faça uma escolha difícil entre duas opções.",
    "Crie uma nova regra para o grupo.",
    "Diga algo positivo sobre alguém."
];


function pegarAleatorio(lista, chat) {

    let usados = historico.get(chat) || [];

    let disponiveis =
        lista.filter(
            item =>
                !usados.includes(item)
        );


    if (!disponiveis.length) {

        usados = [];

        disponiveis = lista;

    }


    const escolhido =
        disponiveis[
            Math.floor(
                Math.random() * disponiveis.length
            )
        ];


    usados.push(escolhido);


    historico.set(
        chat,
        usados.slice(-10)
    );


    return escolhido;

}



module.exports = {

    name: "verdadeoudesafio",

    aliases: [
        "vod",
        "verdade",
        "desafio"
    ],

    category: "jogos",

    description: "Verdade ou desafio",


    run: async (sock, m, ctx) => {


        const escolha =
            String(ctx.args?.[0] || "")
            .toLowerCase();


        let texto;


        if (escolha === "verdade") {

            texto =
`😇 𝐕𝐄𝐑𝐃𝐀𝐃𝐄

❓ ${pegarAleatorio(
    verdades,
    ctx.chat
)}

🐻 URSINHO X BOT V2`;

        }


        else if (escolha === "desafio") {

            texto =
`😈 𝐃𝐄𝐒𝐀𝐅𝐈𝐎

🔥 ${pegarAleatorio(
    desafios,
    ctx.chat
)}

🐻 URSINHO X BOT V2`;

        }


        else {

            texto =
`🔥 𝐕𝐄𝐑𝐃𝐀𝐃𝐄 𝐎𝐔 𝐃𝐄𝐒𝐀𝐅𝐈𝐎

Escolha:

😇 Verdade
😈 Desafio`;

        }



        return sendMenuNative(

            sock,

            ctx.chat,

            texto,

            [
                {
                    texto:"😇 VERDADE",
                    id:`${ctx.prefix}verdadeoudesafio verdade`
                },
                {
                    texto:"😈 DESAFIO",
                    id:`${ctx.prefix}verdadeoudesafio desafio`
                },
                {
                    texto:"🔄 NOVO",
                    id:`${ctx.prefix}verdadeoudesafio`
                },
                {
                    texto:"🎮 MENU JOGOS",
                    id:`${ctx.prefix}menujogos`
                }
            ],

            {
                quoted:m,
                media:"principal",
                mediaTitle:"🔥 VERDADE OU DESAFIO",
                mediaSubtitle:"URSINHO X BOT V2"
            }

        );

    }

};
