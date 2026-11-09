const { sendMenuNative } = require("../../services/mediaService");

const TIPOS = {
    topcorno: {
        titulo: "👑 TOP CORNO",
        emoji: "👑",
        frase: "O grupo já descobriu quem merece a coroa 😂"
    },

    topfiel: {
        titulo: "❤️ TOP FIEL",
        emoji: "❤️",
        frase: "Aqui estão os campeões da fidelidade ❤️"
    },

    topgold: {
        titulo: "💎 TOP GOLD",
        emoji: "💎",
        frase: "Os membros mais valiosos do grupo 💎"
    },

    topgay: {
        titulo: "😂 TOP GAY",
        emoji: "😂",
        frase: "O ranking que ninguém pediu, mas todo mundo quer ver 😂"
    },

    topgostosa: {
        titulo: "🔥 TOP GOSTOSA",
        emoji: "🔥",
        frase: "O grupo ficou quente de repente 🔥😂"
    },

    topgostoso: {
        titulo: "🔥 TOP GOSTOSO",
        emoji: "🔥",
        frase: "A beleza masculina entrou em competição 😎🔥"
    }
};

function embaralhar(lista) {
    const copia = [...lista];

    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [copia[i], copia[j]] = [
            copia[j],
            copia[i]
        ];
    }

    return copia;
}

function obterNome(participante) {
    return (
        participante.name ||
        participante.notify ||
        participante.verifiedName ||
        participante.id.split("@")[0]
    );
}

function formatarMencao(participante) {
    return `@${participante.id.split("@")[0]}`;
}

function gerarPontuacao() {
    return Math.floor(Math.random() * 100) + 1;
}

async function executarRanking(sock, m, ctx, tipo) {

    const config = TIPOS[tipo];

    if (!config) {
        return ctx.reply("❌ Ranking não encontrado.");
    }

    if (!ctx.isGroup) {
        return ctx.reply(
            "❌ Este jogo só pode ser usado em grupos."
        );
    }

    try {

        const metadata = await sock.groupMetadata(ctx.chat);

        let participantes = Array.isArray(metadata.participants)
            ? metadata.participants
            : [];

        participantes = participantes.filter(
            participante =>
                participante &&
                participante.id &&
                !participante.id.endsWith("@broadcast") &&
                !participante.id.endsWith("@newsletter")
        );

        if (sock.user?.id) {

            const botId = sock.user.id.split(":")[0];

            participantes = participantes.filter(
                participante =>
                    participante.id.split(":")[0] !== botId
            );
        }

        if (!participantes.length) {
            return ctx.reply(
                "❌ Não encontrei participantes suficientes para fazer o ranking."
            );
        }

        const escolhidos = embaralhar(participantes)
            .slice(0, 5)
            .map(participante => ({
                ...participante,
                pontos: gerarPontuacao()
            }))
            .sort(
                (a, b) => b.pontos - a.pontos
            );

        const medalhas = [
            "🥇",
            "🥈",
            "🥉",
            "4️⃣",
            "5️⃣"
        ];

        const linhas = escolhidos.map(
            (participante, index) =>
                `${medalhas[index]} ${formatarMencao(participante)} — ${participante.pontos}%`
        );

        const texto = `
${config.emoji} 𝐑𝐀𝐍𝐊𝐈𝐍𝐆
${config.titulo}

${linhas.join("\n")}

${config.frase}

🐻 𝐔𝐑𝐒𝐈𝐍𝐇𝐎 𝐗 𝐁𝐎𝐓 𝐕𝟐
𝐛𝐲 𝐄𝐝𝐢𝐥𝐭𝐨𝐧 𝐑𝐨𝐧𝐚𝐥𝐝𝐨
`;

        const mentions = escolhidos.map(
            participante => participante.id
        );

        return sock.sendMessage(
            ctx.chat,
            {
                text: texto,
                mentions
            },
            {
                quoted: m
            }
        );

    } catch (error) {

        console.error(
            "[RANKING] Erro:",
            error.message
        );

        return ctx.reply(
            "❌ Não foi possível criar o ranking agora."
        );
    }
}

module.exports = {

    name: "ranking",

    aliases: [
        "rank"
    ],

    category: "jogos",

    description: "Jogo de rankings do grupo",

    run: async (sock, m, ctx) => {

        const escolha = String(
            ctx.args?.[0] || ""
        ).toLowerCase();

        if (escolha && TIPOS[escolha]) {
            return executarRanking(
                sock,
                m,
                ctx,
                escolha
            );
        }

        const texto = `
🏆 𝐑𝐀𝐍𝐊𝐈𝐍𝐆

Escolha um ranking:

👑 TOP CORNO
❤️ TOP FIEL
💎 TOP GOLD
😂 TOP GAY
🔥 TOP GOSTOSA
🔥 TOP GOSTOSO
`;

        const buttons = [

            {
                texto: "👑 TOP CORNO",
                id: `${ctx.prefix}ranking topcorno`
            },

            {
                texto: "❤️ TOP FIEL",
                id: `${ctx.prefix}ranking topfiel`
            },

            {
                texto: "💎 TOP GOLD",
                id: `${ctx.prefix}ranking topgold`
            },

            {
                texto: "😂 TOP GAY",
                id: `${ctx.prefix}ranking topgay`
            },

            {
                texto: "🔥 TOP GOSTOSA",
                id: `${ctx.prefix}ranking topgostosa`
            },

            {
                texto: "🔥 TOP GOSTOSO",
                id: `${ctx.prefix}ranking topgostoso`
            },

            {
                texto: "⬅️ VOLTAR JOGOS",
                id: `${ctx.prefix}menujogos`
            },

            {
                texto: "🏠 MENU PRINCIPAL",
                id: `${ctx.prefix}menu`
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
                mediaTitle: "🏆 RANKING",
                mediaSubtitle: "JOGOS E ENTRETENIMENTO"
            }
        );
    }
};
