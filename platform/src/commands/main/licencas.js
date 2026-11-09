const db = require("../../database/database");
const { isOwner } = require("../../services/permissionService");
const { duracaoTexto } = require("../../services/licenseWatchService");

function dataHora(ms) {
    return new Date(ms).toLocaleString("pt-PT", {
        timeZone: "Africa/Maputo",
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

module.exports = {

    name: "licencas",
    aliases: ["licencasgrupos", "gruposalugados"],
    category: "owner",
    permission: "owner",
    description: "Ver a licença de todos os grupos",

    run: async (sock, m, ctx) => {

        if (!isOwner(ctx.sender)) {
            return ctx.reply("❌ Apenas o dono pode usar este comando.");
        }

        // Nomes atuais de todos os grupos (uma só chamada)
        let nomes = {};
        try {
            const todos = await sock.groupFetchAllParticipating();
            for (const [jid, meta] of Object.entries(todos || {})) {
                nomes[jid] = meta?.subject;
            }
        } catch {}

        const agora = Date.now();
        const ativas = [];
        const expiradas = [];

        for (const [jid, g] of Object.entries(db.groups || {})) {

            const expira = Number(g.rentalExpiresAt);
            if (!jid.endsWith("@g.us") || !expira) continue;

            const nome = nomes[jid] || g.rentalGroupName || "Grupo sem nome";

            if (expira > agora) {
                ativas.push({ nome, expira });
            } else {
                expiradas.push({ nome, expira });
            }
        }

        ativas.sort((a, b) => a.expira - b.expira);
        expiradas.sort((a, b) => b.expira - a.expira);

        if (!ativas.length && !expiradas.length) {
            return ctx.reply(
`🗂️ *LICENÇAS DOS GRUPOS*

Nenhum grupo tem licença ainda.
Para criar uma: *${ctx.prefix}gerarcodigo 30d*`
            );
        }

        const icone = (ms) =>
            ms <= 24 * 3600000 ? "🔴" : ms <= 72 * 3600000 ? "🟡" : "🟢";

        let texto = `🗂️ *LICENÇAS DOS GRUPOS*\n`;

        if (ativas.length) {
            texto += `\n✅ *ATIVAS (${ativas.length})* — as que acabam primeiro vêm no topo\n`;
            for (const a of ativas.slice(0, 25)) {
                texto +=
`\n${icone(a.expira - agora)} *${a.nome}*
   faltam ${duracaoTexto(a.expira - agora)} · até ${dataHora(a.expira)}`;
            }
            if (ativas.length > 25) texto += `\n\n… e mais ${ativas.length - 25}`;
        }

        if (expiradas.length) {
            texto += `\n\n⛔ *EXPIRADAS (${expiradas.length})*\n`;
            for (const e of expiradas.slice(0, 15)) {
                texto +=
`\n⚫ *${e.nome}*
   acabou há ${duracaoTexto(agora - e.expira)} · ${dataHora(e.expira)}`;
            }
            if (expiradas.length > 15) texto += `\n\n… e mais ${expiradas.length - 15}`;
        }

        texto += `\n\n🔴 menos de 1 dia · 🟡 menos de 3 dias · 🟢 mais de 3 dias`;

        return ctx.reply(texto);
    }
};
