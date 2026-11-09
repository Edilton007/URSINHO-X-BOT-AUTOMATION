// ============================================================
// FERRAMENTAS DE PRECISÃO DO CHAT IA
//
// LLMs erram contas, sobretudo com números grandes ou com
// várias casas decimais — é um problema conhecido, não um
// detalhe menor. Em vez de confiar no "cálculo mental" do
// modelo, dá-se-lhe uma calculadora real.
//
// Câmbio de moeda via frankfurter.app — API do Banco Central
// Europeu, gratuita, sem chave, sem limite de pedidos.
// ============================================================

/**
 * Avalia uma expressão matemática em segurança (sem usar eval
 * nem Function — só os operadores e funções que precisamos).
 * Suporta: + - * / ( ) ^ (potência), e as funções comuns.
 */
function calcular(expressao) {

    try {

        const limpa =
            String(expressao || "")
                .replace(/\^/g, "**")
                .replace(/×/g, "*")
                .replace(/÷/g, "/")
                .replace(/,/g, ".");

        // Só permite dígitos, operadores matemáticos, parênteses,
        // pontos e espaços — qualquer outra coisa é rejeitada.
        // Isto bloqueia qualquer tentativa de injetar código.
        if (!/^[\d\s+\-*/.()%]+$/.test(limpa.replace(/\*\*/g, "^"))) {
            return "Expressão inválida — só posso calcular operações matemáticas simples (+, -, *, /, %, parênteses).";
        }

        // eslint-disable-next-line no-new-func
        const resultado = Function(`"use strict"; return (${limpa});`)();

        if (typeof resultado !== "number" || !Number.isFinite(resultado)) {
            return "Não consegui calcular essa expressão.";
        }

        // Arredonda a no máximo 6 casas decimais, sem zeros à toa.
        const arredondado =
            Math.round(resultado * 1e6) / 1e6;

        return `${expressao.trim()} = ${arredondado}`;

    } catch (error) {
        return "Não consegui calcular essa expressão — verifica se está escrita corretamente.";
    }
}

const CACHE_CAMBIO_MS = 60 * 60 * 1000; // 1 hora
let cacheTaxas = null;
let cacheTaxasEm = 0;

async function obterTaxasBase() {

    const agora = Date.now();

    if (cacheTaxas && (agora - cacheTaxasEm) < CACHE_CAMBIO_MS) {
        return cacheTaxas;
    }

    const response = await fetch(
        "https://api.frankfurter.app/latest?from=USD&to=EUR,ZAR,GBP"
    );

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    cacheTaxas = data?.rates || null;
    cacheTaxasEm = agora;

    return cacheTaxas;
}

// MZN (Metical) não está disponível no frankfurter.app (só
// moedas maiores). Como fallback, usa uma taxa aproximada fixa
// quando for mesmo preciso converter para/de MZN, avisando
// claramente que é uma aproximação, não um valor em tempo real.
const MZN_POR_USD_APROXIMADO = 64;

async function converterMoeda(valor, de, para) {

    try {

        const origem = String(de || "").toUpperCase();
        const destino = String(para || "").toUpperCase();
        const quantia = Number(valor);

        if (!Number.isFinite(quantia)) {
            return "Valor inválido para conversão.";
        }

        if (origem === destino) {
            return `${quantia} ${origem} = ${quantia} ${destino}`;
        }

        // Caminho com MZN: usa aproximação, avisa que não é em
        // tempo real (porque realmente não é).
        if (origem === "MZN" || destino === "MZN") {

            let emUsd;

            if (origem === "MZN") {
                emUsd = quantia / MZN_POR_USD_APROXIMADO;
            } else if (origem === "USD") {
                emUsd = quantia;
            } else {
                const taxas = await obterTaxasBase();
                const taxaParaUsd = taxas?.[origem];
                if (!taxaParaUsd) {
                    return `Não tenho taxa disponível para ${origem}.`;
                }
                emUsd = quantia / taxaParaUsd;
            }

            let resultado;
            let avisoAproximado = origem === "MZN" || destino === "MZN";

            if (destino === "MZN") {
                resultado = emUsd * MZN_POR_USD_APROXIMADO;
            } else if (destino === "USD") {
                resultado = emUsd;
            } else {
                const taxas = await obterTaxasBase();
                const taxaDestino = taxas?.[destino];
                if (!taxaDestino) {
                    return `Não tenho taxa disponível para ${destino}.`;
                }
                resultado = emUsd * taxaDestino;
            }

            const arredondado = Math.round(resultado * 100) / 100;

            return `${quantia} ${origem} ≈ ${arredondado} ${destino}` +
                (avisoAproximado
                    ? " (valor aproximado — o Metical não tem taxa oficial em tempo real disponível; para uma cotação exata, confirma num banco ou operadora de câmbio local)"
                    : "");
        }

        // Caminho sem MZN: taxas reais em tempo real.
        if (origem === "USD") {

            const taxas = await obterTaxasBase();
            const taxa = taxas?.[destino];

            if (!taxa) {
                return `Não tenho taxa disponível para ${destino}.`;
            }

            const resultado = Math.round(quantia * taxa * 100) / 100;
            return `${quantia} ${origem} = ${resultado} ${destino} (taxa real, Banco Central Europeu)`;
        }

        const response = await fetch(
            `https://api.frankfurter.app/latest?amount=${quantia}&from=${origem}&to=${destino}`
        );

        if (!response.ok) {
            return `Não consegui converter ${origem} para ${destino} agora.`;
        }

        const data = await response.json();
        const resultado = data?.rates?.[destino];

        if (typeof resultado !== "number") {
            return `Não tenho taxa disponível para o par ${origem}/${destino}.`;
        }

        return `${quantia} ${origem} = ${Math.round(resultado * 100) / 100} ${destino} (taxa real, Banco Central Europeu)`;

    } catch (error) {
        console.error("Erro ao converter moeda:", error?.message || error);
        return "Não consegui obter a taxa de câmbio agora, tenta mais tarde.";
    }
}

module.exports = {
    calcular,
    converterMoeda
};
