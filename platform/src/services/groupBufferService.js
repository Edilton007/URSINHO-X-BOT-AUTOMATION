// ============================================================
// HISTÓRICO DE CONVERSA DOS GRUPOS (para o "suporte"/"ajuda")
//
// Guarda as últimas mensagens de texto de cada grupo, com o id
// de cada uma, para o bot perceber o contexto quando alguém
// escreve "suporte" ou "ajuda" (ou responde a uma mensagem).
//
// - até 150 mensagens por grupo, só texto (até 300 caracteres)
// - mensagens com mais de 3 dias são apagadas
// - fica em src/database/groupBuffer.json para sobreviver a
//   reinícios (gravação adiada, não a cada mensagem)
// ============================================================

const fs = require("fs");
const path = require("path");

const FICHEIRO = path.join(__dirname, "..", "database", "groupBuffer.json");

const MAX_MENSAGENS = 150;
const MAX_CARACTERES = 300;
const MAX_GRUPOS = 300;
const IDADE_MAX_MS = 3 * 24 * 60 * 60 * 1000;
const GRAVAR_APOS_MS = 20000;

const buffers = new Map();
let temporizador = null;

function carregar() {

    try {

        if (!fs.existsSync(FICHEIRO)) return;

        const dados = JSON.parse(fs.readFileSync(FICHEIRO, "utf8"));
        const limite = Date.now() - IDADE_MAX_MS;

        for (const [chat, lista] of Object.entries(dados || {})) {

            const recentes = (Array.isArray(lista) ? lista : [])
                .filter(x => x && x.text && x.t > limite)
                .slice(-MAX_MENSAGENS);

            if (recentes.length) buffers.set(chat, recentes);
        }

    } catch (error) {
        console.error("[BUFFER] Não consegui ler o histórico:", error?.message || error);
    }
}

function gravar() {

    temporizador = null;

    try {

        const limite = Date.now() - IDADE_MAX_MS;
        const saida = {};

        for (const [chat, lista] of buffers) {
            const recentes = lista.filter(x => x.t > limite);
            if (recentes.length) saida[chat] = recentes;
        }

        const tmp = `${FICHEIRO}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(saida));
        fs.renameSync(tmp, FICHEIRO);

    } catch (error) {
        console.error("[BUFFER] Não consegui gravar o histórico:", error?.message || error);
    }
}

function agendarGravacao() {
    if (!temporizador) {
        temporizador = setTimeout(gravar, GRAVAR_APOS_MS);
        temporizador.unref?.();
    }
}

function registar(chat, nome, texto, id = null) {

    const t = String(texto || "").trim();

    if (!chat || !t) return;

    let lista = buffers.get(chat);

    if (!lista) {

        if (buffers.size >= MAX_GRUPOS) {
            buffers.delete(buffers.keys().next().value);
        }

        lista = [];
        buffers.set(chat, lista);
    }

    lista.push({
        id: id || null,
        name: nome || "alguém",
        text: t.slice(0, MAX_CARACTERES),
        t: Date.now()
    });

    if (lista.length > MAX_MENSAGENS) {
        lista.splice(0, lista.length - MAX_MENSAGENS);
    }

    agendarGravacao();
}

/**
 * Conversa para dar contexto ao suporte.
 * - Se a pessoa respondeu a uma mensagem (idCitado) e ela está no
 *   histórico: devolve desde `antes` mensagens antes dela até agora.
 * - Caso contrário: as últimas `fallback` mensagens.
 */
function conversa(chat, idCitado = null, { antes = 40, maximo = 90, fallback = 60 } = {}) {

    const lista = buffers.get(chat) || [];

    if (idCitado) {

        const i = lista.findIndex(x => x.id === idCitado);

        if (i >= 0) {
            return lista.slice(Math.max(0, i - antes)).slice(-maximo);
        }
    }

    return lista.slice(-fallback);
}

function nomeDe(chat, id) {
    return (buffers.get(chat) || []).find(x => x.id === id)?.name || null;
}

carregar();

process.on("exit", () => {
    if (temporizador) gravar();
});

module.exports = { registar, conversa, nomeDe };
