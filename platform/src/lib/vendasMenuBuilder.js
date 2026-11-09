/*
============================================================
URSINHO X BOT V2
VENDAS MENU BUILDER
INTERFACE PREMIUM COMPACTA
============================================================
*/


function getCommands(categories, category, names = []) {

    const lista =
        categories?.[category] || [];

    return names
        .map(name =>
            lista.find(cmd =>
                String(cmd.name).toLowerCase() ===
                String(name).toLowerCase()
            )
        )
        .filter(Boolean);

}


/*
============================================================
MENU PRINCIPAL — VENDAS
============================================================
*/

function buildVendasMenu() {

    const texto = [

        "💰 𝐕𝐄𝐍𝐃𝐀𝐒",
        "𝐂𝐄𝐍𝐓𝐑𝐀𝐋 𝐂𝐎𝐌𝐄𝐑𝐂𝐈𝐀𝐋",
        "",
        "⚡ 𝐆𝐄𝐒𝐓Ã𝐎 𝐂𝐎𝐌𝐄𝐑𝐂𝐈𝐀𝐋",
        "",
        "🛒 Gestão de vendas",
        "💳 Pagamentos",
        "📊 Tabela de preços",
        "🤖 VENDAIA"

    ].join("\n");


    return texto;

}


/*
============================================================
SUBMENUS
============================================================
*/

