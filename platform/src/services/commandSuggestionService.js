// ============================================================
// AJUDA INTELIGENTE COM COMANDOS
//
// 1) "prefixo"  -> mostra o prefixo atual do grupo
// 2) comando escrito errado (.plai, .ytmp, .menuu) -> sugere o
//    comando certo, com os argumentos já prontos para copiar
// 3) prefixo errado (grupo usa "!" e a pessoa escreve ".play")
//    -> avisa qual é o prefixo certo
// 4) intenção em palavras (.baixar musica, .ajuda, .figurinha)
//    -> sugere os comandos que fazem isso
// ============================================================

// ---------- texto ----------

function normalizar(texto) {
    return String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
}

// Aproxima a pronúncia: y=i, ph=f, k=c, letras repetidas = uma
function fonetica(texto) {
    return normalizar(texto)
        .replace(/ph/g, "f")
        .replace(/y/g, "i")
        .replace(/k/g, "c")
        .replace(/(.)\1+/g, "$1");
}

// Distância de edição com troca de letras vizinhas (ex.: "paly" -> "play")
function distancia(a, b) {

    const la = a.length;
    const lb = b.length;

    if (!la) return lb;
    if (!lb) return la;

    const d = Array.from({ length: la + 1 }, () => new Array(lb + 1).fill(0));

    for (let i = 0; i <= la; i++) d[i][0] = i;
    for (let j = 0; j <= lb; j++) d[0][j] = j;

    for (let i = 1; i <= la; i++) {
        for (let j = 1; j <= lb; j++) {

            const custo = a[i - 1] === b[j - 1] ? 0 : 1;

            d[i][j] = Math.min(
                d[i - 1][j] + 1,
                d[i][j - 1] + 1,
                d[i - 1][j - 1] + custo
            );

            if (
                i > 1 && j > 1 &&
                a[i - 1] === b[j - 2] &&
                a[i - 2] === b[j - 1]
            ) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
            }
        }
    }

    return d[la][lb];
}

// ---------- sinónimos (palavra -> comandos que resolvem) ----------

const SINONIMOS = {
    baixar: ["play", "ytmp3", "ytmp4", "facebook"],
    baixa: ["play", "ytmp3", "ytmp4"],
    download: ["play", "ytmp3", "ytmp4", "menudownload"],
    downloads: ["menudownload"],
    descarregar: ["play", "ytmp3", "ytmp4"],
    musica: ["play", "ytmp3"],
    musicas: ["play", "ytmp3"],
    som: ["play", "ytmp3"],
    cancao: ["play"],
    tocar: ["play"],
    toca: ["play"],
    mp3: ["ytmp3"],
    mp4: ["ytmp4"],
    video: ["ytmp4"],
    videos: ["ytmp4"],
    filme: ["ytmp4"],
    figurinha: ["sticker"],
    figurinhas: ["sticker"],
    stiker: ["sticker"],
    stickers: ["sticker"],
    ajuda: ["menu", "comandos"],
    help: ["menu", "comandos"],
    socorro: ["menu"],
    inicio: ["menu"],
    iniciar: ["menu"],
    start: ["menu"],
    lista: ["comandos", "menu"],
    listar: ["comandos"],
    comando: ["comandos", "menu"],
    clima: ["clima"],
    previsao: ["clima"],
    meteorologia: ["clima"],
    gpt: ["ai", "chat"],
    chatgpt: ["ai", "chat"],
    inteligencia: ["ai", "menuia"],
    robo: ["ai"],
    conversar: ["chat", "ai"],
    falar: ["falar"],
    narrar: ["falar"],
    audio: ["ytmp3", "falar"],
    banir: ["ban"],
    expulsar: ["ban"],
    remover: ["ban"],
    silenciar: ["mute"],
    calar: ["mute"],
    promover: ["promover"],
    rebaixar: ["despromover"],
    preco: ["tabela"],
    precos: ["tabela"],
    comprar: ["compra"],
    pagar: ["pagamento", "compra"],
    jogar: ["jogos", "menujogos"],
    jogo: ["jogos", "menujogos"],
    brincar: ["brincadeiras"],
    traduzir: ["traduzir"],
    resumir: ["resumir"],
    prefixo: ["setprefix"],
    prefix: ["setprefix"],
    alugar: ["alugar"],
    licenca: ["statusaluguel", "alugar"],
    dono: ["menudono"],
    admins: ["listadmins"],
    marcar: ["todos"],
    perfil: ["perfil"],
    foto: ["imagem", "ler"],
    ocr: ["ler"],
    limpar: ["limpar", "limpeza"]
};

// ---------- índice ----------

let indiceCache = { tamanho: -1, chaves: [] };

