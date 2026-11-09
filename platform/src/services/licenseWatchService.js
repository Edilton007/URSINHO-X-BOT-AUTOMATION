/* ============================================================
   VIGIA DE LICENÇAS

   Avisa sozinho, sem ninguém pedir:

   NO GRUPO   (para os membros saberem e o admin renovar)
     • faltam 3 dias · falta 1 dia · termina hoje · acabou
     • com botão para falar com o proprietário
     • nunca entre as 21:00 e as 07:00 (hora de Maputo)

   NO PRIVADO DO DONO  (para o dono saber e agir)
     • os mesmos momentos, com o nome do grupo e o que fazer
     • quando uma licença é ativada ou renovada

   Regras para não incomodar:
     • cada aviso sai UMA vez por licença (renovou -> recomeça)
     • se o bot esteve desligado, manda só o aviso mais atual,
       nunca uma fila de avisos atrasados
     • licença que acabou há mais de 3 dias não gera aviso
     • licença nova não dispara "faltam 3 dias" logo a seguir
============================================================ */

const config = require("../config/bot");
const db = require("../database/database");
const { temCanal, urlCanal } = require("./channelService");

const TZ = "Africa/Maputo";
const H = 3600000;

// Do mais longe para o mais perto. `limite` = quanto tempo falta.
const ETAPAS = [
    { id: "d3", limite: 72 * H },
    { id: "d1", limite: 24 * H },
    { id: "h3", limite: 3 * H },
    { id: "fim", limite: 0 }
];

const JANELA_EXPIRADA = 3 * 24 * H;
const HORA_INICIO = 7;   // só avisa grupos a partir das 07:00
const HORA_FIM = 21;     // e até às 21:00
const A_CADA_MS = 10 * 60 * 1000;

let timer = null;
let sockAtual = null;
let aCorrer = false;

/* ---------------- utilitários ---------------- */

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

function donoJid() {
    const n = String(config.OWNER_NUMBER || "").replace(/\D/g, "");
    return n ? `${n}@s.whatsapp.net` : null;
}

function dataHora(ms) {
    const d = new Date(ms);
    const data = d.toLocaleDateString("pt-PT", { timeZone: TZ });
    const hora = d.toLocaleTimeString("pt-PT", {
        timeZone: TZ, hour: "2-digit", minute: "2-digit"
    });
    return { data, hora, texto: `${data} às ${hora}` };
}

function horaLocal(agora) {
    return Number(
        new Intl.DateTimeFormat("en-GB", {
            timeZone: TZ, hour: "2-digit", hour12: false
        }).format(new Date(agora))
    ) % 24;
}

function foraDeHoras(agora) {
    const h = horaLocal(agora);
    return h < HORA_INICIO || h >= HORA_FIM;
}

/** "3 dias", "1 dia", "5 horas", "40 minutos" */
function duracaoTexto(ms) {
    const min = Math.max(1, Math.round(ms / 60000));
    if (min >= 36 * 60) {
        const d = Math.round(min / 1440);
        return `${d} ${d === 1 ? "dia" : "dias"}`;
    }
    if (min >= 90) {
        const h = Math.round(min / 60);
        return `${h} ${h === 1 ? "hora" : "horas"}`;
    }
    return `${min} ${min === 1 ? "minuto" : "minutos"}`;
}

/** Etapa que corresponde ao tempo que falta (a mais próxima). */
function etapaAtual(restante) {
    if (restante <= 0) return "fim";
    let escolhida = null;
    for (const e of ETAPAS) {
        if (e.limite > 0 && restante <= e.limite) escolhida = e.id;
    }
    return escolhida;
}

/* ---------------- estado guardado por grupo ---------------- */

function registo(grupo) {
    const expira = Number(grupo.rentalExpiresAt);

    if (
        !grupo.rentalNotices ||
        grupo.rentalNotices.paraExpiracao !== expira
    ) {
        grupo.rentalNotices = { paraExpiracao: expira, etapas: {} };
    }

    return grupo.rentalNotices;
}

