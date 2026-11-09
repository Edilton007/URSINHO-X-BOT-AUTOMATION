/* ============================================================
   PUBLICAR NO CANAL DO WHATSAPP

   - .postarcanal <texto>     -> o dono publica no canal pelo bot
   - aviso automático "bot online" quando o bot volta depois de
     ficar parado (manutenção, servidor novo, queda longa)

   Só funciona se o número do bot for DONO ou ADMIN do canal.

   .env (opcional):
     CHANNEL_URL            link do canal (já usado no resto do bot)
     CHANNEL_JID            ID interno do canal (…@newsletter); se vazio,
                            o bot descobre-o sozinho a partir do link
     CHANNEL_AVISAR_ONLINE  0 desliga o aviso automático (padrão: ligado)
============================================================ */

const fs = require("fs");
const path = require("path");
const config = require("../config/bot");

const ARQUIVO = path.join(__dirname, "../database/channelMeta.json");

const MIN_PARADO_MS = 30 * 60 * 1000;        // só anuncia se esteve parado 30 min+
const ENTRE_ANUNCIOS_MS = 6 * 60 * 60 * 1000; // e no máximo 1 vez a cada 6 h
const BATIMENTO_MS = 5 * 60 * 1000;

let timer = null;

/* ---------------- estado em ficheiro ---------------- */

function ler() {
    try {
        return JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
    } catch {
        return {};
    }
}

function gravar(dados) {
    try {
        fs.writeFileSync(ARQUIVO, JSON.stringify(dados, null, 2));
    } catch (erro) {
        console.error("[CANAL] não consegui gravar:", erro?.message || erro);
    }
}

function codigoDoLink() {
    const m = String(config.CHANNEL_URL || "")
        .match(/whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i);
    return m ? m[1] : null;
}

/* ---------------- descobrir o canal ---------------- */

async function resolverJid(sock) {

    const doEnv = String(process.env.CHANNEL_JID || "").trim();
    if (doEnv.endsWith("@newsletter")) return doEnv;

    const guardado = ler();
    if (guardado.jid && guardado.codigo === codigoDoLink()) return guardado.jid;

    const codigo = codigoDoLink();
    if (!codigo) throw new Error("CHANNEL_URL não é um link de canal válido.");

    if (typeof sock.newsletterMetadata !== "function") {
        throw new Error("Esta versão do Baileys não tem funções de canal.");
    }

    const meta = await sock.newsletterMetadata("invite", codigo);
    const jid = meta?.id;

    if (!jid) throw new Error("Não consegui descobrir o ID do canal.");

    gravar({ ...guardado, jid, codigo, nome: meta?.name || meta?.thread_metadata?.name?.text || null });

    return jid;
}

/* ---------------- publicar ---------------- */

async function publicar(sock, texto) {

    const corpo = String(texto || "").trim();
    if (!corpo) return { ok: false, erro: "Texto vazio." };

    try {
        const jid = await resolverJid(sock);
        await sock.sendMessage(jid, { text: corpo });
        return { ok: true, jid };

    } catch (erro) {
        const msg = String(erro?.message || erro);

        let dica = msg;
        if (/forbidden|403|not.?authorized|permission/i.test(msg)) {
            dica = "O número do bot não é dono nem admin deste canal.";
        }

        return { ok: false, erro: dica };
    }
}

/* ---------------- textos prontos ---------------- */

function textoPronto(nome) {

    const dono = String(config.OWNER_NUMBER || "").replace(/\D/g, "");

    if (nome === "online") {
        return (
`✅ *URSINHO X BOT V2 ESTÁ ONLINE!*

A manutenção terminou e o bot voltou a funcionar.

💬 Num grupo com licença, escreve *ajuda* ou *${config.PREFIX || "."}menu* para começar.

📲 Queres alugar o bot para o teu grupo?
Fala com o proprietário: wa.me/${dono}

✨ BY Edilton Ronaldo`
        );
    }

    if (nome === "manutencao") {
        return (
`🔧 *URSINHO X BOT V2 EM MANUTENÇÃO*

Estamos a fazer melhorias e o bot pode ficar sem responder durante algum tempo.
Assim que voltar, avisamos aqui.

✨ BY Edilton Ronaldo`
        );
    }

    return null;
}

/* ---------------- aviso automático "online" ---------------- */

function batimento() {
    const d = ler();
    d.ultimoVisto = Date.now();
    gravar(d);
}

async function anunciarOnline(sock) {

    if (String(process.env.CHANNEL_AVISAR_ONLINE || "1") === "0") return;

    const d = ler();
    const agora = Date.now();

    const parado = !d.ultimoVisto || agora - d.ultimoVisto >= MIN_PARADO_MS;
    const recente = d.ultimoAnuncio && agora - d.ultimoAnuncio < ENTRE_ANUNCIOS_MS;

    if (!parado || recente) return;

    const r = await publicar(sock, textoPronto("online"));

    if (r.ok) {
        const novo = ler();
        novo.ultimoAnuncio = Date.now();
        gravar(novo);
        console.log("[CANAL] anúncio 'bot online' publicado");
    } else {
        console.error("[CANAL] anúncio 'online' falhou:", r.erro);
    }
}

function iniciar(sock) {

    // Decide ANTES de começar a atualizar o "último visto"
    const esperar = setTimeout(async () => {
        try {
            await anunciarOnline(sock);
        } catch (erro) {
            console.error("[CANAL]", erro?.message || erro);
        }
        batimento();
    }, 20 * 1000);
    if (esperar.unref) esperar.unref();

    if (timer) clearInterval(timer);
    timer = setInterval(batimento, BATIMENTO_MS);
    if (timer.unref) timer.unref();
}

module.exports = {
    publicar,
    resolverJid,
    textoPronto,
    iniciar
};
