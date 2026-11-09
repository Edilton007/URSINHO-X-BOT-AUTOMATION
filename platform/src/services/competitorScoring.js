// ============================================================
// PONTUAÇÃO DE RISCO — ANTI-CONCORRÊNCIA
//
// Cada sinal soma pontos. Nunca decide sozinho — a decisão
// final depende do total. Pesos pensados pra serem
// conservadores: um único sinal fraco nunca chega a "confirmado".
// ============================================================

const PESOS = {
    HISTORICO_GLOBAL_FORTE: 60,   // já visto a promover em 2+ grupos
    HISTORICO_GLOBAL_FRACO: 30,   // já visto a promover 1 vez
    GRUPO_CONCORRENTE_CONHECIDO: 45, // está noutro grupo marcado como concorrência
    NOME_OU_STATUS_KEYWORD: 20,   // por palavra-chave única (máx 2)
    MENSAGEM_FORTE: 45,           // mensagem atual com padrão claro de venda
    MENSAGEM_FRACA: 15            // mensagem atual com só 1 indício fraco
};

const LIMIARES_PADRAO = {
    confirmado: 85,
    suspeito: 35
};

// Palavras fortemente associadas a revenda de pacotes/internet
const PALAVRAS_FORTES = [
    "revenda", "revendedor", "revender",
    "pacote de internet", "pacotes de internet",
    "megas baratos", "internet barata",
    "só hoje", "promoção de megas"
];

// Palavras mais genéricas (contam menos sozinhas)
const PALAVRAS_FRACAS = [
    "mb", "gb", "megas", "internet", "pacote", "pacotes",
    "dados móveis", "recarga", "saldo"
];

// Padrão de preço (ex: "50mt", "100 mt", "500,00mt")
const PADRAO_PRECO = /\b\d+([.,]\d+)?\s?(mt|mzn|meticais)\b/i;

function contarPalavras(texto, lista) {
    const t = String(texto || "").toLowerCase();
    return lista.filter(p => t.includes(p)).length;
}

/**
 * Calcula a pontuação de risco de um candidato.
 *
 * @param {Object} candidato
 * @param {string} candidato.pushName - nome de exibição
 * @param {string} candidato.statusText - texto do "status" (se acessível)
 * @param {boolean} candidato.emGrupoConcorrenteConhecido
 * @param {Object} candidato.historicoGlobal - vindo do competitorDb
 * @param {string} candidato.mensagemAtual - texto da mensagem, se houver
 * @param {Object} limiares - opcional, sobrescreve os padrão (por grupo)
 */
function calcularPontuacao(candidato, limiares = LIMIARES_PADRAO) {

    const sinais = [];
    let pontuacao = 0;

    // ---- Histórico global (o próprio bot já viu isto antes) ----
    const historico = candidato.historicoGlobal;

    if (historico?.mensagensSuspeitas?.length >= 2) {
        pontuacao += PESOS.HISTORICO_GLOBAL_FORTE;
        sinais.push({
            tipo: "historico_global_forte",
            pontos: PESOS.HISTORICO_GLOBAL_FORTE,
            detalhe: `Visto a promover em ${historico.gruposVistos.length} grupo(s) antes`
        });
    } else if (historico?.mensagensSuspeitas?.length === 1) {
        pontuacao += PESOS.HISTORICO_GLOBAL_FRACO;
        sinais.push({
            tipo: "historico_global_fraco",
            pontos: PESOS.HISTORICO_GLOBAL_FRACO,
            detalhe: "Visto a promover uma vez antes"
        });
    }

    // ---- Está noutro grupo marcado como concorrência ----
    if (candidato.emGrupoConcorrenteConhecido) {
        pontuacao += PESOS.GRUPO_CONCORRENTE_CONHECIDO;
        sinais.push({
            tipo: "grupo_concorrente_conhecido",
            pontos: PESOS.GRUPO_CONCORRENTE_CONHECIDO,
            detalhe: "Também está num grupo marcado como concorrência"
        });
    }

    // ---- Nome/status ----
    const textoPerfil =
        `${candidato.pushName || ""} ${candidato.statusText || ""}`;

    const palavrasFortesPerfil = contarPalavras(textoPerfil, PALAVRAS_FORTES);
    const palavrasFracasPerfil = contarPalavras(textoPerfil, PALAVRAS_FRACAS);

    const hitsPerfil = Math.min(
        2,
        palavrasFortesPerfil * 2 + palavrasFracasPerfil
    );

    if (hitsPerfil > 0) {
        const pontos = PESOS.NOME_OU_STATUS_KEYWORD * hitsPerfil;
        pontuacao += pontos;
        sinais.push({
            tipo: "nome_ou_status",
            pontos,
            detalhe: "Nome/status com palavras associadas a venda de internet"
        });
    }

    // ---- Mensagem atual ----
    if (candidato.mensagemAtual) {

        const temPalavraForte =
            contarPalavras(candidato.mensagemAtual, PALAVRAS_FORTES) > 0;

        const temPreco =
            PADRAO_PRECO.test(candidato.mensagemAtual);

        const temPalavraFraca =
            contarPalavras(candidato.mensagemAtual, PALAVRAS_FRACAS) > 0;

        if (temPalavraForte && temPreco) {
            pontuacao += PESOS.MENSAGEM_FORTE;
            sinais.push({
                tipo: "mensagem_forte",
                pontos: PESOS.MENSAGEM_FORTE,
                detalhe: "Mensagem com padrão claro de venda (palavra-chave + preço)"
            });
        } else if (temPalavraFraca || temPalavraForte) {
            pontuacao += PESOS.MENSAGEM_FRACA;
            sinais.push({
                tipo: "mensagem_fraca",
                pontos: PESOS.MENSAGEM_FRACA,
                detalhe: "Mensagem com indício fraco de venda"
            });
        }
    }

    let nivel = "nenhum";

    if (pontuacao >= limiares.confirmado) {
        nivel = "confirmado";
    } else if (pontuacao >= limiares.suspeito) {
        nivel = "suspeito";
    }

    return { pontuacao, sinais, nivel };
}

/**
 * A mensagem atual, sozinha, tem padrão forte o suficiente
 * pra valer a pena registar no histórico global do bot?
 */
function mensagemTemPadraoForte(texto) {
    return (
        contarPalavras(texto, PALAVRAS_FORTES) > 0 &&
        PADRAO_PRECO.test(texto)
    );
}

module.exports = {
    calcularPontuacao,
    mensagemTemPadraoForte,
    LIMIARES_PADRAO,
    PESOS
};
