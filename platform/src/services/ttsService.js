const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const FFMPEG_PATH =
    process.env.FFMPEG_PATH ||
    require("@ffmpeg-installer/ffmpeg").path;

const ROOT_DIR = path.join(__dirname, "..", "..");
const TTS_TMP_DIR = path.join(ROOT_DIR, "tmp");

function ensureTmpDir() {
    if (!fs.existsSync(TTS_TMP_DIR)) {
        fs.mkdirSync(TTS_TMP_DIR, { recursive: true });
    }
}

const { getApiKeys } = require("./geminiService");

// ============================================================
// CONFIGURAÇÃO (tudo opcional via .env)
//
// TTS_PROVIDERS     ordem dos motores. Padrão: gemini,elevenlabs,edge
// TTS_MAX_CHARS     máximo de caracteres por áudio (padrão 4500 ≈ 4-5 min)
// TTS_CHUNK_CHARS   tamanho de cada pedaço enviado (padrão 1800 ≈ 2 min)
// GEMINI_TTS_MODEL  modelo(s) preferido(s), separados por vírgula
// GEMINI_TTS_API_KEYS  chaves extras só para voz, separadas por vírgula
// ELEVENLABS_API_KEY / _2 / _3 ...   (opcional)
// ELEVENLABS_VOICE_ID                (opcional)
// EDGE_TTS_VOICE    voz do Edge (padrão pt-PT-RaquelNeural, sem chave)
// ============================================================

const MAX_CHARS =
    parseInt(process.env.TTS_MAX_CHARS || "4500", 10);

const CHUNK_CHARS =
    parseInt(process.env.TTS_CHUNK_CHARS || "1800", 10);

const PCM_SAMPLE_RATE = 24000;

const MODELOS_PADRAO = [
    "gemini-3.8-flash-tts",
    "gemini-3.8-flash-lite-tts",
    "gemini-2.5-flash-preview-tts"
];

function getGeminiModels() {

    const doEnv =
        String(process.env.GEMINI_TTS_MODEL || "")
            .split(",")
            .map(m => m.trim())
            .filter(Boolean);

    return [...new Set([...doEnv, ...MODELOS_PADRAO])];
}

const VOICE_NAME =
    process.env.GEMINI_TTS_VOICE || "Kore";

// ============================================================
// VOZES DISPONÍVEIS (Gemini TTS — 30 vozes pré-definidas,
// nomeadas por objetos astronómicos, cada uma com um estilo)
// ============================================================

const VOZES_DISPONIVEIS = {
    "Zephyr": "Brilhante",
    "Puck": "Animada",
    "Charon": "Informativa",
    "Kore": "Firme",
    "Fenrir": "Enérgica",
    "Leda": "Jovem",
    "Orus": "Firme",
    "Aoede": "Suave",
    "Callirrhoe": "Descontraída",
    "Autonoe": "Brilhante",
    "Enceladus": "Sussurrada",
    "Iapetus": "Clara",
    "Umbriel": "Descontraída",
    "Algieba": "Suave",
    "Despina": "Suave",
    "Erinome": "Clara",
    "Algenib": "Rouca",
    "Rasalgethi": "Informativa",
    "Laomedeia": "Animada",
    "Achernar": "Suave",
    "Alnilam": "Firme",
    "Schedar": "Uniforme",
    "Gacrux": "Madura",
    "Pulcherrima": "Direta",
    "Achird": "Amigável",
    "Zubenelgenubi": "Casual",
    "Vindemiatrix": "Gentil",
    "Sadachbia": "Animada",
    "Sadaltager": "Sábia",
    "Sulafat": "Calorosa"
};

function getVozesDisponiveis() {
    return VOZES_DISPONIVEIS;
}

function vozValida(nome) {
    if (!nome) return null;
    const encontrada = Object.keys(VOZES_DISPONIVEIS).find(
        v => v.toLowerCase() === String(nome).toLowerCase()
    );
    return encontrada || null;
}

// ============================================================
// CHAVES
// ============================================================

