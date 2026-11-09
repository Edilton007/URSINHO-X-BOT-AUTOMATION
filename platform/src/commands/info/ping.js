module.exports = {
    name: "ping",
    category: "info",
    description: "Verifica o estado, velocidade e desempenho do bot",

    run: async (sock, m, ctx) => {
        const start = Date.now();

        const uptime = process.uptime();

        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const uptimeText =
            days > 0
                ? `${days}d ${hours}h ${minutes}m ${seconds}s`
                : `${hours}h ${minutes}m ${seconds}s`;

        const memory = process.memoryUsage();
        const memoryMB = Math.round(memory.rss / 1024 / 1024);

        const latency = Date.now() - start;

        let speed = "EXCELENTE";

        if (latency > 500) {
            speed = "LENTA";
        } else if (latency > 200) {
            speed = "BOA";
        } else if (latency > 100) {
            speed = "MUITO BOA";
        }

        const commandCount = Number(ctx.commandCount) || 0;

        await ctx.reply(
`╭━━━〔 🏓 URSINHO X BOT 〕━━━╮
┃
┃ 🟢 SISTEMA ONLINE
┃
┃ ⚡ Latência     ${latency}ms
┃ ⏱️ Uptime       ${uptimeText}
┃ 💾 Memória      ${memoryMB} MB
┃ 📦 Comandos     ${commandCount}
┃ 🚀 Velocidade   ${speed}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━╯
        ʙʏ Edilton Ronaldo`
        );
    }
};
