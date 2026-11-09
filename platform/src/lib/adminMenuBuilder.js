function buildAdminMenu(prefix, categories) {

    const sections = [
        {
            category: "admin-grupo",
            title: "👥 GRUPO"
        },
        {
            category: "admin-grupo-config",
            title: "⚙️ CONFIGURAÇÃO DO GRUPO"
        },
        {
            category: "admin-protecao",
            title: "🛡️ PROTEÇÕES"
        },
        {
            category: "admin-sistema",
            title: "⚙️ SISTEMA"
        },
        {
            category: "admin",
            title: "🛡️ ADMIN"
        },
        {
            category: "admin-vendas",
            title: "💰 VENDAS"
        }
    ];

    let menu = `
╔══════════════════════╗
║ 🛡️ MENU ADMIN
╚══════════════════════╝
`;

    for (const section of sections) {

        const commands = categories[section.category] || [];

        if (!commands.length) {
            continue;
        }

        menu += `
${section.title}:
`;

        for (const cmd of commands) {

            menu += `├ ${prefix}${cmd.name}`;

            if (cmd.description) {
                menu += ` — ${cmd.description}`;
            }

            menu += "\n";
        }
    }

    menu += `
🐻 URSINHO X BOT V2
`;

    return menu.trim();
}

module.exports = {
    buildAdminMenu
};
