const competitorDb = require("../database/competitorDb");
const { calcularPontuacao, mensagemTemPadraoForte } = require("./competitorScoring");

// ============================================================
// COLETA DE SINAIS (só o que é tecnicamente acessível)
// ============================================================

async function obterStatusText(sock, jid) {
    try {
        const resultado = await sock.fetchStatus(jid);
        return resultado?.status || "";
    } catch {
        // Pode falhar por privacidade da pessoa — normal, ignora
        return "";
    }
}

/**
 * Verifica se essa pessoa está presente em algum outro grupo
 * que o bot administra e que foi marcado como "concorrência
 * conhecida". Isto É tecnicamente possível — o bot já tem a
 * lista de participantes de todos os grupos onde está.
 */
async function estaEmGrupoConcorrenteConhecido(sock, jid, groupIdAtual) {

    try {

        const todosOsGrupos = await sock.groupFetchAllParticipating();

        for (const gid of Object.keys(todosOsGrupos || {})) {

            if (gid === groupIdAtual) continue;

            if (!competitorDb.isGrupoConcorrenteConhecido(gid)) continue;

            const participantes =
                todosOsGrupos[gid]?.participants || [];

            const presente = participantes.some(
                p => (p.id || p.jid) === jid
            );

            if (presente) {
                return true;
            }
        }

        return false;

    } catch (error) {
        console.error(
            "[ANTI-CONCORRÊNCIA] Erro ao verificar grupos em comum:",
            error?.message || error
        );
        return false;
    }
}

async function coletarSinais(sock, groupId, jid, pushName, mensagemAtual) {

    const statusText = await obterStatusText(sock, jid);

    const emGrupoConcorrenteConhecido =
        await estaEmGrupoConcorrenteConhecido(sock, jid, groupId);

    const historicoGlobal =
        competitorDb.obterObservacaoGlobal(jid);

    return {
        pushName,
        statusText,
        emGrupoConcorrenteConhecido,
        historicoGlobal,
        mensagemAtual
    };
}

// ============================================================
// AÇÕES
// ============================================================

async function removerDoGrupo(sock, groupId, jid) {
    try {
        await sock.groupParticipantsUpdate(groupId, [jid], "remove");
        return true;
    } catch (error) {
        console.error(
            "[ANTI-CONCORRÊNCIA] Erro ao remover participante:",
            error?.message || error
        );
        return false;
    }
}

async function avisarAdmins(sock, groupId, texto) {
    try {

        const metadata = await sock.groupMetadata(groupId);

        const admins =
            (metadata?.participants || [])
                .filter(p => p.admin)
                .map(p => p.id);

        await sock.sendMessage(groupId, {
            text: texto,
            mentions: admins
        });

    } catch (error) {
        console.error(
            "[ANTI-CONCORRÊNCIA] Erro ao avisar admins:",
            error?.message || error
        );
    }
}

function formatarSinais(sinais) {
    return sinais
        .map(s => `• ${s.detalhe} (+${s.pontos})`)
        .join("\n");
}

// ============================================================
// FLUXO PRINCIPAL: NOVO MEMBRO
// ============================================================

/**
 * Chamado quando alguém entra no grupo. Retorna
 * { removido: boolean } pra quem chamar (ex: sistema de
 * boas-vindas) saber se deve ou não mandar mensagem de
 * boas-vindas pra essa pessoa.
 */
async function verificarNovoMembro(sock, groupId, jid, pushName) {

    if (!competitorDb.isAtivo(groupId)) {
        return { removido: false };
    }

    if (competitorDb.isWhitelisted(groupId, jid)) {
        return { removido: false };
    }

    // Lista negra — confirmação imediata, sem precisar somar pontos
    if (competitorDb.isBlocklisted(groupId, jid)) {

        const removido = await removerDoGrupo(sock, groupId, jid);

        competitorDb.registarHistorico(groupId, {
            jid,
            pushName,
            decisao: removido ? "removido" : "falha_ao_remover",
            pontuacao: 100,
            sinais: [{ tipo: "lista_negra", pontos: 100, detalhe: "Número já estava na lista negra deste grupo" }]
        });

        if (removido) {
            await avisarAdmins(
                sock,
                groupId,
                `🛡️ *ANTI-CONCORRÊNCIA*\n\n🚫 Removido: @${jid.split("@")[0]}\n📋 Motivo: número já estava na lista negra deste grupo.`
            );
        }

        return { removido };
    }

    const sinaisColetados =
        await coletarSinais(sock, groupId, jid, pushName, null);

    const resultado = calcularPontuacao(sinaisColetados);

    if (resultado.nivel === "nenhum") {
        return { removido: false };
    }

    if (resultado.nivel === "confirmado") {

        const removido = await removerDoGrupo(sock, groupId, jid);

        competitorDb.registarHistorico(groupId, {
            jid,
            pushName,
            decisao: removido ? "removido" : "falha_ao_remover",
            pontuacao: resultado.pontuacao,
            sinais: resultado.sinais
        });

        if (removido) {
            await avisarAdmins(
                sock,
                groupId,
`🛡️ *ANTI-CONCORRÊNCIA*

🚫 Removido automaticamente: @${jid.split("@")[0]}
📊 Pontuação: ${resultado.pontuacao}

📋 Motivos:
${formatarSinais(resultado.sinais)}`
            );
        }

        return { removido };
    }

    // nível "suspeito" — só avisa, não remove
    competitorDb.definirPendente(groupId, jid, {
        pushName,
        pontuacao: resultado.pontuacao,
        sinais: resultado.sinais,
        primeiraDeteccao: Date.now()
    });

    await avisarAdmins(
        sock,
        groupId,
`🛡️ *ANTI-CONCORRÊNCIA — REVISÃO NECESSÁRIA*

⚠️ Suspeito: @${jid.split("@")[0]}
📊 Pontuação: ${resultado.pontuacao} (abaixo do limiar de remoção automática)

📋 Motivos:
${formatarSinais(resultado.sinais)}

Usa *.concorrente confirmar ${jid.split("@")[0]}* pra remover, ou *.concorrente aprovar ${jid.split("@")[0]}* se for engano.`
    );

    return { removido: false };
}

