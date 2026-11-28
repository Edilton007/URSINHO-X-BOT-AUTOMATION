"use strict";

const automationBridge = require("../../services/automationBridgeService");
const {
    isSalesEnabled,
    criarPedidoAutomationPendente
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

function normalizarDestino(value) {
    let number = String(value || "").replace(/\D/g, "");
    if (number.startsWith("258") && number.length === 12) number = number.slice(3);
    return /^(84|85)\d{7}$/.test(number) ? number : null;
}

function obterSender(ctx, message) {
    const sender = String(ctx.sender || message?.key?.participant || "").trim();
    if (!sender || sender.length > 160 || !sender.includes("@")) return null;
    return sender;
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
    description: "Verificar disponibilidade e iniciar pedido de Internet antes do pagamento",

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
            const destino = normalizarDestino(args[1]);
            const sender = obterSender(ctx, m);

            if (!megas || !destino || !sender) {
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
            if (!checkout.ok || checkout.fonte !== "TENANT" || !checkout.produto) {
                return ctx.reply(
                    "✅ Existe capacidade operacional neste momento, mas o pedido ainda não pode receber pagamento.\n\n" +
                    (checkout.error || "O Tenant ainda não tem um pacote com preço e métodos de pagamento próprios configurados.") +
                    "\n\nO administrador deve concluir a configuração no Tenant App. Não efectues pagamento usando dados antigos do grupo."
                );
            }

            const pending = criarPedidoAutomationPendente(ctx.chat, {
                sender,
                recipientNumber: destino,
                megas,
                expectedAmount: checkout.produto.precoMT,
                productId: checkout.produto.id,
                productName: checkout.produto.nome,
                productCategory: checkout.produto.categoria,
                validityDays: checkout.produto.validadeDias,
                paymentMethods: checkout.metodosPagamento
            });
            if (!pending.ok) {
                return ctx.reply(
                    "Não foi possível registar o pedido em segurança. Nenhum pagamento deve ser efectuado. " +
                    (pending.error || "")
                );
            }

            const payments = checkout.metodosPagamento.map(formatMethod);
            const validade = Number.isSafeInteger(checkout.produto.validadeDias)
                ? checkout.produto.validadeDias + " dia(s)"
                : "Não definida";
            const categoria = String(checkout.produto.categoria || "NAO_DEFINIDA").replace(/_/g, " ");
            return ctx.reply(
                "✅ *PEDIDO PRÉ-VALIDADO*\n\n" +
                "Pedido: *" + pending.pedido.id + "*\n" +
                "Pacote: *" + checkout.produto.nome + "*\n" +
                "Categoria: *" + categoria + "*\n" +
                "Validade configurada: *" + validade + "*\n" +
                "Quantidade: *" + megas + " MB*\n" +
                "Preço exacto: *" + Number(checkout.produto.precoMT).toFixed(2) + " MT*\n" +
                "Destino: *" + destino + "*\n\n" +
                "A capacidade foi confirmada neste momento. Este pedido expira em 30 minutos. A SIM e a quota serão verificadas novamente depois da confirmação do pagamento.\n\n" +
                "*Métodos de pagamento do Tenant:*\n" + payments.join("\n") +
                "\n\nDepois de pagar exactamente o valor indicado, envia o comprovativo neste grupo. O sistema compara o valor e o destinatário; a entrada efectiva do dinheiro continua sujeita à confirmação administrativa ou a uma integração oficial do prestador."
            );
        } catch (error) {
            console.error("[DISPONIBILIDADE] Erro:", error?.message || error);
            return ctx.reply("Não foi possível verificar a disponibilidade agora. Nenhum pagamento deve ser efectuado até nova confirmação.");
        }
    }
};
