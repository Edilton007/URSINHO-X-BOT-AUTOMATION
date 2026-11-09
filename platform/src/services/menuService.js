function buildAutoMenu(categories, prefix = ".") {

    const nomes = {
        info: "ℹ️ INFO",
        owner: "👑 DONO",
        admin: "🛡️ ADMIN",
        vendas: "💰 VENDAS",
        downloads: "📥 DOWNLOADS",
        ia: "🤖 IA",
        jogos: "🎮 JOGOS",
        seguranca: "🔐 SEGURANÇA"
    };

    const ordem = [
        "info",
        "owner",
        "admin",
        "vendas",
        "downloads",
        "ia",
        "jogos",
        "seguranca"
    ];

    let menu = [
        "╔══════════════════════╗",
        "║ 🤖 URSINHO X BOT V2",
        "╚══════════════════════╝"
    ].join("\n");

    for (const categoria of ordem) {

        let comandos = [];

        if (categoria === "admin") {

            for (const [cat, lista] of Object.entries(categories)) {

                if (
                    cat === "admin" ||
                    cat.startsWith("admin-")
                ) {
                    comandos.push(...lista);
                }
            }

        } else {

            comandos = categories[categoria] || [];

        }

        if (!Array.isArray(comandos) || comandos.length === 0) {
            continue;
        }

        menu += `\n\n${nomes[categoria] || categoria.toUpperCase()}\n`;

        for (const cmd of comandos) {

            menu += `├ ${prefix}${cmd.name}`;

            if (cmd.description) {
                menu += ` — ${cmd.description}`;
            }

            menu += "\n";
        }
    }

    menu += "\n🐻 URSINHO X BOT V2";

    return menu;
}


function getCategoryMedia(category) {

    const media = {
        owner: "owner",
        admin: "admin",
        vendas: "vendas",
        downloads: "downloads",
        ia: "ia",
        jogos: "jogos",
        seguranca: "seguranca",
        info: "principal"
    };

    return media[category] || "principal";
}


module.exports = {
    buildAutoMenu,
    getCategoryMedia
};
