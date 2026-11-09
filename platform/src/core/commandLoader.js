const fs = require("fs");
const path = require("path");

const COMMANDS_PATH = path.join(
    __dirname,
    "..",
    "commands"
);

/*
============================================================
GRUPOS AUTOMÁTICOS DA IA
============================================================
*/

function getIAGroup(name) {

    const groups = {

        inteligencia: [
            "ai",
            "chat",
            "gemini"
        ],

        ferramentas: [
            "escrever",
            "ler",
            "resumir",
            "traduzir"
        ],

        imagens: [
            "imagem"
        ]

    };

    const commandName =
        String(name || "").toLowerCase();

    for (
        const [group, commands] of Object.entries(groups)
    ) {

        if (commands.includes(commandName)) {
            return group;
        }

    }

    return null;
}

/*
============================================================
CARREGAR COMANDOS
============================================================
*/

function loadCommands() {
    let commandCount = 0;

    const commands = new Map();

    const categories = {};

    function scan(folder) {

        const files =
            fs.readdirSync(folder);

        for (const file of files) {

            const fullPath =
                path.join(folder, file);

            if (fs.statSync(fullPath).isDirectory()) {

                scan(fullPath);

                continue;
            }

            if (!file.endsWith(".js")) {
                continue;
            }

            try {

                const command =
                    require(fullPath);

                if (
                    !command.name ||
                    !command.run
                ) {
                    continue;
                }

                const name =
                    command.name.toLowerCase();

                /*
                ====================================================
                GRUPO IA AUTOMÁTICO
                ====================================================
                */

                if (command.category === "ia") {

                    command.iaGroup =
                        getIAGroup(name);

                }

                /*
                ====================================================
                REGISTAR COMANDO PRINCIPAL
                ====================================================
                */

                commands.set(
                    name,
                    command
                );

                // Conta somente comandos reais, nunca aliases.
                commandCount++;

                /*
                ====================================================
                REGISTAR ALIASES
                ====================================================
                */

                if (
                    Array.isArray(command.aliases)
                ) {

                    for (
                        const alias
                        of command.aliases
                    ) {

                        const aliasName =
                            String(alias || "")
                                .trim()
                                .toLowerCase();

                        if (!aliasName) {
                            continue;
                        }

                        /*
                        Evita substituir outro comando
                        existente.
                        */

                        if (
                            !commands.has(aliasName)
                        ) {

                            commands.set(
                                aliasName,
                                command
                            );

                        }

                    }

                }

                /*
                ====================================================
                CATEGORIA
                ====================================================
                */

                const category =
                    command.category || "outros";

                if (
                    !categories[category]
                ) {

                    categories[category] = [];

                }

                categories[category].push({

                    name:
                        command.name,

                    description:
                        command.description || "",

                    iaGroup:
                        command.iaGroup || null

                });

            } catch (err) {

                console.log(
                    "Erro carregando comando:",
                    file,
                    err.message
                );

            }

        }

    }

    scan(COMMANDS_PATH);

    return {
        commands,
        categories,
        commandCount
    };

}

module.exports = {
    loadCommands
};
