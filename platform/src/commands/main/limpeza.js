const {
    limparAgora,
    estatisticas
} = require("../../services/cleanupService");

const {
    estadoDaFila
} = require("../../services/downloadQueueService");

module.exports = {

    name: "limpeza",

    aliases: [
        "limpar-downloads",
        "cleanup"
    ],

    category: "owner",

    permission: "owner",

    description: "Ver e limpar os ficheiros baixados (downloads/tmp)",

    run: async (
        sock,
        m,
        ctx
    ) => {

        if (ctx.permission !== "owner") {
            return ctx.reply(
                "❌ Este comando é exclusivo do proprietário."
            );
        }

        const opcao =
            String(ctx.args?.[0] || "")
                .toLowerCase()
                .trim();

        let extra = "";

        if (opcao === "agora") {

            const r = limparAgora();

            extra =
                `\n🧹 Limpeza feita: ${r.removidos} ficheiro(s), ${(r.bytes / 1024 / 1024).toFixed(1)} MB libertados.\n`;

        } else if (opcao === "tudo") {

            // Apaga tudo o que tem mais de 2 minutos e não está em uso
            const r = limparAgora({ minIdade: 2 * 60 * 1000 });

            extra =
                `\n🧹 Limpeza total: ${r.removidos} ficheiro(s), ${(r.bytes / 1024 / 1024).toFixed(1)} MB libertados.\n`;
        }

        const s = estatisticas();
        const fila = estadoDaFila();

        return ctx.reply(
`╭━━━〔 🧹 LIMPEZA 〕━━━╮
┃
┃ 📥 Downloads: ${s.downloads} ficheiro(s) • ${s.downloadsMB} MB
┃ 🗂️ Temporários: ${s.temporarios} • ${s.temporariosMB} MB
┃ ⏳ Mais antigo: ${s.maisAntigoHoras ?? "—"} h
┃
┃ ♻️ Apagados após: ${s.ttlHoras} h
┃ 📦 Limite: ${s.limiteMB} MB
┃ ⚙️ Fila: ${fila.ativos}/${fila.limite} ativos, ${fila.aEsperar} à espera
${extra}┃
┃ ${ctx.prefix}limpeza agora → limpar já
┃ ${ctx.prefix}limpeza tudo → apagar tudo
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
        );
    }
};