function etapaEstado(reg, id) {
    if (!reg.etapas[id]) reg.etapas[id] = { g: 0, o: 0, t: 0 };
    return reg.etapas[id];
}

/** Marca como "já tratadas" as etapas que ficaram para trás. */
function saltarAnteriores(reg, ateId) {
    for (const e of ETAPAS) {
        if (e.id === ateId) break;
        const s = etapaEstado(reg, e.id);
        s.g = s.g || -1;
        s.o = s.o || -1;
    }
}

/**
 * Chamar logo depois de ativar/renovar. Garante que uma licença
 * curta (ex.: 1 hora) não recebe de imediato "faltam 3 dias".
 */
function iniciarRegisto(chat, agora = Date.now()) {

    const grupo = db.groups[chat];
    if (!grupo || !grupo.rentalExpiresAt) return;

    const reg = registo(grupo);
    const atual = etapaAtual(Number(grupo.rentalExpiresAt) - agora);

    if (atual) {
        saltarAnteriores(reg, atual);
        const s = etapaEstado(reg, atual);
        s.g = s.g || -1;
        s.o = s.o || -1;
    } else {
        saltarAnteriores(reg, "fim");
    }

    db.save();
}

/* ---------------- botões e textos ---------------- */

function botoesRenovar(nomeGrupo, expirou) {

    const pedido = expirou
        ? `Olá Edilton, a licença do grupo "${nomeGrupo}" acabou. Quero renovar.`
        : `Olá Edilton, quero renovar a licença do grupo "${nomeGrupo}".`;

    const botoes = [
        {
            tipo: "cta_url",
            texto: expirou ? "💬 RENOVAR AGORA" : "💬 RENOVAR LICENÇA",
            url: `https://wa.me/${config.OWNER_NUMBER}?text=${encodeURIComponent(pedido)}`
        },
        {
            tipo: "cta_url",
            texto: "📞 LIGAR — 85 774 5014",
            url: "tel:+258857745014"
        }
    ];

    if (temCanal()) {
        botoes.push({
            tipo: "cta_url",
            texto: "📢 SEGUIR O NOSSO CANAL",
            url: urlCanal()
        });
    }

    return botoes;
}

function textoGrupo(etapa, expiraEm, agora, prefix) {

    const restante = expiraEm - agora;
    const quando = dataHora(expiraEm);
    const rodape = `\n🐻 URSINHO X BOT V2`;

    if (etapa === "fim") {
        return (
`⛔ *A LICENÇA DESTE GRUPO ACABOU*
🐻 URSINHO X BOT V2

Terminou em *${quando.texto}*.
A partir de agora, *os comandos do bot não funcionam* neste grupo.

✅ *Para voltar a usar:*
1️⃣ Toque em *RENOVAR AGORA*
2️⃣ Combine a renovação com o proprietário
3️⃣ Receberá um código. Escreva aqui: *${prefix}ativar CÓDIGO*

Assim que renovar, o bot volta a funcionar.
${rodape}`
        ).replace(/\n{3,}/g, "\n\n");
    }

    if (etapa === "h3") {
        return (
`🚨 *A LICENÇA DESTE GRUPO TERMINA HOJE*
🐻 URSINHO X BOT V2

Termina às *${quando.hora}* (faltam cerca de *${duracaoTexto(restante)}*).
Depois dessa hora, *os comandos deixam de funcionar*.

✅ *Para não ficar sem o bot:*
Toque em *RENOVAR LICENÇA* e fale com o proprietário.
Receberá um código: *${prefix}ativar CÓDIGO*

O tempo novo é somado ao que ainda resta.
${rodape}`
        ).replace(/\n{3,}/g, "\n\n");
    }

    const titulo = etapa === "d1"
        ? "⚠️ *A LICENÇA DESTE GRUPO TERMINA AMANHÃ*"
        : "⏳ *A LICENÇA DESTE GRUPO VAI TERMINAR*";

    return (
`${titulo}
🐻 URSINHO X BOT V2

Faltam *${duracaoTexto(restante)}*. Termina em *${quando.texto}*.
Até lá, tudo continua a funcionar normalmente.

✅ *Para não ficar sem o bot:*
Toque em *RENOVAR LICENÇA* e fale com o proprietário.
Receberá um código: *${prefix}ativar CÓDIGO*

O tempo novo é somado ao que ainda resta, não se perde nada.
${rodape}`
    ).replace(/\n{3,}/g, "\n\n");
}