function obterChaves(commands) {

    if (indiceCache.tamanho === commands.size && indiceCache.ref === commands) {
        return indiceCache.chaves;
    }

    const chaves = [];

    for (const [chave, cmd] of commands.entries()) {
        chaves.push({
            chave: String(chave),
            norm: normalizar(chave),
            fon: fonetica(chave),
            cmd
        });
    }

    indiceCache = { tamanho: commands.size, ref: commands, chaves };

    return chaves;
}

function descricaoDe(cmd) {
    return String(cmd?.description || "").trim();
}

// ---------- 2) sugerir por parecença ----------

function pontuar(digitado, entrada) {

    const a = normalizar(digitado);
    const b = entrada.norm;

    if (!a || !b) return 0;

    if (a === b) return 1;

    const fa = fonetica(digitado);

    if (fa && fa === entrada.fon) return 0.95;

    const d = Math.min(
        distancia(a, b),
        distancia(fa, entrada.fon) + 0.3
    );

    const maximo = Math.max(a.length, b.length);

    let sim = 1 - d / maximo;

    const limiteD = maximo <= 7 ? 2 : 3;

    if (d > limiteD) sim = 0;

    // "ytmp" -> "ytmp3", "menud" -> "menudono"
    if (a.length >= 3 && b.startsWith(a)) {
        sim = Math.max(sim, 0.8 + 0.1 * (a.length / b.length));
    }

    // Só uma letra de diferença em palavras curtas continua válido
    if (maximo <= 4 && d > 1) sim = 0;

    return sim;
}

function sugerirPorParecenca(digitado, commands) {

    const resultado = new Map();

    for (const entrada of obterChaves(commands)) {

        const score = pontuar(digitado, entrada);

        if (score < 0.65) continue;

        const nome = entrada.cmd.name || entrada.chave;

        const atual = resultado.get(nome);

        if (!atual || score > atual.score) {
            resultado.set(nome, {
                nome,
                cmd: entrada.cmd,
                score,
                motivo: "parecido"
            });
        }
    }

    return [...resultado.values()];
}

// ---------- 4) sugerir por intenção (palavras) ----------

function palavrasUteis(texto) {
    return String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-z0-9]+/)
        .filter(p => p.length >= 3)
        .slice(0, 6);
}

function sugerirPorIntencao(digitado, argsTexto, commands) {

    const resultado = new Map();

    const palavras = palavrasUteis(`${digitado} ${argsTexto || ""}`);

    // sinónimos conhecidos
    for (const palavra of palavras) {

        const alvos = SINONIMOS[palavra];

        if (!alvos) continue;

        for (const alvo of alvos) {

            const cmd = commands.get(alvo);

            if (!cmd) continue;

            const nome = cmd.name || alvo;

            const antigo = resultado.get(nome);

            const score = palavra === palavras[0] ? 0.7 : 0.62;

            if (!antigo || score > antigo.score) {
                resultado.set(nome, { nome, cmd, score, motivo: "intencao" });
            }
        }
    }

    // palavras que aparecem na descrição do comando
    const vistos = new Set();

    for (const [, cmd] of commands.entries()) {

        if (vistos.has(cmd)) continue;

        vistos.add(cmd);

        const texto = normalizar(`${cmd.name} ${descricaoDe(cmd)}`);

        const acertos =
            palavras.filter(p => texto.includes(p)).length;

        // 1 palavra só conta se for a principal e específica (≥5 letras);
        // senão exige pelo menos 2 palavras na descrição.
        const forte =
            acertos >= 2 ||
            (acertos === 1 &&
                palavras[0] &&
                palavras[0].length >= 5 &&
                texto.includes(palavras[0]));

        if (forte && palavras.length) {

            const score = 0.5 + 0.1 * Math.min(acertos, 3);

            const nome = cmd.name;

            const antigo = resultado.get(nome);

            if (!antigo || score > antigo.score) {
                resultado.set(nome, { nome, cmd, score, motivo: "descricao" });
            }
        }
    }

    return [...resultado.values()];
}

/**
 * Junta tudo e devolve até `max` sugestões, da mais provável
 * para a menos provável.
 */
function sugerirComandos(digitado, argsTexto, commands, max = 3) {

    const juntos = new Map();

    const adicionar = (lista) => {
        for (const item of lista) {
            const antigo = juntos.get(item.nome);
            if (!antigo || item.score > antigo.score) {
                juntos.set(item.nome, item);
            }
        }
    };

    adicionar(sugerirPorParecenca(digitado, commands));

    // Se já há boas sugestões por parecença, não mistura intenção fraca
    const melhorParecenca =
        Math.max(0, ...[...juntos.values()].map(i => i.score));

    if (melhorParecenca < 0.7) {
        adicionar(sugerirPorIntencao(digitado, argsTexto, commands));
    }

    const ordenados =
        [...juntos.values()].sort((x, y) => y.score - x.score);

    const melhor = ordenados[0]?.score || 0;

    // Mantém só o que está perto da melhor sugestão (evita ruído)
    return ordenados
        .filter(item => item.score >= melhor - 0.1)
        .slice(0, max);
}

