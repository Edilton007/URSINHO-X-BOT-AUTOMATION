const competitorDb = require("../../database/competitorDb");

const {
    isAdmin,
    isOwner
} = require("../../services/permissionService");

function normalizarNumero(texto) {

    const numeros = String(texto || "").replace(/[^0-9]/g, "");

    if (!numeros) return null;

    return `${numeros}@s.whatsapp.net`;
}

module.exports = {
    name: "concorrente",

    aliases: [
        "anticoncorrencia",
        "antiConcorrencia"
    ],

    category: "admin",

    permission: "admin",

    description: "Gerir o sistema anti-concorrência do grupo",

    run: async (sock, m, ctx) => {

        if (!ctx.isGroup) {
            return ctx.reply("❌ Este comando só funciona em grupos.");
        }

        const dono = isOwner(ctx.sender);
        const admin = await isAdmin(sock, ctx.chat, ctx.sender);

        if (!dono && !admin) {
            return ctx.reply(
                "❌ Apenas administradores podem usar este comando."
            );
        }

        const [sub, ...resto] = ctx.args;
        const subComando = String(sub || "").toLowerCase();

        const ajuda =
`🛡️ *ANTI-CONCORRÊNCIA*

${ctx.prefix}concorrente on/off — ligar/desligar no grupo
${ctx.prefix}concorrente add <número> [motivo] — adicionar à lista negra
${ctx.prefix}concorrente remove <número> — tirar da lista negra
${ctx.prefix}concorrente lista — ver lista negra deste grupo
${ctx.prefix}concorrente pendentes — ver suspeitos aguardando revisão
${ctx.prefix}concorrente confirmar <número> — remover um suspeito
${ctx.prefix}concorrente aprovar <número> — marcar suspeito como falso positivo
${ctx.prefix}concorrente historico — ver últimas decisões
${ctx.prefix}concorrente marcargrupo on/off — marcar ESTE grupo como concorrência conhecida (pra ajudar outros grupos que administras)`;

        if (!subComando) {
            return ctx.reply(ajuda);
        }

        switch (subComando) {

            case "on": {
                competitorDb.setAtivo(ctx.chat, true);
                return ctx.reply("✅ Anti-concorrência *ativado* neste grupo.");
            }

            case "off": {
                competitorDb.setAtivo(ctx.chat, false);
                return ctx.reply("🔴 Anti-concorrência *desativado* neste grupo.");
            }

            case "add": {

                const numero = resto[0];
                const motivo = resto.slice(1).join(" ");

                const jid = normalizarNumero(numero);

                if (!jid) {
                    return ctx.reply(
                        `❌ Uso: ${ctx.prefix}concorrente add <número> [motivo]`
                    );
                }

                competitorDb.adicionarBlocklist(
                    ctx.chat, jid, motivo, ctx.sender
                );

                return ctx.reply(
                    `✅ Adicionado à lista negra: ${numero}${motivo ? `\n📋 Motivo: ${motivo}` : ""}`
                );
            }

            case "remove": {

                const jid = normalizarNumero(resto[0]);

                if (!jid) {
                    return ctx.reply(
                        `❌ Uso: ${ctx.prefix}concorrente remove <número>`
                    );
                }

                const existia =
                    competitorDb.removerBlocklist(ctx.chat, jid);

                return ctx.reply(
                    existia
                        ? "✅ Removido da lista negra."
                        : "⚠️ Esse número não estava na lista negra."
                );
            }

            case "lista": {

                const lista = competitorDb.listarBlocklist(ctx.chat);

                if (!lista.length) {
                    return ctx.reply("📋 Lista negra vazia neste grupo.");
                }

                const texto = lista.map((item, i) =>
                    `${i + 1}. ${item.jid.split("@")[0]}${item.motivo ? ` — ${item.motivo}` : ""}`
                ).join("\n");

                return ctx.reply(`🛡️ *LISTA NEGRA*\n\n${texto}`);
            }

            case "pendentes": {

                const lista = competitorDb.listarPendentes(ctx.chat);

                if (!lista.length) {
                    return ctx.reply("✅ Nenhum suspeito pendente de revisão.");
                }

                const texto = lista.map((item, i) =>
                    `${i + 1}. ${item.jid.split("@")[0]} — pontuação ${item.pontuacao}`
                ).join("\n");

                return ctx.reply(
                    `⚠️ *SUSPEITOS PENDENTES*\n\n${texto}\n\nUsa *${ctx.prefix}concorrente confirmar <número>* ou *${ctx.prefix}concorrente aprovar <número>*`
                );
            }

            case "confirmar": {

                const jid = normalizarNumero(resto[0]);

                if (!jid) {
                    return ctx.reply(
                        `❌ Uso: ${ctx.prefix}concorrente confirmar <número>`
                    );
                }

                const pendente = competitorDb.obterPendente(ctx.chat, jid);

                competitorDb.adicionarBlocklist(
                    ctx.chat, jid,
                    "Confirmado via revisão manual",
                    ctx.sender
                );

                competitorDb.removerPendente(ctx.chat, jid);

                try {
                    await sock.groupParticipantsUpdate(
                        ctx.chat, [jid], "remove"
                    );
                } catch (error) {
                    console.error(
                        "Erro ao remover confirmado:",
                        error?.message || error
                    );
                }

                competitorDb.registarHistorico(ctx.chat, {
                    jid,
                    pushName: pendente?.pushName || "",
                    decisao: "removido",
                    pontuacao: pendente?.pontuacao || 100,
                    sinais: pendente?.sinais || [{ tipo: "revisao_manual", pontos: 100, detalhe: "Confirmado manualmente por admin" }]
                });

                return ctx.reply("✅ Confirmado e removido do grupo.");
            }

            case "aprovar": {

                const jid = normalizarNumero(resto[0]);

                if (!jid) {
                    return ctx.reply(
                        `❌ Uso: ${ctx.prefix}concorrente aprovar <número>`
                    );
                }

                competitorDb.adicionarWhitelist(ctx.chat, jid);

                return ctx.reply(
                    "✅ Marcado como falso positivo — não será mais sinalizado."
                );
            }

            case "historico": {

                const lista = competitorDb.listarHistorico(ctx.chat, 15);

                if (!lista.length) {
                    return ctx.reply("📋 Sem histórico ainda neste grupo.");
                }

                const texto = lista.map(item => {
                    const data = new Date(item.data).toLocaleString("pt-PT");
                    return `• ${item.jid.split("@")[0]} — ${item.decisao} (${item.pontuacao} pts) — ${data}`;
                }).join("\n");

                return ctx.reply(`🛡️ *HISTÓRICO ANTI-CONCORRÊNCIA*\n\n${texto}`);
            }

            case "marcargrupo": {

                const valor = resto[0]?.toLowerCase();

                if (valor !== "on" && valor !== "off") {
                    return ctx.reply(
                        `❌ Uso: ${ctx.prefix}concorrente marcargrupo on/off`
                    );
                }

                competitorDb.marcarGrupoComoConcorrente(
                    ctx.chat, valor === "on"
                );

                return ctx.reply(
                    valor === "on"
                        ? "✅ Este grupo agora está marcado como *concorrência conhecida*. Pessoas aqui presentes vão pesar mais em outros grupos que administras."
                        : "🔴 Este grupo já não está marcado como concorrência conhecida."
                );
            }

            default:
                return ctx.reply(ajuda);
        }
    }
};