// ============================================================
// FLUXO PRINCIPAL: MENSAGEM NO GRUPO
// ============================================================

async function verificarMensagem(sock, groupId, jid, pushName, texto) {

    if (!competitorDb.isAtivo(groupId)) return;
    if (competitorDb.isWhitelisted(groupId, jid)) return;
    if (!texto || !texto.trim()) return;

    // Regista no histórico global do bot se o padrão for claro —
    // isto ajuda a proteger OUTROS grupos no futuro também.
    if (mensagemTemPadraoForte(texto)) {
        competitorDb.registarObservacaoGlobal(jid, groupId, texto);
    }

    // Se já está na lista negra e por algum motivo ainda está
    // no grupo (ex: entrou antes do sistema ser ativado), age agora.
    if (competitorDb.isBlocklisted(groupId, jid)) {

        const removido = await removerDoGrupo(sock, groupId, jid);

        competitorDb.registarHistorico(groupId, {
            jid,
            pushName,
            decisao: removido ? "removido" : "falha_ao_remover",
            pontuacao: 100,
            sinais: [{ tipo: "lista_negra", pontos: 100, detalhe: "Número está na lista negra deste grupo" }]
        });

        if (removido) {
            await avisarAdmins(
                sock,
                groupId,
                `🛡️ *ANTI-CONCORRÊNCIA*\n\n🚫 Removido: @${jid.split("@")[0]}\n📋 Motivo: número está na lista negra deste grupo.`
            );
        }

        return;
    }

    const sinaisColetados =
        await coletarSinais(sock, groupId, jid, pushName, texto);

    const resultado = calcularPontuacao(sinaisColetados);

    if (resultado.nivel === "nenhum") return;

    if (resultado.nivel === "confirmado") {

        const removido = await removerDoGrupo(sock, groupId, jid);

        competitorDb.registarHistorico(groupId, {
            jid,
            pushName,
            decisao: removido ? "removido" : "falha_ao_remover",
            pontuacao: resultado.pontuacao,
            sinais: resultado.sinais
        });

        competitorDb.removerPendente(groupId, jid);

        if (removido) {
            await avisarAdmins(
                sock,
                groupId,
`🛡️ *ANTI-CONCORRÊNCIA*

🚫 Removido automaticamente: @${jid.split("@")[0]}
📊 Pontuação: ${resultado.pontuacao}
💬 Detectado pela mensagem enviada no grupo

📋 Motivos:
${formatarSinais(resultado.sinais)}`
            );
        }

        return;
    }

    // "suspeito" — atualiza/regista pendente, só notifica se for
    // a primeira vez (evita spammar os admins a cada mensagem)
    const jaEraPendente = competitorDb.obterPendente(groupId, jid);

    competitorDb.definirPendente(groupId, jid, {
        pushName,
        pontuacao: resultado.pontuacao,
        sinais: resultado.sinais,
        primeiraDeteccao:
            jaEraPendente?.primeiraDeteccao || Date.now()
    });

    if (!jaEraPendente) {
        await avisarAdmins(
            sock,
            groupId,
`🛡️ *ANTI-CONCORRÊNCIA — REVISÃO NECESSÁRIA*

⚠️ Suspeito: @${jid.split("@")[0]}
📊 Pontuação: ${resultado.pontuacao}
💬 Detectado por mensagem no grupo

📋 Motivos:
${formatarSinais(resultado.sinais)}

Usa *.concorrente confirmar ${jid.split("@")[0]}* pra remover, ou *.concorrente aprovar ${jid.split("@")[0]}* se for engano.`
        );
    }
}

module.exports = {
    verificarNovoMembro,
    verificarMensagem
};
