const { listCodes } = require("../../services/rentalService");
const { isOwner } = require("../../services/permissionService");

module.exports = {
    name: "listacodigos",
    aliases: ["codigos"],
    category: "owner",
    permission: "owner",
    description: "Central de códigos de licença",

    run: async (sock, m, ctx) => {
        if (!isOwner(ctx.sender)) {
            return ctx.reply(
                "❌ Apenas o dono pode usar este comando."
            );
        }

        const codes = listCodes();

        if (!codes.length) {
            return ctx.reply(
                "╭──────────────────────────────╮\n" +
                "│ 🔐 CENTRAL DE LICENÇAS       │\n" +
                "│      URSINHO X BOT V2        │\n" +
                "╰──────────────────────────────╯\n\n" +
                "📭 Nenhum código de licença foi criado.\n\n" +
                "🐻 URSINHO X BOT V2\n" +
                "by Edilton Ronaldo"
            );
        }

        const now = Date.now();

        let ativas = 0;
        let disponiveis = 0;
        let expiradas = 0;

        const ativos = [];
        const disponiveisLista = [];
        const expirados = [];

        for (const item of codes) {
            const usedBy = Array.isArray(item.usedBy)
                ? item.usedBy
                : [];

            const maxUses = Number(item.maxUses) || 1;
            const usos = usedBy.length;

            const expiresAt = Number(item.expiresAt) || 0;

            const registro = {
                code: item.code,
                duration: item.duration,
                usos,
                maxUses,
                expiresAt
            };

            if (usos === 0) {
                disponiveis++;
                disponiveisLista.push(registro);
                continue;
            }

            if (expiresAt && expiresAt > now) {
                ativas++;
                ativos.push(registro);
                continue;
            }

            if (expiresAt) {
                expiradas++;
                expirados.push(registro);
                continue;
            }

            ativas++;
            ativos.push(registro);
        }

        const total = codes.length;

        const formatDate = (timestamp) => {
            if (!timestamp) {
                return "Data não disponível";
            }

            return new Date(timestamp).toLocaleString("pt-PT", {
                dateStyle: "short",
                timeStyle: "short"
            });
        };

        const criarBloco = (item, status, extra) => {
            return (
                `┌─ ${item.code}\n` +
                `│ ⏱️ Duração: ${item.duration}\n` +
                `│ 👥 Uso: ${item.usos}/${item.maxUses}\n` +
                `│ ${status}\n` +
                `│ 📅 ${extra}\n` +
                `└──────────────────────────────\n`
            );
        };

        let texto =
            "╭──────────────────────────────╮\n" +
            "│ 🔐 CENTRAL DE LICENÇAS       │\n" +
            "│      URSINHO X BOT V2        │\n" +
            "╰──────────────────────────────╯\n\n" +

            "📊 VISÃO GERAL\n\n" +
            `🟢 Ativas        ${ativas}\n` +
            `🟡 Disponíveis   ${disponiveis}\n` +
            `🔴 Expiradas     ${expiradas}\n` +
            `📦 Total         ${total}\n\n` +

            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        if (ativos.length) {
            texto += "\n🟢 LICENÇAS ATIVAS\n\n";

            for (const item of ativos) {
                texto += criarBloco(
                    item,
                    "🟢 Licença ativa",
                    `Expira: ${formatDate(item.expiresAt)}`
                );
            }
        }

        if (disponiveisLista.length) {
            texto += "\n🟡 LICENÇAS DISPONÍVEIS\n\n";

            for (const item of disponiveisLista) {
                texto += criarBloco(
                    item,
                    "🔓 Pronta para ativação",
                    "Expira: após ativação"
                );
            }
        }

        if (expirados.length) {
            texto += "\n🔴 LICENÇAS EXPIRADAS\n\n";

            for (const item of expirados) {
                texto += criarBloco(
                    item,
                    "🔴 Licença expirada",
                    `Expirou: ${formatDate(item.expiresAt)}`
                );
            }
        }

        texto +=
            "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
            "🐻 URSINHO X BOT V2\n" +
            "by Edilton Ronaldo";

        return ctx.reply(texto);
    }
};