function coletarChaves(prefixo) {

    const chaves = [];

    const adicionar = (valor) => {
        const chave = String(valor || "").trim();
        if (chave && !chaves.includes(chave)) {
            chaves.push(chave);
        }
    };

    adicionar(process.env[prefixo]);

    for (let i = 2; i <= 30; i++) {
        adicionar(process.env[`${prefixo}_${i}`]);
    }

    return chaves;
}

function getGeminiKeys() {

    const extras =
        String(process.env.GEMINI_TTS_API_KEYS || "")
            .split(",")
            .map(c => c.trim())
            .filter(Boolean);

    return [...new Set([...getApiKeys(), ...extras])];
}

function getElevenKeys() {
    return coletarChaves("ELEVENLABS_API_KEY");
}

function edgeInstalado() {
    try {
        require.resolve("edge-tts-universal");
        return true;
    } catch {
        return false;
    }
}

function temTtsConfigurado() {
    return (
        getGeminiKeys().length > 0 ||
        getElevenKeys().length > 0 ||
        edgeInstalado()
    );
}

// ============================================================
// ERROS COM MENSAGEM PARA O UTILIZADOR
// ============================================================

class TtsError extends Error {
    constructor(message, userMessage) {
        super(message);
        this.userMessage = userMessage;
    }
}

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// LIMPEZA E DIVISÃO DO TEXTO
// ============================================================

function limparTexto(texto) {

    return String(texto || "")
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/[*_~`#>|]+/g, "")
        .replace(/\p{Extended_Pictographic}/gu, "")
        .replace(/[\u200d\ufe0f]/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function cortarNaFrase(texto, limite) {

    if (texto.length <= limite) {
        return texto;
    }

    const trecho = texto.slice(0, limite);

    const fim = Math.max(
        trecho.lastIndexOf(". "),
        trecho.lastIndexOf("! "),
        trecho.lastIndexOf("? "),
        trecho.lastIndexOf("\n")
    );

    return fim > limite * 0.5
        ? trecho.slice(0, fim + 1)
        : trecho;
}

/**
 * Divide o texto em pedaços de até `limite` caracteres,
 * sempre no fim de uma frase (ou no último espaço).
 */
function dividirTexto(texto, limite) {

    const pedacos = [];
    let resto = texto.trim();

    while (resto.length > limite) {

        let corte = cortarNaFrase(resto, limite);

        if (corte.length === limite) {
            const espaco = corte.lastIndexOf(" ");
            if (espaco > limite * 0.5) {
                corte = corte.slice(0, espaco);
            }
        }

        pedacos.push(corte.trim());
        resto = resto.slice(corte.length).trim();
    }

    if (resto) {
        pedacos.push(resto);
    }

    return pedacos;
}

// ============================================================
// ÁUDIO: WAV / PCM / FFMPEG
// ============================================================

function criarWav(pcmBuffer, sampleRate = PCM_SAMPLE_RATE, channels = 1, bitsPorAmostra = 16) {

    const byteRate = sampleRate * channels * (bitsPorAmostra / 8);
    const blockAlign = channels * (bitsPorAmostra / 8);
    const dataSize = pcmBuffer.length;

    const header = Buffer.alloc(44);

    header.write("RIFF", 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPorAmostra, 34);
    header.write("data", 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmBuffer]);
}

function extrairSampleRate(mimeType) {
    const match = String(mimeType || "").match(/rate=(\d+)/);
    return match ? parseInt(match[1], 10) : PCM_SAMPLE_RATE;
}

/**
 * Converte qualquer áudio (mp3, wav...) em PCM 16-bit mono 24 kHz,
 * para que pedaços de motores diferentes possam ser juntados.
 */
async function paraPcm(buffer, extensao = "mp3") {

    ensureTmpDir();

    const base = path.join(
        TTS_TMP_DIR,
        `pcm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );

    const entrada = `${base}.${extensao}`;
    const saida = `${base}.pcm`;

    fs.writeFileSync(entrada, buffer);

    try {

        await execFileAsync(
            FFMPEG_PATH,
            [
                "-y",
                "-i", entrada,
                "-f", "s16le",
                "-acodec", "pcm_s16le",
                "-ar", String(PCM_SAMPLE_RATE),
                "-ac", "1",
                saida
            ],
            { timeout: 60000 }
        );

        return fs.readFileSync(saida);

    } finally {
        try { fs.unlinkSync(entrada); } catch {}
        try { fs.unlinkSync(saida); } catch {}
    }
}