// ---------- mensagem de sugestão ----------

function cortar(texto, limite) {
    const t = String(texto || "").replace(/\s+/g, " ").trim();
    return t.length > limite ? `${t.slice(0, limite - 1)}…` : t;
}

/**
 * Devolve o texto a enviar, ou null quando não vale a pena
 * responder (ex.: membro escreveu ".kkk" num grupo).
 */
function montarMensagemSugestao({
    digitado,
    argsTexto,
    prefix,
    sugestoes,
    responderSemSugestao
}) {

    if (!sugestoes.length) {

        if (!responderSemSugestao) return null;

        return (
`🤔 Não conheço o comando *${prefix}${cortar(digitado, 30)}*.

📋 Veja os comandos com *${prefix}menu* ou *${prefix}comandos*.`
        );
    }

    const numeros = ["1️⃣", "2️⃣", "3️⃣"];

    const linhas = sugestoes.map((s, i) => {

        const desc = cortar(descricaoDe(s.cmd), 55);

        return `${numeros[i]} *${prefix}${s.nome}*${desc ? ` — ${desc}` : ""}`;
    });

    const melhor = sugestoes[0];

    const argumentos = cortar(String(argsTexto || "").split("\n")[0], 80);

    const pronto =
        `${prefix}${melhor.nome}${argumentos ? ` ${argumentos}` : ""}`;

    return (
`🤔 *${prefix}${cortar(digitado, 30)}* não existe${melhor.score >= 0.8 ? " — erro de digitação?" : "."}

Talvez queira dizer:
${linhas.join("\n")}

💡 Copie e envie:
\`${pronto}\``
    );
}

// ---------- 1) pergunta pelo prefixo ----------

function ehPerguntaDePrefixo(texto) {

    const t = String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    if (!t || t.length > 45) return false;

    return /^(qual\s+(e|eh)\s+)?(qual\s+)?(o\s+|a\s+)?(meu\s+|seu\s+|teu\s+)?(prefixo|prefix)(\s+(do\s+bot|do\s+grupo|deste\s+grupo|desse\s+grupo|neste\s+grupo|atual|aqui|do\s+ursinho))?\s*[?!.]*$/.test(t);
}

function montarMensagemPrefixo({ prefix, ehDono, ehGrupo }) {

    const base =
`🔰 *Prefixo ${ehGrupo ? "deste grupo" : "do bot"}:* \`${prefix}\`

Exemplos:
• *${prefix}menu* — ver os comandos
• *${prefix}play* nome da música`;

    return ehDono
        ? `${base}\n\n⚙️ Para mudar: *${prefix}setprefix*`
        : base;
}

// ---------- 3) prefixo errado ----------

const PREFIXOS_COMUNS = ".!#/$+~,;&-%";

/**
 * Se a mensagem começa com outro símbolo + um comando que EXISTE
 * (ex.: o grupo usa "!" e a pessoa escreveu ".play calm down"),
 * devolve { comando, resto }.
 */
function detectarPrefixoErrado(texto, prefix, commands) {

    const t = String(texto || "").trim();

    if (!t || t.startsWith(prefix)) return null;

    const primeiro = t[0];

    if (!PREFIXOS_COMUNS.includes(primeiro)) return null;

    const m = t.slice(1).match(/^([a-zA-ZÀ-ÿ0-9_-]{2,25})(?:\s+([\s\S]*))?$/);

    if (!m) return null;

    const palavra = m[1].toLowerCase();

    const cmd = commands.get(palavra);

    if (!cmd) return null;

    return {
        usado: primeiro,
        comando: cmd.name || palavra,
        resto: cortar(String(m[2] || "").split("\n")[0], 80)
    };
}

function montarMensagemPrefixoErrado({ prefix, detectado }) {

    const pronto =
        `${prefix}${detectado.comando}${detectado.resto ? ` ${detectado.resto}` : ""}`;

    return (
`ℹ️ Neste grupo o prefixo é *${prefix}* (e não *${detectado.usado}*).

💡 Copie e envie:
\`${pronto}\``
    );
}

// ---------- validação do nome digitado ----------

/**
 * ".", "....", ".5kg", ".kkkkk" etc. não são tentativas de comando.
 */
function parecePedidoDeComando(raw) {
    return /^[\p{L}\p{N}_-]{2,30}$/u.test(String(raw || ""))
        && /\p{L}/u.test(String(raw || ""));
}

module.exports = {
    sugerirComandos,
    montarMensagemSugestao,
    ehPerguntaDePrefixo,
    montarMensagemPrefixo,
    detectarPrefixoErrado,
    montarMensagemPrefixoErrado,
    parecePedidoDeComando,
    // para testes
    distancia,
    normalizar,
    fonetica
};
