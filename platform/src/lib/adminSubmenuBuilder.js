const { isSalesEnabled } = require("../services/salesService");

const {
    isAtivo: isAutoResponderEnabled
} = require("../database/autoresponderDb");

/*
============================================================
URSINHO X BOT V2
ADMIN SUBMENU BUILDER
LAYOUT PREMIUM COMPACTO
============================================================
*/


function getAdminCommands(categories, tipo) {

    const mapa = {
        grupo: ["admin-grupo"],
        protecao: ["admin-protecao"],
        vendas: ["admin-vendas"],
        sistema: ["admin-sistema"]
    };

    const categorias = mapa[tipo] || [];
    const comandos = [];

    for (const categoria of categorias) {

        const lista = categories?.[categoria];

        if (!Array.isArray(lista)) {
            continue;
        }

        comandos.push(...lista);
    }

    return comandos;
}


/*
============================================================
PROTEÇÕES
============================================================
*/

const protecoes = [

    {
        comando: "antiflood",
        nome: "ANTI-FLOOD",
        chave: "flood"
    },

    {
        comando: "antilink",
        nome: "ANTI-LINK",
        chave: "link"
    },

    {
        comando: "antifoto",
        nome: "ANTI-FOTO",
        chave: "image"
    },

    {
        comando: "antiaudio",
        nome: "ANTI-ÁUDIO",
        chave: "audio"
    },

    {
        comando: "antivideo",
        nome: "ANTI-VÍDEO",
        chave: "video"
    },

    {
        comando: "antisticker",
        nome: "ANTI-STICKER",
        chave: "sticker"
    }

];


/*
============================================================
SUBMENU PROTEÇÕES
============================================================
*/

function buildProtecaoSubmenu(prefix, group = {}) {

    const anti = group?.anti || {};

    const linhas = [

        "🛡️ PROTEÇÕES",
        "",
        "Estado das proteções do grupo"

    ];

    const buttons = [];

    for (const protecao of protecoes) {

        const ativo =
            anti[protecao.chave] === true;

        linhas.push(
            `${ativo ? "🟢" : "🔴"} ${protecao.nome}`
        );

        /*
        Proteções são ações ON/OFF.
        Portanto, botões fazem sentido aqui.
        */

        buttons.push({

            texto: ativo
                ? `🔴 DESATIVAR ${protecao.nome}`
                : `🟢 ATIVAR ${protecao.nome}`,

            id:
                `${prefix}${protecao.comando} ${ativo ? "off" : "on"}`

        });
    }

    /*
    NAVEGAÇÃO
    */

    buttons.push(

        {
            texto: "⬅️ VOLTAR",
            id: `${prefix}menuadmin`
        },

        {
            texto: "🏠 MENU PRINCIPAL",
            id: `${prefix}menu`
        }

    );

    return {

        texto: linhas.join("\n"),
        buttons

    };
}


/*
============================================================
SUBMENUS ADMIN
============================================================
*/