// ============================================================
// MOTOR 1: GEMINI TTS (rotação de chaves e modelos)
// ============================================================

const cooldowns = new Map();   // "chave|modelo" -> timestamp liberado
const modelosMortos = new Set();
const chavesMortas = new Set();
let rodizio = 0;

function idChave(chave) {
    return `…${String(chave).slice(-6)}`;
}

async function geminiChunk(texto, nomeVoz) {

    const inicio = Date.now();
    let ultimoErro = "falha desconhecida";
    let viuQuota = false;

    while (Date.now() - inicio < 150000) {

        const chaves =
            getGeminiKeys().filter(c => !chavesMortas.has(c));

        const modelos =
            getGeminiModels().filter(m => !modelosMortos.has(m));

        if (!chaves.length) {
            throw new TtsError(
                "Sem chaves Gemini válidas.",
                "As chaves Gemini do bot são inválidas ou não existem."
            );
        }

        if (!modelos.length) {
            throw new TtsError(
                "Nenhum modelo Gemini TTS disponível.",
                "Os modelos de voz do Gemini não estão mais disponíveis. Atualiza o GEMINI_TTS_MODEL."
            );
        }

        const combinacoes = [];

        for (let k = 0; k < chaves.length; k++) {
            const chave = chaves[(k + rodizio) % chaves.length];
            for (const modelo of modelos) {
                combinacoes.push({ chave, modelo });
            }
        }

        rodizio++;

        const agora = Date.now();

        const livres = combinacoes.filter(
            c => (cooldowns.get(`${c.chave}|${c.modelo}`) || 0) <= agora
        );

        if (!livres.length) {

            const proxima = Math.min(
                ...combinacoes.map(
                    c => cooldowns.get(`${c.chave}|${c.modelo}`) || 0
                )
            );

            const espera = proxima - agora;

            // Só vale esperar se a cota volta em menos de ~70 s
            if (espera > 0 && espera <= 70000) {
                await esperar(espera + 500);
                continue;
            }

            break;
        }

        for (const { chave, modelo } of livres) {

            for (let tentativa = 1; tentativa <= 2; tentativa++) {

                try {

                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "x-goog-api-key": chave
                            },
                            signal: AbortSignal.timeout(120000),
                            body: JSON.stringify({
                                contents: [
                                    {
                                        role: "user",
                                        parts: [{ text: texto }]
                                    }
                                ],
                                generationConfig: {
                                    responseModalities: ["AUDIO"],
                                    speechConfig: {
                                        voiceConfig: {
                                            prebuiltVoiceConfig: {
                                                voiceName: nomeVoz
                                            }
                                        }
                                    }
                                }
                            })
                        }
                    );

                    let json = null;

                    try {
                        json = await response.json();
                    } catch {}

                    if (response.ok) {

                        const partes =
                            json?.candidates?.[0]?.content?.parts || [];

                        const audio =
                            partes.find(p => p?.inlineData?.data)?.inlineData;

                        if (audio?.data) {
                            return {
                                pcm: Buffer.from(audio.data, "base64"),
                                sampleRate: extrairSampleRate(audio.mimeType)
                            };
                        }

                        ultimoErro = "o Gemini não devolveu áudio";
                        continue; // tenta de novo / próxima combinação
                    }

                    const mensagem =
                        json?.error?.message || `HTTP ${response.status}`;

                    ultimoErro = `${modelo} ${idChave(chave)}: ${mensagem}`;

                    if (response.status === 429) {

                        viuQuota = true;

                        const diaria =
                            /per ?day|daily|PerDay/i.test(mensagem);

                        cooldowns.set(
                            `${chave}|${modelo}`,
                            Date.now() + (diaria ? 3600000 : 65000)
                        );

                        break; // próxima combinação
                    }

                    if (response.status === 404) {
                        modelosMortos.add(modelo);
                        console.warn(`⚠️ TTS: modelo ${modelo} não existe mais — ignorado.`);
                        break;
                    }

                    if (
                        response.status === 403 ||
                        /API key not valid|API_KEY_INVALID/i.test(mensagem)
                    ) {
                        chavesMortas.add(chave);
                        console.warn(`⚠️ TTS: chave ${idChave(chave)} inválida — ignorada.`);
                        break;
                    }

                    // 400/5xx: erro passageiro, tenta de novo uma vez
                    if (tentativa < 2) {
                        await esperar(1500);
                    }

                } catch (error) {

                    ultimoErro =
                        `${modelo} ${idChave(chave)}: ${error?.message || error}`;

                    if (tentativa < 2) {
                        await esperar(1500);
                    }
                }
            }
        }
    }

    console.error("❌ Gemini TTS esgotado:", ultimoErro);

    throw new TtsError(
        `Gemini TTS: ${ultimoErro}`,
        viuQuota
            ? "A cota de voz do Gemini acabou por agora. Tenta de novo em alguns minutos."
            : "O serviço de voz do Gemini falhou."
    );
}

