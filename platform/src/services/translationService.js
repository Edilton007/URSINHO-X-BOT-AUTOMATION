const OPENROUTER_URL =
    "https://openrouter.ai/api/v1/chat/completions";

const LANGUAGES = {
    pt: "Português",
    en: "Inglês",
    es: "Espanhol",
    fr: "Francês",
    de: "Alemão",
    it: "Italiano",
    nl: "Holandês",
    ru: "Russo",
    uk: "Ucraniano",
    pl: "Polaco",
    tr: "Turco",
    ar: "Árabe",
    hi: "Hindi",
    zh: "Chinês",
    ja: "Japonês",
    ko: "Coreano",
    id: "Indonésio",
    vi: "Vietnamita",
    th: "Tailandês",
    sw: "Suaíli"
};

const ALIASES = {
    portugues: "pt",
    português: "pt",
    portugal: "pt",

    ingles: "en",
    inglês: "en",
    english: "en",

    espanhol: "es",
    espanhol: "es",

    frances: "fr",
    francês: "fr",

    alemao: "de",
    alemão: "de",

    italiano: "it",

    holandes: "nl",
    holandês: "nl",

    russo: "ru",
    ucraniano: "uk",
    polaco: "pl",
    polonês: "pl",
    turco: "tr",
    arabe: "ar",
    árabe: "ar",
    hindi: "hi",
    chines: "zh",
    chinês: "zh",
    japones: "ja",
    japonês: "ja",
    coreano: "ko",
    indonesio: "id",
    indonésio: "id",
    vietnamita: "vi",
    tailandes: "th",
    tailandês: "th",
    suaíli: "sw",
    suaili: "sw"
};

function normalizeLanguage(value) {
    if (!value) return null;

    const key = String(value)
        .trim()
        .toLowerCase();

    if (LANGUAGES[key]) {
        return key;
    }

    return ALIASES[key] || null;
}

function getLanguages() {
    return LANGUAGES;
}

async function translateText(text, targetLanguage) {
    if (!text || !text.trim()) {
        return {
            ok: false,
            error: "Texto vazio."
        };
    }

    const code = normalizeLanguage(targetLanguage);

    if (!code) {
        return {
            ok: false,
            error: "Idioma não suportado."
        };
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        return {
            ok: false,
            error: "IA online não configurada."
        };
    }

    const languageName = LANGUAGES[code];

    const systemPrompt = `
Tu és um tradutor profissional.

Traduz o texto do utilizador para ${languageName}.

Regras obrigatórias:
- Detecta automaticamente o idioma original.
- Traduz apenas o conteúdo recebido.
- Mantém o significado original.
- Mantém o tom e a intenção do texto.
- Não expliques a tradução.
- Não acrescentes comentários.
- Não respondas à mensagem.
- Não inventes informação.
- Mantém nomes próprios, números, links e identificadores quando apropriado.
- Responde somente com a tradução final.
`;

    try {
        const response = await fetch(
            OPENROUTER_URL,
            {
                method: "POST",

                headers: {
                    "Authorization":
                        `Bearer ${apiKey}`,

                    "Content-Type":
                        "application/json",

                    "HTTP-Referer":
                        "https://github.com/ursinho-x-bot-v2",

                    "X-Title":
                        "URSINHO X BOT V2 - Tradutor"
                },

                body: JSON.stringify({
                    model:
                        process.env.OPENROUTER_MODEL ||
                        "openrouter/free",

                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        {
                            role: "user",
                            content: text.trim()
                        }
                    ],

                    temperature: 0.2,

                    max_tokens: 1200
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(
                "Erro OpenRouter Tradução:",
                data?.error?.message ||
                `HTTP ${response.status}`
            );

            return {
                ok: false,
                error:
                    "A tradução está temporariamente indisponível."
            };
        }

        const translation =
            data?.choices?.[0]?.message?.content;

        if (!translation) {
            return {
                ok: false,
                error:
                    "A IA não conseguiu gerar a tradução."
            };
        }

        return {
            ok: true,
            text: translation.trim(),
            language: code,
            languageName
        };

    } catch (error) {

        console.error(
            "Erro no serviço de tradução:",
            error?.message || error
        );

        return {
            ok: false,
            error:
                "O serviço de tradução está temporariamente indisponível."
        };
    }
}

module.exports = {
    translateText,
    normalizeLanguage,
    getLanguages
};