function textoDono(etapa, nome, expiraEm, agora, grupoEnviado, prefix) {

    const quando = dataHora(expiraEm);
    const restante = expiraEm - agora;

    const estadoGrupo =
        grupoEnviado === "ok"
            ? "✅ O grupo já foi avisado."
            : grupoEnviado === "adiado"
                ? "⏸️ O grupo será avisado às 07:00 (não incomodo à noite)."
                : "❌ Não consegui avisar o grupo (o bot saiu ou não é membro).";

    if (etapa === "fim") {
        return (
`⛔ *LICENÇA EXPIRADA*

👥 Grupo: *${nome}*
📅 Terminou: *${quando.texto}*
🚫 Os comandos já não funcionam lá.
${estadoGrupo}

💡 Para renovar: *${prefix}gerarcodigo 30d* e envie o código ao cliente.
Ele escreve no grupo: *${prefix}ativar CÓDIGO*`
        );
    }

    const titulo = etapa === "h3"
        ? "🚨 *LICENÇA TERMINA HOJE*"
        : etapa === "d1"
            ? "⚠️ *LICENÇA TERMINA AMANHÃ*"
            : "⏳ *LICENÇA A TERMINAR*";

    return (
`${titulo}

👥 Grupo: *${nome}*
⏱️ Faltam: *${duracaoTexto(restante)}*
📅 Termina: *${quando.texto}*
${estadoGrupo}

💡 Quer renovar? Gere o código com *${prefix}gerarcodigo 30d*.`
    );
}

/* ---------------- envio ---------------- */

async function nomeDoGrupo(sock, chat, grupo) {
    try {
        const meta = await sock.groupMetadata(chat);
        if (meta?.subject) {
            grupo.rentalGroupName = meta.subject;
            return { nome: meta.subject, membro: true };
        }
    } catch (erro) {
        const msg = String(erro?.message || erro);
        // "forbidden" / "item-not-found": o bot já não está no grupo
        if (/forbidden|not-found|not in|403|404/i.test(msg)) {
            return {
                nome: grupo.rentalGroupName || "Grupo sem nome",
                membro: false
            };
        }
    }
    // Falha temporária: tenta na próxima volta
    return {
        nome: grupo.rentalGroupName || "Grupo sem nome",
        membro: null
    };
}

async function enviarAoGrupo(sock, chat, texto, nome, expirou) {

    const botoes = botoesRenovar(nome, expirou);

    try {
        const { sendMenuNative } = require("./mediaService");
        await sendMenuNative(sock, chat, texto, botoes, {});
        return true;
    } catch (erro) {
        // sem botões é melhor do que sem aviso
    }

    try {
        await sock.sendMessage(chat, {
            text: `${texto}\n\n💬 Renovar: wa.me/${config.OWNER_NUMBER}${temCanal() ? `\n📢 Canal: ${urlCanal()}` : ""}`
        });
        return true;
    } catch (erro) {
        console.error(
            "[LICENÇAS] Falha ao avisar o grupo:",
            erro?.message || erro
        );
        return false;
    }
}

async function enviarAoDono(sock, texto) {

    const jid = donoJid();
    if (!jid) return false;

    try {
        await sock.sendMessage(jid, { text: texto });
        return true;
    } catch (erro) {
        console.error(
            "[LICENÇAS] Falha ao avisar o dono:",
            erro?.message || erro
        );
        return false;
    }
}

/* ---------------- verificação principal ---------------- */

