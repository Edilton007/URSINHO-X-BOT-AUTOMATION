// ============================================================
// GUARDA DA VENDAIA (validação da resposta ANTES de enviar)
//
// A IA pode "escorregar" mesmo com regras no prompt. Em vendas
// um erro custa dinheiro, por isso a resposta é conferida pelo
// código antes de ir para o cliente:
//   1. nunca afirma pagamento/compra/MB como confirmados ou enviados;
//   2. nunca diz um valor em MT que não esteja na tabela do grupo;
//   3. nunca diz um número de telemóvel/conta que não seja das
//      contas configuradas (ou do próprio cliente).
// Se algo falhar, sai uma resposta segura em vez da da IA.
// ============================================================

function normalizar(t) {
    return String(t || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

// Palavras que, logo antes, tornam a frase uma negação/condição
// ("ainda não foi confirmado", "depois de confirmado") — não é afirmação.
const NEGACAO_ANTES = /\b(nao|ainda nao|sem|ate|quando|assim que|depois|apos|so quando|caso|se)\b/;

const AFIRMACOES = [
    /\b(pagamento|comprovativo|transferencia|deposito)\b[^.!?\n]{0,40}\b(confirmad[oa]s?|aprovad[oa]s?|recebid[oa]s?|validad[oa]s?)\b/g,
    /\b(compra|pedido)\b[^.!?\n]{0,30}\b(registad[oa]s?|confirmad[oa]s?|concluid[oa]s?|processad[oa]s?)\b/g,
    /\b(megas?|mb|gb|internet|pacote|dados)\b[^.!?\n]{0,40}\b(enviad[oa]s?|entregue|entregues|creditad[oa]s?|activad[oa]s?|ativad[oa]s?)\b/g,
    /\b(ja\s+)?(enviei|mandei|creditei|activei|ativei)\b[^.!?\n]{0,30}\b(megas?|mb|gb|pacote|net)\b/g,
    /\b(ja\s+)?(recebi|confirmei|aprovei|validei)\b[^.!?\n]{0,30}\b(pagamento|comprovativo|transferencia|deposito)\b/g
];

// Futuro/possibilidade ("serão enviados") não é afirmar que já aconteceu
const FUTURO = /\b(serao|sera|vao ser|vai ser|podem ser|pode ser)\b/;

function temAfirmacaoProibida(resposta) {

    const t = normalizar(resposta);

    for (const re of AFIRMACOES) {

        re.lastIndex = 0;
        let m;

        while ((m = re.exec(t)) !== null) {

            const antes = t.slice(Math.max(0, m.index - 45), m.index + 25);

            // negação/condição perto do início do trecho = frase segura
            if (NEGACAO_ANTES.test(antes)) continue;
            if (FUTURO.test(m[0])) continue;

            return m[0].trim();
        }
    }

    return null;
}

function numerosDe(texto) {

    const set = new Set();

    for (const m of String(texto || "").matchAll(/\d+(?:[.,]\d+)?/g)) {
        set.add(String(Number(m[0].replace(",", "."))));
    }

    return set;
}

function valoresEmMtNaoPermitidos(resposta, permitidos) {

    const erros = [];

    const re = /(\d[\d.,]*)\s*(?:mt|mzn|meticais?)\b/gi;

    for (const m of String(resposta || "").matchAll(re)) {

        const valor = String(Number(m[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")));

        if (!permitidos.has(valor)) erros.push(m[0]);
    }

    return erros;
}

function telefonesNaoPermitidos(resposta, permitidos) {

    // "84 123 4567" / "84-123-4567" -> "841234567"
    const colado = String(resposta || "").replace(/(?<=\d)[ \-](?=\d)/g, "");

    const erros = [];

    for (const m of colado.matchAll(/(?<!\d)(?:258)?8[2-7]\d{7}(?!\d)/g)) {

        const digitos = m[0].replace(/^258/, "");

        if (!permitidos.has(digitos)) erros.push(m[0]);
    }

    return erros;
}

function somenteDigitos(texto) {
    return String(texto || "").replace(/[ \-]/g, "");
}

/**
 * Devolve { ok: true } ou { ok: false, motivo, respostaSegura }.
 */
function validarRespostaVenda({ resposta, mensagem, tabela, payments, sender }) {

    // 1) afirmações que só o ADM/sistema pode fazer
    const afirmacao = temAfirmacaoProibida(resposta);

    if (afirmacao) {
        return {
            ok: false,
            motivo: `afirmação proibida: "${afirmacao}"`,
            respostaSegura:
                "Fico a aguardar o ADM verificar o teu comprovativo e confirmar a compra 🙏\n\n" +
                "Assim que ele confirmar, recebes os MB. Eu não consigo confirmar pagamentos."
        };
    }

    // 2) valores em MT que não estão na tabela
    const valoresOk = new Set([
        ...numerosDe(tabela),
        ...numerosDe(mensagem)
    ]);

    const valoresErrados = valoresEmMtNaoPermitidos(resposta, valoresOk);

    if (valoresErrados.length) {
        return {
            ok: false,
            motivo: `valor fora da tabela: ${valoresErrados.join(", ")}`,
            respostaSegura:
                "Para não haver engano nos valores, estes são os preços certos da tabela:\n\n" +
                `${tabela}\n\nQuanto precisas? 😊`
        };
    }

    // 3) telefones/contas que não são das contas do grupo
    const telefonesOk = new Set(
        [
            ...String(somenteDigitos(payments)).matchAll(/(?<!\d)(?:258)?(8[2-7]\d{7})(?!\d)/g)
        ].map(m => m[1])
    );

    for (const m of somenteDigitos(mensagem).matchAll(/(?<!\d)(?:258)?(8[2-7]\d{7})(?!\d)/g)) {
        telefonesOk.add(m[1]);
    }

    const meu = String(sender || "").replace(/\D/g, "").replace(/^258/, "");
    if (meu) telefonesOk.add(meu);

    const telefonesErrados = telefonesNaoPermitidos(resposta, telefonesOk);

    if (telefonesErrados.length) {
        return {
            ok: false,
            motivo: `número fora das contas: ${telefonesErrados.join(", ")}`,
            respostaSegura:
                "Para pagares sem erro, usa só estas contas do grupo:\n\n" +
                `${payments}\n\nDepois envia o comprovativo aqui no grupo 🙏`
        };
    }

    return { ok: true };
}

module.exports = { validarRespostaVenda };
