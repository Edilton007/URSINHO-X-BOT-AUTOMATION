/* ============================================================
   MENSAGENS DE LICENÇA / ALUGUER

   Todos os textos de licença num só sítio, escritos em
   linguagem simples: o que aconteceu, o que fazer, e a quem falar.
============================================================ */

const config = require("../config/bot");
const { linhaCanal } = require("./channelService");

const BOT = "🐻 URSINHO X BOT V2";

function dataPT(ms) {
    return new Date(ms).toLocaleDateString("pt-PT");
}

function rodape(comCanal = true) {
    const canal = comCanal ? linhaCanal() : "";
    return canal ? `\n${canal}\n` : "\n";
}

/**
 * Cartão quando o grupo tenta usar o bot sem licença.
 * estado: "nunca" | "expirada" | "bloqueado"
 */
function mensagemSemLicenca({ estado = "nunca", expiresAt = null, prefix = ".", comLinhaCanal = true } = {}) {

    let titulo;
    let motivo;
    let passos;

    if (estado === "bloqueado") {

        titulo = "⛔ *BOT BLOQUEADO NESTE GRUPO*";

        motivo =
`O proprietário bloqueou o bot neste grupo.
Por isso os comandos não funcionam.`;

        passos =
`✅ *Como resolver:*
1️⃣ Toque em *FALAR COM O PROPRIETÁRIO*
2️⃣ Peça para desbloquear este grupo
3️⃣ Quando ele desbloquear, o bot volta a funcionar`;

    } else if (estado === "expirada") {

        titulo = "⏰ *A LICENÇA DESTE GRUPO ACABOU*";

        motivo =
`A licença terminou${expiresAt ? ` em *${dataPT(expiresAt)}*` : ""}.
Os comandos ficam parados até renovar.`;

        passos =
`✅ *Como renovar:*
1️⃣ Toque em *FALAR COM O PROPRIETÁRIO*
2️⃣ Combine a renovação e o pagamento
3️⃣ Receberá um código. Escreva aqui no grupo: *${prefix}ativar CÓDIGO*

O tempo novo começa a contar a partir de hoje.`;

    } else {

        titulo = "🔒 *ESTE GRUPO AINDA NÃO TEM LICENÇA*";

        motivo =
`Sem licença, o bot não responde aos comandos.`;

        passos =
`✅ *Como ativar o bot:*
1️⃣ Toque em *FALAR COM O PROPRIETÁRIO*
2️⃣ Combine o aluguer e o pagamento
3️⃣ Receberá um código. Escreva aqui no grupo: *${prefix}ativar CÓDIGO*`;
    }

    return (
`${titulo}
${BOT}

${motivo}

${passos}

👑 Proprietário: *Edilton Ronaldo*
${rodape(comLinhaCanal)}
${BOT}`
    ).replace(/\n{3,}/g, "\n\n");
}

/** Resposta do comando "alugar" (qualquer pessoa pode pedir). */
function mensagemAluguer({ ativa = false, expiresAt = null, prefix = "." } = {}) {

    if (ativa) {
        return (
`✅ *ESTE GRUPO JÁ TEM LICENÇA*
${BOT}

Está ativa até *${dataPT(expiresAt)}*.

Para renovar, fale com o proprietário:
👑 *Edilton Ronaldo* — wa.me/${config.OWNER_NUMBER}

Receberá um código. Escreva: *${prefix}ativar CÓDIGO*
O tempo novo é somado ao que ainda resta.`
        );
    }

    return (
`🐻 *ALUGUE O URSINHO X BOT V2*

*O que o bot faz no seu grupo:*
• Administração: banir, avisar, silenciar, abrir e fechar o grupo
• Segurança: antilink, antiflood, anti-palavrão
• Vendas: tabelas, pagamentos e clientes
• IA, downloads de música e vídeo, jogos

*Como alugar:*
1️⃣ Fale com o proprietário: 👑 *Edilton Ronaldo*
   wa.me/${config.OWNER_NUMBER}
2️⃣ Combine o tempo e o pagamento
3️⃣ Receberá um código. Escreva no grupo: *${prefix}ativar CÓDIGO*
${rodape()}
${BOT}`
    ).replace(/\n{3,}/g, "\n\n");
}

/** Depois de ativar com sucesso. */
function mensagemAtivado({ expiresAt, renewed = false, duration = null, prefix = "." }) {

    const data = new Date(expiresAt).toLocaleString("pt-PT");

    return (
`✅ *${renewed ? "LICENÇA RENOVADA" : "BOT ATIVADO"}*
${BOT}

${renewed
    ? "O tempo novo foi somado ao que ainda restava."
    : "Já pode usar o bot neste grupo."}
${duration ? `\n⏳ Duração adicionada: *${duration}*` : ""}
📅 Válida até: *${data}*

Escreva *${prefix}menu* para ver os comandos.
${BOT}`
    ).replace(/\n{3,}/g, "\n\n");
}

/** Erros do comando ativar, em linguagem simples. */
function erroAtivacao(erro, prefix = ".") {

    const e = String(erro || "");

    if (/não encontrado/i.test(e)) {
        return (
`❌ *Código não encontrado.*

Confira se escreveu igual ao que recebeu (letras e números).
Exemplo: *${prefix}ativar UX-ABC1234567*

Se continuar a falhar, fale com o proprietário.`
        );
    }

    if (/já usou/i.test(e)) {
        return (
`❌ *Este grupo já usou esse código.*

Cada código só vale uma vez por grupo.
Para mais tempo, peça um código novo ao proprietário.`
        );
    }

    if (/limite de uso/i.test(e)) {
        return (
`❌ *Esse código já foi usado o máximo de vezes.*

Peça um código novo ao proprietário.`
        );
    }

    return `❌ ${e || "Não foi possível ativar. Fale com o proprietário."}`;
}

/** Aviso no privado do bot. */
function mensagemPrivado() {
    return (
`🚫 *O bot não atende no privado.*

Use os comandos dentro de um grupo onde o bot esteja.
Se continuar a escrever aqui, o seu número será bloqueado.

📞 Quer alugar o bot para o seu grupo?
Fale com o proprietário: wa.me/${config.OWNER_NUMBER}`
    );
}

module.exports = {
    mensagemSemLicenca,
    mensagemAluguer,
    mensagemAtivado,
    erroAtivacao,
    mensagemPrivado
};
