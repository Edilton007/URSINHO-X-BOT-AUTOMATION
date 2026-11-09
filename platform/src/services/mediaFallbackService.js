// Plano B para imagem e áudio quando o Gemini falha (cota, erro, etc.):
//  - Áudio  -> transcrição com Groq Whisper, depois responde como texto
//  - Imagem -> Claude (se houver chave) ou Groq Vision

const GROQ_AUDIO_URL =
    "https://api.groq.com/openai/v1/audio/transcriptions";

const GROQ_CHAT_URL =
    "https://api.groq.com/openai/v1/chat/completions";

const ANTHROPIC_URL =
    "https://api.anthropic.com/v1/messages";

function extensaoDoAudio(mimetype) {
    const m = String(mimetype || "").toLowerCase();
    if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
    if (m.includes("mp4") || m.includes("m4a")) return "m4a";
    if (m.includes("wav")) return "wav";
    if (m.includes("webm")) return "webm";
    return "ogg";
}

async function transcribeAudio(media) {

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey || !media?.base64) {
        return null;
    }

    try {

        const buffer = Buffer.from(media.base64, "base64");

        const form = new FormData();

        form.append(
            "file",
            new Blob([buffer], { type: media.mimetype || "audio/ogg" }),
            `audio.${extensaoDoAudio(media.mimetype)}`
        );

        form.append(
            "model",
            process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo"
        );

        form.append("language", "pt");
        form.append("response_format", "json");

        const response = await fetch(GROQ_AUDIO_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form,
            signal: AbortSignal.timeout(60000)
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            console.error(
                "❌ Groq Whisper:",
                data?.error?.message || `HTTP ${response.status}`
            );
            return null;
        }

        const texto = String(data?.text || "").trim();

        return texto || null;

    } catch (error) {
        console.error("❌ Erro na transcrição:", error?.message || error);
        return null;
    }
}

async function imagemComClaude(media, pergunta, system) {

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) return null;

    const tipo = String(media.mimetype || "image/jpeg");

    if (!/^image\/(jpeg|png|gif|webp)$/.test(tipo)) return null;

    try {

        const response = await fetch(ANTHROPIC_URL, {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            },
            signal: AbortSignal.timeout(60000),
            body: JSON.stringify({
                model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
                max_tokens: 1500,
                system,
                messages: [{
                    role: "user",
                    content: [
                        {
                            type: "image",
                            source: {
                                type: "base64",
                                media_type: tipo,
                                data: media.base64
                            }
                        },
                        { type: "text", text: pergunta }
                    ]
                }]
            })
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            console.error(
                "❌ Claude visão:",
                data?.error?.message || `HTTP ${response.status}`
            );
            return null;
        }

        const texto = (data?.content || [])
            .filter(b => b?.type === "text")
            .map(b => b.text)
            .join("\n")
            .trim();

        return texto || null;

    } catch (error) {
        console.error("❌ Erro Claude visão:", error?.message || error);
        return null;
    }
}

async function imagemComGroq(media, pergunta, system) {

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) return null;

    try {

        const response = await fetch(GROQ_CHAT_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            signal: AbortSignal.timeout(60000),
            body: JSON.stringify({
                model:
                    process.env.GROQ_VISION_MODEL ||
                    "meta-llama/llama-4-scout-17b-16e-instruct",
                temperature: 0.5,
                max_tokens: 1500,
                messages: [
                    { role: "system", content: system },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: pergunta },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${media.mimetype || "image/jpeg"};base64,${media.base64}`
                                }
                            }
                        ]
                    }
                ]
            })
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            console.error(
                "❌ Groq visão:",
                data?.error?.message || `HTTP ${response.status}`
            );
            return null;
        }

        return String(data?.choices?.[0]?.message?.content || "").trim() || null;

    } catch (error) {
        console.error("❌ Erro Groq visão:", error?.message || error);
        return null;
    }
}

async function describeImage(media, pergunta, system) {

    const texto =
        pergunta && pergunta.trim()
            ? pergunta.trim()
            : "Explica de forma útil o que aparece nesta imagem e lê qualquer texto visível.";

    return (
        (await imagemComClaude(media, texto, system)) ||
        (await imagemComGroq(media, texto, system))
    );
}

module.exports = {
    transcribeAudio,
    describeImage
};
