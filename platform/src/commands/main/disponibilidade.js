"use strict";

const automationBridge = require("../../services/automationBridgeService");
const {
    getPayments,
    getVendaIATabela,
    isSalesEnabled
} = require("../../services/salesService");

function parseMegas(input) {
    const value = String(input || "").trim().toLowerCase().replace(",", ".");
    const match = value.match(/^(\d+(?:\.\d+)?)(mb|gb)$/);
    if (!match) return null;

    const amount = Number(match[1]);
    const megas = match[2] === "gb" ? amount * 1024 : amount;
    if (!Number.isSafeInteger(megas) || megas < 100 || megas > 10240) return null;
    return megas;
}

function paymentLines(groupId) {
    const payments = getPayments(groupId) || {};
    const methods = [
        ["mpesa", "M-Pesa"],
        ["emola", "e-Mola"],
        ["bim", "Banco"]
    ];

    return methods
        .map(([key, label]) => {
            const account = payments[key] || {};
            const number = String(account.number || "").trim();
            if (!number) return null;
            const holder = String(account.name || "").trim();
            return "• " + label + ": " + number + (holder ? " (" + holder + ")" : "");
        })
        .filter(Boolean);
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
                return ctx.reply("As vendas deste grupo estão desativadas. Contacta um administrador.");
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

            const payments = paymentLines(ctx.chat);
            if (payments.length === 0) {
                return ctx.reply(
                    "✅ Existe capacidade operacional para este pedido neste momento.\n\n" +
                    "No entanto, ainda não há métodos de pagamento configurados neste grupo. Não efectues pagamento; contacta um administrador."
                );
            }

            const tabela = String(getVendaIATabela(ctx.chat) || "").trim();
            return ctx.reply(
                "✅ *CAPACIDADE OPERACIONAL CONFIRMADA*\n\n" +
                "Pacote: *" + megas + " MB*\n" +
                "Destino: *" + destino + "*\n\n" +
                "A verificação é válida neste momento. A SIM e a quota serão verificadas novamente depois da confirmação do pagamento.\n\n" +
                (tabela ? "*Tabela de preços deste grupo:*\n" + tabela + "\n\n" : "Consulta a tabela de preços publicada pelo grupo antes de pagar.\n\n") +
                "*Métodos de pagamento:*\n" + payments.join("\n") +
                "\n\nDepois do pagamento, envia o comprovativo neste grupo. O comprovativo será analisado e a confirmação do pagamento continua sujeita à verificação administrativa."
            );
        } catch (error) {
            console.error("[DISPONIBILIDADE] Erro:", error?.message || error);
            return ctx.reply("Não foi possível verificar a disponibilidade agora. Nenhum pagamento deve ser efectuado até nova confirmação.");
        }
    }
};