function buildVendasSubmenu(
    prefix,
    categories,
    tipo
) {

    const mapas = {


        /*
        ====================================================
        VENDAS
        ====================================================
        */

        vendas: {

            titulo:
                "🛒 𝐕𝐄𝐍𝐃𝐀𝐒",

            descricao:
                "𝐆𝐄𝐒𝐓Ã𝐎 𝐂𝐎𝐌𝐄𝐑𝐂𝐈𝐀𝐋",

            comandos: [

                "compra",
                "clientes",
                "pedidos",
                "estatisticas",
                "limparcompras"

            ],

            botoes: [

                "clientes",
                "pedidos",
                "estatisticas"

            ]

        },


        /*
        ====================================================
        PAGAMENTOS
        ====================================================
        */

        pagamentos: {

            titulo:
                "💳 𝐏𝐀𝐆𝐀𝐌𝐄𝐍𝐓𝐎𝐒",

            descricao:
                "𝐆𝐄𝐒𝐓Ã𝐎 𝐅𝐈𝐍𝐀𝐍𝐂𝐄𝐈𝐑𝐀",

            comandos: [

                "pagamento",
                "editarpagamento",
                "contas",
                "addmpesa",
                "addemola",
                "addbim",
                "delconta"

            ],

            botoes: [

                "pagamento",
                "contas"

            ]

        },


        /*
        ====================================================
        TABELA
        ====================================================
        */

        tabela: {

            titulo:
                "📊 𝐓𝐀𝐁𝐄𝐋𝐀",

            descricao:
                "𝐆𝐄𝐒𝐓Ã𝐎 𝐃𝐄 𝐏𝐑𝐎𝐃𝐔𝐓𝐎𝐒",

            comandos: [

                "tabela",
                "vendatabela",
                "editarvenda"

            ],

            botoes: [

                "tabela"

            ]

        }

    };


    const config =
        mapas[tipo];


    if (!config) {

        return {

            texto:
                "❌ Submenu de vendas inválido.",

            buttons: []

        };

    }


    /*
    ========================================================
    LOCALIZAR COMANDOS EXISTENTES
    ========================================================
    */

    const comandos =
        getCommands(
            categories,
            "admin-vendas",
            config.comandos
        );


    const encontrados =
        new Set(
            comandos.map(
                cmd => cmd.name
            )
        );


    /*
    ========================================================
    NOMES VISUAIS
    ========================================================
    */

    const nomes = {

        compra:
            "🛒 REGISTAR COMPRA",

        clientes:
            "👥 CLIENTES",

        compras:
            "📦 PEDIDOS / COMPRAS",

        pedidos:
            "📦 PEDIDOS",

        estatisticas:
            "📊 ESTATÍSTICAS",

        limparcompras:
            "🧹 LIMPAR COMPRAS",

        pagamento:
            "💳 PAGAMENTOS",

        editarpagamento:
            "✏️ EDITAR PAGAMENTO",

        contas:
            "💳 CONTAS",

        addmpesa:
            "💰 ADICIONAR M-PESA",

        addemola:
            "💳 ADICIONAR eMOLA",

        addbim:
            "🏦 ADICIONAR BIM",

        delconta:
            "🗑️ REMOVER CONTA",

        tabela:
            "📋 TABELA DE PREÇOS",

        vendatabela:
            "⚙️ CONFIGURAR TABELA",

        editarvenda:
            "✏️ EDITAR VENDA"

    };


    /*
    ========================================================
    TEXTO PREMIUM
    ========================================================
    */

    const linhas = [

        config.titulo,
        "",
        config.descricao,
        ""

    ];


    /*
    --------------------------------------------------------
    VENDAS
    --------------------------------------------------------
    */

    if (tipo === "vendas") {

        if (encontrados.has("compra")) {

            linhas.push(
                "🛒 REGISTAR COMPRA"
            );

        }

        if (encontrados.has("clientes")) {

            linhas.push(
                "👥 CLIENTES"
            );

        }

        if (
            encontrados.has("compras") ||
            encontrados.has("pedidos")
        ) {

            linhas.push(
                "📦 PEDIDOS / COMPRAS"
            );

        }

        if (encontrados.has("estatisticas")) {

            linhas.push(
                "📊 ESTATÍSTICAS"
            );

        }

        if (encontrados.has("limparcompras")) {

            linhas.push(
                "🧹 LIMPEZA DE COMPRAS"
            );

        }

    }


    /*
    --------------------------------------------------------
    PAGAMENTOS
    --------------------------------------------------------
    */

    if (tipo === "pagamentos") {

        if (encontrados.has("pagamento")) {

            linhas.push(
                "💳 PAGAMENTOS"
            );

        }

        if (encontrados.has("contas")) {

            linhas.push(
                "💳 CONTAS"
            );

        }

        if (
            encontrados.has("addmpesa") ||
            encontrados.has("addemola") ||
            encontrados.has("addbim")
        ) {

            linhas.push(
                "💰 M-PESA • eMOLA • BIM"
            );

        }

        if (encontrados.has("delconta")) {

            linhas.push(
                "🗑️ GESTÃO DE CONTAS"
            );

        }

        if (encontrados.has("editarpagamento")) {

            linhas.push(
                "✏️ EDIÇÃO DE PAGAMENTOS"
            );

        }

    }


    /*
    --------------------------------------------------------
    TABELA
    --------------------------------------------------------
    */

    if (tipo === "tabela") {

        if (encontrados.has("tabela")) {

            linhas.push(
                "📋 TABELA DE PREÇOS"
            );

        }

        if (encontrados.has("vendatabela")) {

            linhas.push(
                "⚙️ CONFIGURAÇÃO"
            );

        }

        if (encontrados.has("editarvenda")) {

            linhas.push(
                "✏️ EDIÇÃO DE VENDAS"
            );

        }

    }


    /*
    ========================================================
    BOTÕES
    ========================================================
    */

    const buttons = [];

    const botoesPermitidos =
        new Set(
            config.botoes
        );


    for (const cmd of comandos) {

        if (
            !botoesPermitidos.has(cmd.name)
        ) {

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
    NAVEGAÇÃO
    ========================================================
    */

    buttons.push(

        {
            texto:
                "⬅️ VENDAS",

            id:
                `${prefix}menuvendas`

        },

        {
            texto:
                "🏠 MENU PRINCIPAL",

            id:
                `${prefix}menu`

        }

    );


    /*
    ========================================================
    RETORNO
    ========================================================
    */

    return {

        texto:
            linhas.join("\n"),

        buttons

    };

}


module.exports = {

    buildVendasMenu,
    buildVendasSubmenu

};