async function motorGemini(pedacos, vozEscolhida) {

    const nomeVoz = vozValida(vozEscolhida) || VOICE_NAME;

    const partes = [];

    for (const pedaco of pedacos) {

        const { pcm, sampleRate } =
            await geminiChunk(pedaco, nomeVoz);

        // Normaliza para 24 kHz se vier outra taxa
        if (sampleRate !== PCM_SAMPLE_RATE) {
            const wav = criarWav(pcm, sampleRate);
            partes.push(await paraPcm(wav, "wav"));
        } else {
            partes.push(pcm);
        }
    }

    return partes;
}

// ============================================================
// MOTOR 2: ELEVENLABS (opcional, precisa de chave)
// ============================================================

async function motorElevenLabs(pedacos) {

    const chaves = getElevenKeys();

    if (!chaves.length) {
        throw new TtsError("ElevenLabs sem chave.", "ElevenLabs não configurado.");
    }

    const voiceId =
        process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

    const partes = [];

    for (const pedaco of pedacos) {

        let audio = null;
        let ultimoErro = "falha desconhecida";

        for (const chave of chaves) {

            try {

                const response = await fetch(
                    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
                    {
                        method: "POST",
                        headers: {
                            "xi-api-key": chave,
                            "Content-Type": "application/json",
                            "Accept": "audio/mpeg"
                        },
                        signal: AbortSignal.timeout(120000),
                        body: JSON.stringify({
                            text: pedaco,
                            model_id: "eleven_multilingual_v2"
                        })
                    }
                );

                if (response.ok) {
                    audio = Buffer.from(await response.arrayBuffer());
                    break;
                }

                ultimoErro = `HTTP ${response.status}`;

            } catch (error) {
                ultimoErro = error?.message || String(error);
            }
        }

        if (!audio) {
            throw new TtsError(
                `ElevenLabs: ${ultimoErro}`,
                "O ElevenLabs falhou."
            );
        }

        partes.push(await paraPcm(audio, "mp3"));
    }

    return partes;
}

// ============================================================
// MOTOR 3: EDGE TTS (grátis, sem chave — pacote edge-tts-universal)
// ============================================================

async function motorEdge(pedacos) {

    if (!edgeInstalado()) {
        throw new TtsError(
            "edge-tts-universal não instalado.",
            "O motor de voz gratuito não está instalado."
        );
    }

    const { EdgeTTS } = await import("edge-tts-universal");

    const voz =
        process.env.EDGE_TTS_VOICE || "pt-PT-RaquelNeural";

    const partes = [];

    for (const pedaco of pedacos) {

        try {

            const tts = new EdgeTTS(pedaco, voz);
            const resultado = await tts.synthesize();

            const mp3 =
                Buffer.from(await resultado.audio.arrayBuffer());

            partes.push(await paraPcm(mp3, "mp3"));

        } catch (error) {

            throw new TtsError(
                `Edge TTS: ${error?.message || error}`,
                "O motor de voz gratuito falhou."
            );
        }
    }

    return partes;
}

// ============================================================
// GERAR ÁUDIO
// ============================================================