async function verificar(sock, agora = Date.now(), pausaMs = 3000) {

    let mudou = false;

    for (const [chat, grupo] of Object.entries(db.groups || {})) {

        if (!chat.endsWith("@g.us")) continue;

        const expiraEm = Number(grupo.rentalExpiresAt);
        if (!expiraEm) continue;

        const restante = expiraEm - agora;

        // Licença que acabou há muito tempo: não avisar
        if (restante < -JANELA_EXPIRADA) continue;

        const etapa = etapaAtual(restante);
        if (!etapa) continue;   // ainda faltam mais de 3 dias

        const reg = registo(grupo);

        // Primeira vez que vemos esta licença: etapas anteriores
        // ficam de fora (nada de avisos atrasados em fila).
        saltarAnteriores(reg, etapa);

        const s = etapaEstado(reg, etapa);

        const precisaGrupo = s.g === 0;
        const precisaDono = s.o === 0;

        if (!precisaGrupo && !precisaDono) continue;

        let prefix = config.PREFIX || ".";
        try {
            prefix = require("./settingsService").getPrefix(chat) || prefix;
        } catch {}
        const info = await nomeDoGrupo(sock, chat, grupo);

        let estadoGrupo = "falhou";

        /* ---- grupo ---- */

        if (precisaGrupo) {

            if (info.membro === false) {
                s.g = -1;
                estadoGrupo = "falhou";
                mudou = true;

            } else if (info.membro === null) {
                estadoGrupo = "adiado";   // tenta na próxima volta

            } else if (foraDeHoras(agora)) {
                estadoGrupo = "adiado";

            } else {
                const ok = await enviarAoGrupo(
                    sock,
                    chat,
                    textoGrupo(etapa, expiraEm, agora, prefix),
                    info.nome,
                    etapa === "fim"
                );

                s.t = (s.t || 0) + 1;

                if (ok) {
                    s.g = agora;
                    estadoGrupo = "ok";
                } else if (s.t >= 3) {
                    s.g = -1;
                }

                mudou = true;
                await dormir(pausaMs);
            }

        } else {
            estadoGrupo = s.g > 0 ? "ok" : "falhou";
        }

        /* ---- dono ---- */

        if (precisaDono && info.membro !== null) {

            const ok = await enviarAoDono(
                sock,
                textoDono(etapa, info.nome, expiraEm, agora, estadoGrupo, prefix)
            );

            if (ok) {
                s.o = agora;
                mudou = true;
            }

            await dormir(pausaMs);
        }
    }

    if (mudou) db.save();
}

/** Aviso ao dono quando alguém ativa ou renova. */
async function avisarAtivacao(sock, chat, { expiresAt, renewed, duration, code }) {

    try {
        const grupo = db.groups[chat] || {};
        const info = await nomeDoGrupo(sock, chat, grupo);
        const quando = dataHora(expiresAt);

        await enviarAoDono(
            sock,
`${renewed ? "🔄 *LICENÇA RENOVADA*" : "✅ *LICENÇA ATIVADA*"}

👥 Grupo: *${info.nome}*
🎟️ Código: ${code}
⏳ Adicionado: ${duration || "—"}
📅 Válida até: *${quando.texto}*`
        );

    } catch (erro) {
        console.error("[LICENÇAS] aviso de ativação:", erro?.message || erro);
    }
}

/* ---------------- arranque ---------------- */

function iniciar(sock) {

    sockAtual = sock;

    if (timer) clearInterval(timer);

    const volta = async () => {
        if (aCorrer || !sockAtual) return;
        aCorrer = true;
        try {
            await verificar(sockAtual);
        } catch (erro) {
            console.error("[LICENÇAS] erro na verificação:", erro?.message || erro);
        } finally {
            aCorrer = false;
        }
    };

    timer = setInterval(volta, A_CADA_MS);
    if (timer.unref) timer.unref();

    // Primeira volta pouco depois de ligar (deixa a sessão assentar)
    const primeira = setTimeout(volta, 60 * 1000);
    if (primeira.unref) primeira.unref();
}

module.exports = {
    iniciar,
    verificar,
    iniciarRegisto,
    avisarAtivacao,
    botoesRenovar,
    duracaoTexto,
    etapaAtual,
    foraDeHoras
};
