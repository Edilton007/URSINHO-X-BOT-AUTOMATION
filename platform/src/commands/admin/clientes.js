const { isAdmin } = require("../../services/permissionService");

const {
    getCustomers
} = require("../../services/salesService");

/*
============================================================
NORMALIZAR JID
============================================================
*/
function cleanJid(value) {
    if (!value) {
        return "";
    }

    return String(value).trim();
}

/*
============================================================
NÚMERO PURO
============================================================
*/
function cleanNumber(value) {
    return String(value || "")
        .replace("@s.whatsapp.net", "")
        .replace("@lid", "")
        .replace(/\D/g, "");
}

/*
============================================================
RESOLVER PARTICIPANTE REAL
============================================================
*/
async function resolveParticipantJid(
    sock,
    groupId,
    customerNumber
) {
    const number = cleanNumber(customerNumber);

    if (!number) {
        return null;
    }

    /*
    ==============================================
    1. PROCURAR NOS PARTICIPANTES DO GRUPO
    ==============================================
    */

    try {
        const metadata = await sock.groupMetadata(groupId);

        const participants =
            metadata?.participants || [];

        for (const participant of participants) {

            const candidates = [
                participant?.id,
                participant?.jid,
                participant?.lid,
                participant?.phoneNumber
            ]
                .filter(Boolean)
                .map(cleanJid);

            for (const candidate of candidates) {

                if (
                    cleanNumber(candidate) === number
                ) {
                    return candidate;
                }
            }
        }

    } catch (e) {

        console.log(
            "[CLIENTES] Não foi possível obter participantes:",
            e.message
        );
    }

    /*
    ==============================================
    2. RESOLVER PELO WHATSAPP
    ==============================================
    */

    try {

        if (typeof sock.onWhatsApp === "function") {

            const result =
                await sock.onWhatsApp(number);

            if (
                Array.isArray(result) &&
                result.length > 0
            ) {

                const found =
                    result.find(
                        item => item?.jid
                    );

                if (found?.jid) {
                    return cleanJid(found.jid);
                }
            }
        }

    } catch (e) {

        console.log(
            "[CLIENTES] Erro ao resolver JID:",
            e.message
        );
    }

    /*
    ==============================================
    3. FALLBACK
    ==============================================
    */

    return `${number}@s.whatsapp.net`;
}

/*
============================================================
COMANDO
============================================================
*/
module.exports = {

    name: "clientes",

    /*
     * Não usamos "clientes" como alias porque o próprio
     * nome do comando já é "clientes".
     */

    category: "admin-vendas",

    permission: "admin",

    description: "Ranking de clientes do grupo",

    run: async (
        sock,
        m,
        ctx
    ) => {

        try {

            /*
            ==========================================
            PERMISSÃO
            ==========================================
            */

            const admin =
                await isAdmin(
                    sock,
                    ctx.chat,
                    ctx.sender
                );

            if (!admin) {

                return ctx.reply(
                    "❌ Apenas administradores podem usar este comando."
                );
            }

            /*
            ==========================================
            CLIENTES DO GRUPO
            ==========================================
            */

            const customers =
                getCustomers(ctx.chat) || [];

            /*
             * Só entram clientes com compras
             * realmente registradas.
             */

            const ranking =
                customers
                    .filter(
                        customer =>
                            Number(customer.compras || 0) > 0
                    )
                    .map(customer => ({
                        number:
                            String(customer.number || ""),

                        compras:
                            Number(customer.compras || 0),

                        totalGB:
                            Number(customer.totalGB || 0)
                    }))
                    .filter(customer =>
                        customer.number &&
                        customer.compras > 0
                    )
                    .sort((a, b) => {

                        if (
                            b.totalGB !==
                            a.totalGB
                        ) {

                            return (
                                b.totalGB -
                                a.totalGB
                            );
                        }

                        return (
                            b.compras -
                            a.compras
                        );
                    });

            /*
            ==========================================
            NENHUM CLIENTE
            ==========================================
            */

            if (!ranking.length) {

                return ctx.reply(
                    `╭━━━〔 👥 CLIENTES 〕━━━╮
┃
┃ ⚠️ Ainda não existem clientes
┃ com compras registadas.
┃
╰━━━〔 🐻 URSINHO X BOT 〕━━━╯`
                );
            }

            /*
            ==========================================
            CABEÇALHO
            ==========================================
            */

            let texto =
                `╭━━━〔 🏆 TOP CLIENTES 〕━━━╮
┃
`;

            let totalClientes = 0;
            let totalCompras = 0;
            let totalGB = 0;

            const mentions = [];

            const resolvedClients = [];

            /*
            ==========================================
            RESOLVER CLIENTES
            ==========================================
            */

            for (const cliente of ranking) {

                const jid =
                    await resolveParticipantJid(
                        sock,
                        ctx.chat,
                        cliente.number
                    );

                resolvedClients.push({
                    ...cliente,
                    jid
                });
            }

            /*
            ==========================================
            CONSTRUIR RANKING
            ==========================================
            */

            resolvedClients.forEach(
                (cliente, index) => {

                    const medalha =
                        index === 0
                            ? "🥇"
                            : index === 1
                                ? "🥈"
                                : index === 2
                                    ? "🥉"
                                    : "🔹";

                    totalClientes++;

                    totalCompras +=
                        cliente.compras;

                    totalGB +=
                        cliente.totalGB;

                    /*
                    ==================================
                    JID REAL PARA MENÇÃO
                    ==================================
                    */

                    if (
                        cliente.jid &&
                        cliente.jid !== "@s.whatsapp.net" &&
                        !mentions.includes(
                            cliente.jid
                        )
                    ) {

                        mentions.push(
                            cliente.jid
                        );
                    }

                    /*
                    ==================================
                    NÚMERO PARA EXIBIÇÃO
                    ==================================
                    */

                    let numeroExibicao =
                        cleanNumber(
                            cliente.jid ||
                            cliente.number
                        );

                    if (!numeroExibicao) {

                        numeroExibicao =
                            cleanNumber(
                                cliente.number
                            );
                    }

                    texto +=
                        `┃ ${medalha} ${index + 1}º @${numeroExibicao}
┃    🛒 ${cliente.compras} compra${cliente.compras === 1 ? "" : "s"}
┃    🌐 ${cliente.totalGB.toFixed(2)} GB
┃
`;
                }
            );

            /*
            ==========================================
            RESUMO
            ==========================================
            */

            texto +=
                `┣━━━━━━━━━━━━━━━━━━━━
┃ 📊 RESUMO
┃
┃ 👥 Clientes      ${totalClientes}
┃ 🛒 Compras       ${totalCompras}
┃ 🌐 Total         ${totalGB.toFixed(2)} GB
┃
╰━━━〔 🐻 URSINHO X BOT 〕━━━╯`;

            /*
            ==========================================
            ENVIAR
            ==========================================
            */

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

        } catch (e) {

            console.error(
                "clientes erro:",
                e
            );

            return ctx.reply(
                "❌ Erro ao carregar o ranking de clientes."
            );
        }
    }
};