function buildAdminSubmenu(
    categories,
    tipo,
    prefix,
    group = null
) {

    /*
    ========================================================
    PROTEÇÕES
    ========================================================
    */

    if (tipo === "protecao") {

        return buildProtecaoSubmenu(
            prefix,
            group
        );

    }


    /*
    ========================================================
    CONFIGURAÇÃO DOS SUBMENUS
    ========================================================
    */

    const config = {

        grupo: {

            titulo: "👥 GRUPO",
            descricao: "CONTROLE DO GRUPO"

        },

        vendas: {

            titulo: "💰 VENDAS",
            descricao: "CONTROLE COMERCIAL"

        },

        sistema: {

            titulo: "⚙️ SISTEMA",
            descricao: "FERRAMENTAS ADMINISTRATIVAS"

        }

    };


    const atual = config[tipo];

    if (!atual) {

        return {

            texto: "❌ SUBMENU INVÁLIDO.",
            buttons: []

        };

    }


    /*
    ========================================================
    COMANDOS DISPONÍVEIS
    ========================================================
    */

    const comandos =
        getAdminCommands(
            categories,
            tipo
        );


    /*
    ========================================================
    TEXTO DO SUBMENU
    ========================================================
    */

    const linhas = [

        atual.titulo,
        "",
        atual.descricao

    ];


    const buttons = [];


    /*
    ========================================================
    VENDAS — ESTADO REAL
    ========================================================
    */

    if (tipo === "vendas") {

        const groupId =
            group?.id ||
            group?.groupId ||
            null;

        const vendasAtivas =
            groupId
                ? isSalesEnabled(groupId)
                : false;

        linhas.push(

            "",

            vendasAtivas
                ? "🟢 VENDAS ATIVAS"
                : "🔴 VENDAS DESATIVADAS"

        );


        /*
        Ativar/desativar é uma ação ON/OFF.
        Portanto, botão faz sentido.
        */

        buttons.push({

            texto: vendasAtivas
                ? "🔴 DESATIVAR VENDAS"
                : "🟢 ATIVAR VENDAS",

            id: vendasAtivas
                ? `${prefix}compras off`
                : `${prefix}compras on`

        });

    }


    /*
    ========================================================
    NOMES DOS COMANDOS
    ========================================================
    */

    const nomes = {

        /*
        GRUPO
        */

        abrir: "🔓 ABRIR GRUPO",
        fechar: "🔒 FECHAR GRUPO",

        ban: "🚫 BANIR MEMBRO",
        despromover: "👤 REMOVER ADMIN",
        promover: "👑 PROMOVER",
        todos: "📢 MARCAR TODOS",

        /*
        SISTEMA
        */

        limpar: "🧹 LIMPAR CHAT",
        revelar: "👁️ REVELAR",
        setup: "⚙️ CONFIGURAR GRUPO",
        status: "📊 STATUS DO GRUPO",
        listadmins: "👑 ADMINISTRADORES",

        /*
        PAGAMENTOS
        */

        addbim: "🏦 ADICIONAR BIM",
        addemola: "💳 ADICIONAR eMOLA",
        addmpesa: "💰 ADICIONAR M-PESA",

        contas: "💳 CONTAS",
        delconta: "🗑️ REMOVER CONTA",

        editarpagamento: "✏️ EDITAR PAGAMENTO",

        pagamento: "💳 PAGAMENTOS",

        /*
        VENDAS
        */

        clientes: "👥 CLIENTES",
        compra: "🛒 REGISTAR COMPRA",
        pedidos: "📦 PEDIDOS",

        estatisticas: "📊 ESTATÍSTICAS",
        limparcompras: "🧹 LIMPAR COMPRAS",

        tabela: "📋 TABELA DE PREÇOS",
        vendatabela: "⚙️ CONFIGURAR TABELA",
        editarvenda: "✏️ EDITAR VENDA"

    };


    /*
    ========================================================
    COMANDOS → APENAS AÇÕES ADEQUADAS A BOTÃO
    ========================================================

    REGRA:

    Nem todo comando deve virar botão.

    Botão somente quando a ação:
    • é simples
    • não precisa de texto adicional
    • não precisa de número
    • não precisa selecionar usuário
    • não precisa receber dados
    • é útil executar por toque

    Comandos como:

    !ban
    !promover
    !despromover
    !todos
    !revelar
    !limpar
    !setup
    !addmpesa
    !addemola
    !addbim
    !delconta
    !editarpagamento
    !editarvenda
    !vendatabela
    !compra
    !limparcompras

    continuam sendo comandos escritos.
    ========================================================
    */

    const botoesPorTipo = {

        /*
        GRUPO
        */

        grupo: new Set([

            "abrir",
            "fechar",
            "listadmins"

        ]),


        /*
        SISTEMA
        */

        sistema: new Set([

            "status"

        ]),


        /*
        VENDAS
        */

        vendas: new Set([

            "clientes",
            "contas",
            "pagamento",
            "estatisticas",
            "pedidos",
            "tabela"

        ])

    };


    const permitidos =
        botoesPorTipo[tipo] ||
        new Set();


    /*
    ========================================================
    CRIAR BOTÕES PERMITIDOS
    ========================================================
    */

    for (const cmd of comandos) {

        /*
        Se o comando não estiver explicitamente
        autorizado, NÃO vira botão.
        */

        if (!permitidos.has(cmd.name)) {
            continue;
        }


        buttons.push({

            texto:
                nomes[cmd.name] ||
                `⚙️ ${String(cmd.name).toUpperCase()}`,

            id:
                `${prefix}${cmd.name}`

        });

    }


    /*
    ========================================================
    GRUPO — ESTADO REAL
    ========================================================
    */

    if (tipo === "grupo") {

        const fechado =
            group?.announce === true;

        linhas.push(

            "",

            fechado
                ? "🔴 GRUPO FECHADO"
                : "🟢 GRUPO ABERTO"

        );

    }


    /*
    ========================================================
    GRUPO — AUTO-RESPONDER (ESTADO REAL)
    ========================================================
    */

    if (tipo === "grupo") {

        const groupIdAuto =
            group?.id ||
            group?.groupId ||
            null;

        const autoAtivo =
            groupIdAuto
                ? isAutoResponderEnabled(groupIdAuto)
                : false;

        linhas.push(

            autoAtivo
                ? "🤖 AUTO-RESPONDER: 🟢 ATIVO"
                : "🤖 AUTO-RESPONDER: 🔴 INATIVO"

        );

        buttons.push({

            texto: autoAtivo
                ? "🔴 DESATIVAR AUTO-RESPONDER"
                : "🟢 ATIVAR AUTO-RESPONDER",

            id: autoAtivo
                ? `${prefix}autoresponder off`
                : `${prefix}autoresponder on`

        });

        buttons.push({
            texto: "📋 VER TERMOS",
            id: `${prefix}listaauto`
        });

    }


    /*
    ========================================================
    NAVEGAÇÃO
    ========================================================
    */

    buttons.push(

        {
            texto: "⬅️ VOLTAR",
            id: `${prefix}menuadmin`
        },

        {
            texto: "🏠 MENU PRINCIPAL",
            id: `${prefix}menu`
        }

    );


    /*
    ========================================================
    RETORNO
    ========================================================
    */

    return {

        texto: linhas.join("\n"),
        buttons

    };

}


/*
============================================================
EXPORTS
============================================================
*/

module.exports = {

    getAdminCommands,
    buildAdminSubmenu,
    buildProtecaoSubmenu

};
