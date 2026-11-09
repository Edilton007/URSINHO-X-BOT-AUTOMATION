// ============================================================
// ALERTAS AO DONO
//
// Quando algo importante falha, o dono recebe uma mensagem no
// privado em vez de descobrir quando um cliente reclama.
//
// - sem repetir: o mesmo alerta só volta a sair após o cooldown
// - erros de comando: só alerta quando o MESMO comando falha
//   3 vezes em 10 min (um erro isolado não incomoda ninguém)
// - se o bot estiver offline, o alerta fica em fila e sai quando
//   voltar a ligar
// - nunca envia chaves/segredos (são removidos do texto)
// ============================================================

const fs = require("fs");
const config = require("../config/bot");

const MAX_FILA = 10;
const MAX_HISTORICO = 20;

let sockAtual = null;
let ultimaDesconexao = null;
let codigoDesconexao = null;

const fila = [];
const historico = [];
const ultimoAviso = new Map();   // chave -> timestamp
const contadores = new Map();    // chave -> [timestamps]

function donoJid() {
    const numero = String(config.OWNER_NUMBER || "").replace(/\D/g, "");
    return numero ? `${numero}@s.whatsapp.net` : null;
}

function limpar(texto, max = 220) {
    return String(texto || "")
        .replace(/AIza[\w-]+|AQ\.[\w-]+|sk-[\w-]+|gsk_[\w-]+|tvly-[\w-]+/g, "***")
        .replace(/(key|token|secret|apikey)=([^&\s]+)/gi, "$1=***")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);
}

function hora() {
    return new Date().toLocaleString("pt-PT", { timeZone: "Africa/Maputo" });
}

async function enviar(texto) {

    const jid = donoJid();

    if (!jid || !sockAtual) return false;

    try {
        await sockAtual.sendMessage(jid, { text: texto });
        return true;
    } catch (error) {
        console.error("[ALERTAS] Falha ao avisar o dono:", error?.message || error);
        return false;
    }
}

/**
 * Envia (ou põe em fila) um alerta ao dono.
 * @param chave        identifica o problema (para não repetir)
 * @param cooldownMin  minutos até poder repetir o mesmo alerta
 */
async function alertar({ chave, titulo, detalhe = "", cooldownMin = 30 }) {

    const agora = Date.now();

    if (agora - (ultimoAviso.get(chave) || 0) < cooldownMin * 60000) {
        return false;
    }

    ultimoAviso.set(chave, agora);

    const texto =
`🚨 *ALERTA DO BOT*

${titulo}${detalhe ? `\n${limpar(detalhe)}` : ""}

🕐 ${hora()}`;

    historico.push({ quando: hora(), titulo });
    if (historico.length > MAX_HISTORICO) historico.shift();

    const enviado = await enviar(texto);

    if (!enviado) {
        fila.push(texto);
        if (fila.length > MAX_FILA) fila.shift();
    }

    return enviado;
}

/**
 * Conta ocorrências numa janela; true quando atinge o limite.
 */
function atingiuLimite(chave, limite = 3, janelaMs = 10 * 60000) {

    const agora = Date.now();

    const lista = (contadores.get(chave) || []).filter(t => agora - t < janelaMs);

    lista.push(agora);
    contadores.set(chave, lista);

    return lista.length >= limite;
}

// ---------- ligação ao WhatsApp ----------

function definirSocket(sock) {

    sockAtual = sock;

    // Alertas que ficaram em fila enquanto estava offline
    if (fila.length) {
        const pendentes = fila.splice(0, fila.length);
        pendentes.forEach(t => enviar(`${t}\n\n_(ficou em fila enquanto o bot estava offline)_`));
    }
}

function registarDesconexao(codigo) {
    ultimaDesconexao = Date.now();
    codigoDesconexao = codigo;
}

function registarConexao() {

    if (!ultimaDesconexao) return;

    const minutos = Math.round((Date.now() - ultimaDesconexao) / 60000);

    // Quedas curtíssimas (reconexão normal) não incomodam
    if (minutos >= 2) {
        alertar({
            chave: "reconexao",
            titulo: `🔄 O bot voltou online depois de ~${minutos} min offline.`,
            detalhe: codigoDesconexao ? `Código de saída: ${codigoDesconexao}` : "",
            cooldownMin: 10
        });
    }

    ultimaDesconexao = null;
}

// ---------- fontes de alerta ----------

function erroDeComando(nomeComando, erro) {

    if (!atingiuLimite(`cmd:${nomeComando}`)) return;

    alertar({
        chave: `cmd:${nomeComando}`,
        titulo: `⚠️ O comando *.${nomeComando}* falhou 3 vezes em 10 min.`,
        detalhe: `Último erro: ${erro?.message || erro}`,
        cooldownMin: 60
    });
}

function geminiSemCota(detalhe) {
    alertar({
        chave: "gemini-cota",
        titulo: "🤖 O Gemini parece estar sem cota ou a falhar. A IA está a usar as reservas (Groq/outras).",
        detalhe,
        cooldownMin: 120
    });
}

function iaIndisponivel(detalhe) {

    if (!atingiuLimite("ia-indisponivel")) return;

    alertar({
        chave: "ia-indisponivel",
        titulo: "🚫 TODAS as IAs falharam 3 vezes seguidas. Clientes podem ficar sem resposta.",
        detalhe,
        cooldownMin: 60
    });
}

function erroGlobal(tipo, erro) {

    const msg = limpar(erro?.stack || erro?.message || erro, 200);

    alertar({
        chave: `global:${msg.slice(0, 60)}`,
        titulo: `💥 ${tipo} no bot.`,
        detalhe: msg,
        cooldownMin: 30
    });
}

// ---------- disco ----------

function iniciarMonitorDeDisco({ minimoMB = 500, cadaMin = 30 } = {}) {

    const verificar = () => {

        try {

            fs.statfs(process.cwd(), (err, st) => {

                if (err || !st) return;

                const livreMB = Math.floor((st.bavail * st.bsize) / 1048576);

                if (livreMB < minimoMB) {
                    alertar({
                        chave: "disco",
                        titulo: `💾 Pouco espaço em disco: só ${livreMB} MB livres.`,
                        detalhe: "Downloads e a base de dados podem falhar. Apague ficheiros ou aumente o espaço.",
                        cooldownMin: 360
                    });
                }
            });

        } catch {
            // statfs indisponível nesta versão do Node — ignora
        }
    };

    setTimeout(verificar, 60000).unref();
    setInterval(verificar, cadaMin * 60000).unref();
}

function ultimosAlertas() {
    return historico.slice(-5);
}

module.exports = {
    alertar,
    definirSocket,
    registarConexao,
    registarDesconexao,
    erroDeComando,
    geminiSemCota,
    iaIndisponivel,
    erroGlobal,
    iniciarMonitorDeDisco,
    ultimosAlertas
};