function listaMotores() {

    const ordem =
        String(process.env.TTS_PROVIDERS || "gemini,elevenlabs,edge")
            .split(",")
            .map(m => m.trim().toLowerCase())
            .filter(Boolean);

    const motores = [];

    for (const nome of ordem) {

        if (nome === "gemini" && getGeminiKeys().length) {
            motores.push({ nome, run: motorGemini });
        }

        if (nome === "elevenlabs" && getElevenKeys().length) {
            motores.push({ nome, run: (p) => motorElevenLabs(p) });
        }

        if (nome === "edge" && edgeInstalado()) {
            motores.push({ nome, run: (p) => motorEdge(p) });
        }
    }

    return motores;
}

/**
 * Gera um áudio (ogg/opus, pronto pra nota de voz do WhatsApp)
 * a partir de um texto de até TTS_MAX_CHARS caracteres.
 * Retorna o caminho do arquivo, ou null se não houver motor.
 *
 * options.maxChars  limite de caracteres só desta chamada
 */
async function generateSpeech(texto, vozEscolhida = null, options = {}) {

    const motores = listaMotores();

    if (!motores.length) {
        return null;
    }

    const limpo = limparTexto(texto);

    if (!limpo) {
        throw new TtsError(
            "Texto vazio pro TTS.",
            "Não há texto para falar."
        );
    }

    const limite = options.maxChars || MAX_CHARS;

    const textoFinal = cortarNaFrase(limpo, limite);

    const pedacos = dividirTexto(textoFinal, CHUNK_CHARS);

    ensureTmpDir();

    let partesPcm = null;
    const falhas = [];
    const mensagensUsuario = [];

    for (const motor of motores) {

        try {

            partesPcm = await motor.run(pedacos, vozEscolhida);

            if (falhas.length) {
                console.log(
                    `🎙️ TTS: usado motor "${motor.nome}" após falha de: ${falhas.join(" | ")}`
                );
            }

            break;

        } catch (error) {

            falhas.push(`${motor.nome}: ${error?.message || error}`);

            if (error?.userMessage) {
                mensagensUsuario.push(error.userMessage);
            }

            console.error(
                `❌ TTS motor "${motor.nome}" falhou:`,
                error?.message || error
            );

            partesPcm = null;
        }
    }

    if (!partesPcm) {

        const cota =
            mensagensUsuario.find(m => /cota/i.test(m));

        throw new TtsError(
            falhas.join(" | "),
            cota ||
            "Não consegui gerar o áudio agora (todos os motores de voz falharam). Tenta de novo daqui a pouco."
        );
    }

    // Junta os pedaços com ~250 ms de pausa entre eles
    const silencio =
        Buffer.alloc(Math.round(PCM_SAMPLE_RATE * 2 * 0.25));

    const pcmFinal = Buffer.concat(
        partesPcm.flatMap((parte, i) =>
            i < partesPcm.length - 1 ? [parte, silencio] : [parte]
        )
    );

    const wavBuffer = criarWav(pcmFinal, PCM_SAMPLE_RATE);

    const nomeBase = `tts-${Date.now()}`;
    const wavPath = path.join(TTS_TMP_DIR, `${nomeBase}.wav`);
    const oggPath = path.join(TTS_TMP_DIR, `${nomeBase}.ogg`);

    fs.writeFileSync(wavPath, wavBuffer);

    try {

        await execFileAsync(
            FFMPEG_PATH,
            [
                "-y",
                "-i", wavPath,
                "-c:a", "libopus",
                "-ar", "48000",
                "-ac", "1",
                "-b:a", "32k",
                oggPath
            ],
            { timeout: 120000 }
        );

    } finally {
        try { fs.unlinkSync(wavPath); } catch {}
    }

    if (!fs.existsSync(oggPath)) {
        throw new TtsError(
            "Falha ao converter o áudio gerado.",
            "Falha ao converter o áudio gerado."
        );
    }

    return oggPath;
}

module.exports = {
    generateSpeech,
    temTtsConfigurado,
    getVozesDisponiveis,
    vozValida,
    // exportados para testes
    limparTexto,
    dividirTexto,
    cortarNaFrase
};
