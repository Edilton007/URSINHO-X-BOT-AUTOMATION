const { generateCode } = require("../../services/rentalService");
const { isOwner } = require("../../services/permissionService");
const { sendMenuNative } = require("../../services/mediaService");

module.exports = {
    name: "gerarcodigo",
    aliases: ["gencodigo"],
    category: "owner",
    permission: "owner",
    description: "Gerar código de aluguel",

    run: async (sock, m, ctx) => {

        if (!isOwner(ctx.sender)) {
            return ctx.reply(
                "❌ Apenas o dono pode usar este comando."
            );
        }

        const args = ctx.args || [];
        const duration = args[0];
        const uses = args[1] || 1;

        /*
        ============================================================
        SELEÇÃO DE DURAÇÃO
        ============================================================
        */

        if (!duration) {

            const menu = `🔐 GERADOR DE LICENÇAS

Escolha a duração da licença:

⏱️ 1 hora
📅 7 dias
📅 30 dias
📅 90 dias
📅 180 dias
👑 365 dias

✏️ Duração personalizada:
${ctx.prefix}gerarcodigo 32d`;

            const buttons = [
                {
                    texto: "⏱️ 1 HORA",
                    id: `${ctx.prefix}gerarcodigo 1h`
                },
                {
                    texto: "📅 7 DIAS",
                    id: `${ctx.prefix}gerarcodigo 7d`
                },
                {
                    texto: "📅 30 DIAS",
                    id: `${ctx.prefix}gerarcodigo 30d`
                },
                {
                    texto: "📅 90 DIAS",
                    id: `${ctx.prefix}gerarcodigo 90d`
                },
                {
                    texto: "📅 180 DIAS",
                    id: `${ctx.prefix}gerarcodigo 180d`
                },
                {
                    texto: "👑 365 DIAS",
                    id: `${ctx.prefix}gerarcodigo 365d`
                },
                {
                    texto: "✏️ OUTRA DURAÇÃO",
                    id: `${ctx.prefix}gerarcodigo outro`
                }
            ];

            try {

                await sendMenuNative(
                    sock,
                    ctx.chat,
                    menu,
                    buttons,
                    {
                        quoted: m
                    }
                );

                return;

            } catch (error) {

                console.error(
                    "❌ Erro no seletor de duração:",
                    error?.message || error
                );

                return ctx.reply(
                    `🔐 GERADOR DE LICENÇAS

Use:

${ctx.prefix}gerarcodigo 1h
${ctx.prefix}gerarcodigo 7d
${ctx.prefix}gerarcodigo 30d
${ctx.prefix}gerarcodigo 90d
${ctx.prefix}gerarcodigo 180d
${ctx.prefix}gerarcodigo 365d

Personalizado:
${ctx.prefix}gerarcodigo 32d`
                );
            }
        }

        /*
        ============================================================
        DURAÇÃO PERSONALIZADA
        ============================================================
        */

        if (duration.toLowerCase() === "outro") {

            return ctx.reply(
                `✏️ DURAÇÃO PERSONALIZADA

Exemplos:

${ctx.prefix}gerarcodigo 12h
${ctx.prefix}gerarcodigo 60m
${ctx.prefix}gerarcodigo 32d
${ctx.prefix}gerarcodigo 365d`
            );
        }

        /*
        ============================================================
        GERAR CÓDIGO
        ============================================================
        */

        const result = generateCode(duration, uses);

        if (result.error) {
            return ctx.reply(
                "❌ " + result.error
            );
        }

        const mensagem = `╭────────────────────────╮
│   🔐 LICENÇA GERADA    │
╰────────────────────────╯

🎟️ CÓDIGO
${result.code}

⏱️ DURAÇÃO
${duration}

🔢 USOS
${uses}

━━━━━━━━━━━━━━━━━━━━
🐻 URSINHO X BOT V2
by Edilton Ronaldo`;

        try {
            await sendMenuNative(
                sock,
                ctx.chat,
                mensagem,
                [
                    {
                        tipo: "cta_copy",
                        texto: "📋 COPIAR CÓDIGO",
                        codigo: result.code
                    }
                ],
                {
                    quoted: m
                }
            );

            return;
        } catch (error) {
            console.error(
                "❌ Erro ao enviar botão de copiar:",
                error?.message || error
            );

            return ctx.reply(mensagem);
        }
    }
};
