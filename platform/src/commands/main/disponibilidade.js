"use strict";

const automationBridge = require("../../services/automationBridgeService");
const { isSalesEnabled } = require("../../services/salesService");

function parseMegas(input) {
    const value = String(input || "").trim().toLowerCase().replace(",", ".");
    const match = value.match(/^(\d+(?:\.\d+)?)(mb|gb)$/);
    if (!match) return null;

    const amount = Number(match[1]);
    const megas = match[2] === "gb" ? amount * 1024 : amount;
    if (!Number.isSafeInteger(megas) || megas < 100 || megas > 10240) return null;
    return megas;
}

function formatMethod(method) {
    const label = String(method.nome || method.tipo || "Pagamento").trim();
    const account = String(method.conta || "").trim();
    const bank = String(method.banco || "").trim();
    const holder = String(method.titular || "").trim();
    const instructions = String(method.instrucoes || "").trim();
    return "• " + label + ": " + [account, bank, holder, instructions].filter(Boolean).join(" | ");
}

module.exports = {
    name: "disponibilidade",
    aliases: ["verificartransferencia", "verificarpedido"],
    category: "main",
    description: "Verificar se existe capacidade para um pedido de Internet antes do pagamento",

    run: async (sock, m, ctx) => {
        try {
            if (!ctx.isGroup || !ctx.chat) {
                return ctx.reply("Este comando só funciona no grupo de vendas associado ao URSINHO X AUTOMATION.");
            }

            if (!automationBridge.isAutomationEnabledForGroup(ctx.chat)) {
                return ctx.reply("Este grupo ainda não está associado ao URSINHO X AUTOMATION.");
            }

            if (!isSalesEnabled(ctx.chat)) {
                return ctx.reply("As vendas deste grupo estão desactivadas. Contacta um administrador.");
            }

            const args = Array.isArray(ctx.args) ? ctx.args : [];
            const megas = parseMegas(args[0]);
            const destino = String(args[1] || "").replace(/\D/g, "");

            if (!megas || !/^(?:258)?(?:84|85)\d{7}$/.test(destino)) {
                return ctx.reply(
                    "Formato: " + ctx.prefix + "disponibilidade 1gb 841234567\n" +
                    "Pacotes aceites: 100 MB a 10 GB. Usa um número Vodacom 84/85."
                );
            }

            const result = automationBridge.preverDisponibilidadePedido({
                groupId: ctx.chat,
                recipientNumber: destino,
                megas
            });

            if (!result.disponivel) {
                return ctx.reply(
                    "⚠️ *PEDIDO NÃO AUTORIZADO PARA PAGAMENTO*\n\n" +
                    (result.motivo || result.error || "Não foi possível confirmar a capacidade operacional.") +
                    "\n\nNão efectues o pagamento ainda. Tenta novamente mais tarde ou contacta um administrador."
                );
            }

            const checkout = automationBridge.obterCheckoutGrupo({
                groupId: ctx.chat,
                megas
            });
            if (!checkout.ok) {
                return ctx.reply(
                    "✅ Existe capacidade operacional neste momento, mas o checkout não está pronto.\n\n" +
                    (checkout.error || "O pacote ou os métodos de pagamento não estão configurados.") +
                    "\n\nNão efectues pagamento até o Tenant configurar os dados em falta."
                );
            }

            const productLine = checkout.produto
                ? "Produto: *" + checkout.produto.nome + "*\nPreço: *" + Number(checkout.produto.precoMT).toFixed(2) + " MT*\n"
                : "Pacote: *" + megas + " MB*\n" + (checkout.tabela ? "*Tabela de preços:*\n" + checkout.tabela + "\n" : "");

            const payments = checkout.metodosPagamento.map(formatMethod);
            return ctx.reply(
                "✅ *CAPACIDADE OPERACIONAL CONFIRMADA*\n\n" +
                productLine +
                "Destino: *" + destino + "*\n\n" +
                "A disponibilidade foi verificada agora. A SIM e a quota serão verificadas novamente depois da confirmação do pagamento.\n\n" +
                "*Métodos de pagamento configurados:*\n" + payments.join("\n") +
                "\n\nDepois do pagamento, envia o comprovativo neste grupo. O OCR verifica os dados identificáveis do comprovativo; a entrada efectiva do dinheiro continua sujeita à confirmação administrativa ou a uma integração oficial do prestador."
            );
        } catch (error) {
            console.error("[DISPONIBILIDADE] Erro:", error?.message || error);
            return ctx.reply("Não foi possível verificar a disponibilidade agora. Nenhum pagamento deve ser efectuado até nova confirmação.");
        }
    }
};
