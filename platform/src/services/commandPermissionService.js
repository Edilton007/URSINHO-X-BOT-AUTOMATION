// ============================================================
// PERMISSÃO CENTRAL DOS COMANDOS
//
// Um comando declara `permission: "admin"` ou `"owner"` e o
// handler aplica a regra num só lugar, com mensagens iguais.
// (As verificações antigas dentro dos comandos continuam como
// segunda barreira — não foram removidas.)
// ============================================================

const MENSAGENS = {
    admin: "❌ Apenas administradores podem usar este comando.",
    owner: "❌ Apenas o dono do bot pode usar este comando."
};

function temPermissao(permissaoDaPessoa, exigida) {

    if (!exigida) return true;

    if (exigida === "owner") return permissaoDaPessoa === "owner";

    // "admin": administradores e o dono
    return permissaoDaPessoa === "admin" || permissaoDaPessoa === "owner";
}

function mensagemNegado(exigida) {
    return MENSAGENS[exigida] || MENSAGENS.admin;
}

module.exports = { temPermissao, mensagemNegado };
