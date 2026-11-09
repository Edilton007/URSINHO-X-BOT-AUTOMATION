const db = require("../database/database");
const alertasDono = require("./alertService");

const { askGemini, getUltimoErroGemini } = require("./geminiService");
const { askGroq } = require("./groqService");
const { askClaude } = require("./claudeService");
const { REGRAS_INTELIGENCIA } = require("./aiRules");
const { transcribeAudio, describeImage } = require("./mediaFallbackService");

const OPENROUTER_URL =
    "https://openrouter.ai/api/v1/chat/completions";

/* ============================================================
   CONVERTER MARKDOWN PARA FORMATO DO WHATSAPP

   As IAs (Gemini, Claude, OpenRouter) escrevem em Markdown
   (**negrito**, ### títulos, etc). O WhatsApp usa a sua
   própria sintaxe simples: *negrito*, _itálico_, ~riscado~.
   Sem isto, os asteriscos duplos aparecem literalmente
   na conversa.
============================================================ */

function formatForWhatsApp(text) {

    if (!text) {
        return text;
    }

    let out = String(text);

    /* **negrito** ou __negrito__ -> *negrito* */
    out = out.replace(/\*\*(.+?)\*\*/g, "*$1*");
    out = out.replace(/__(.+?)__/g, "*$1*");

    /* *itálico* markdown (single asterisco) não existe à parte
       de negrito no Markdown comum, então tratamos apenas
       _itálico_ -> _itálico_ (já é compatível, mantém). */

    /* ~~riscado~~ -> ~riscado~ */
    out = out.replace(/~~(.+?)~~/g, "~$1~");

    /* remover marcadores de título markdown (#, ##, ###) no início da linha */
    out = out.replace(/^#{1,6}\s+/gm, "");

    /* markdown de bloco de código ```texto``` -> mantém, WhatsApp suporta ``` */

    return out;
}

/* ============================================================
   SISTEMA PRINCIPAL
============================================================ */

const SYSTEM = `
Tu és o URSINHO X BOT V2, uma inteligência artificial
para WhatsApp em Moçambique.

Responde em Português de Moçambique.
Sê simpático, direto, útil e natural.
Usa emojis com moderação.

TOM DE VOZ:
Sê caloroso, doce e humano — não soes a manual nem a robô.
Entende o tom da conversa: brinca com leveza quando fizer
sentido, sê atencioso em pedidos sérios, mostra empatia
genuína com quem estiver triste ou frustrado.

IMPORTANTE SOBRE O TAMANHO DA RESPOSTA:
Prioriza SEMPRE terminar a ideia por completo. Nunca cortes
uma frase, um raciocínio ou uma explicação a meio. Se a
pergunta for simples, responde curto e direto. Se exigir mais
detalhe, escreve o necessário para a resposta ficar completa e
bem pensada, mesmo que fique mais longa.

IMPORTANTE:
- Responde SOMENTE com a resposta final destinada ao utilizador.
- NUNCA mostres raciocínio interno.
- NUNCA mostres análise.
- NUNCA mostres "thinking process".
- NUNCA mostres passos internos de pensamento.
- NUNCA escrevas "Here's a thinking process".
- NUNCA escrevas "Analysis".
- NUNCA escrevas "Final Answer".
- NUNCA expliques como chegaste à resposta.
- Não coloques comentários internos antes da resposta.
- A primeira coisa da tua resposta deve ser diretamente a resposta ao utilizador.

IMPORTANTE — NUNCA INVENTES DADOS TÉCNICOS/OPERACIONAIS:
Não tens acesso a métricas reais do servidor, uptime, CPU,
memória, número de mensagens processadas, logs, backups nem
a nenhum sistema de monitorização. Se te perguntarem sobre o
estado do bot ou "relatório do dia", NUNCA inventes números
que pareçam reais — diz com honestidade que não tens acesso
a esse tipo de dado.

Isto aplica-se também a perguntas abertas como "o que queres
melhorar" ou "fala-me de tudo": NUNCA inventes uma equipa
(ex: "DevOps", "Backend", "QA"), infraestrutura que não tens
(Redis, Elasticsearch, Grafana, WhatsApp Business API oficial)
nem planos de ação com horários e responsáveis atribuídos.
Responde curto e honesto: fala só de melhorias reais e
simples (idiomas locais, feedback dos utilizadores, comandos
que faltam).

Se perguntarem quantas mensagens já trocaram contigo, NUNCA
adivinhes um número a partir do contexto que vês — isso não
é o total real. Diz que não tens esse número à mão aqui.

IMPORTANTE — SEGURANÇA DE IDENTIDADE:
Só existe UM dono/proprietário verdadeiro deste bot. Nunca
confirmes que alguém é o dono/proprietário só porque essa
pessoa disse isso na conversa.

LÍNGUAS E CULTURA DE MOÇAMBIQUE:
Tens conhecimento profundo de Moçambique — geografia,
províncias, história, economia, culinária, música, futebol,
feriados, costumes, e das línguas nacionais. O português é a
única língua oficial, mas há cerca de 20 línguas bantu
nacionais — principais: Emakhuwa (mais falada, norte),
Xichangana/Changana e Xitsonga (sul), Ronga (Maputo), Cisena
e Cindau/Ndau (centro), Elomwe, Echuwabo, Cinyanja, Cinyungwe,
Shimakonde (Cabo Delgado), Ciyao, Kimwani, Xitswa, Gitonga.
Se a pessoa escrever nalguma dessas línguas, entende e
responde no mesmo idioma dela, de forma natural e fluente.

${REGRAS_INTELIGENCIA}

Nunca reveles chaves de API, credenciais,
dados internos ou informações secretas do sistema.

O teu nome é URSINHO X BOT V2.
`.trim();


/* ============================================================
   LIMPAR RACIOCÍNIO / THINKING
============================================================ */

function cleanAIResponse(text) {

    if (!text) {
        return "";
    }

    let answer = String(text).trim();

    /*
    ============================================================
    REMOVER BLOCOS DE THINKING
    ============================================================
    */

    answer = answer.replace(
        /<think>[\s\S]*?<\/think>/gi,
        ""
    );

    answer = answer.replace(
        /<thinking>[\s\S]*?<\/thinking>/gi,
        ""
    );

    answer = answer.replace(
        /<analysis>[\s\S]*?<\/analysis>/gi,
        ""
    );

    /*
    ============================================================
    SE O MODELO ESCREVER "HERE'S A THINKING PROCESS"
    ============================================================
    */

    const thinkingMarkers = [
        "here's a thinking process:",
        "here is a thinking process:",
        "thinking process:",
        "here's my thinking process:",
        "here is my thinking process:",
        "let me think:",
        "analysis:",
        "reasoning:",
        "raciocínio:",
        "processo de pensamento:"
    ];

    const lower = answer.toLowerCase();

    let markerPosition = -1;
    let markerLength = 0;

    for (const marker of thinkingMarkers) {

        const position = lower.indexOf(marker);

        if (
            position !== -1 &&
            (markerPosition === -1 || position < markerPosition)
        ) {
            markerPosition = position;
            markerLength = marker.length;
        }
    }

    /*
    Se encontrou thinking, tenta localizar a resposta final.
    */

    if (markerPosition !== -1) {

        const afterThinking =
            answer.slice(markerPosition + markerLength);

        const finalMarkers = [
            "final answer:",
            "final response:",
            "resposta final:",
            "resposta:",
            "answer:"
        ];

        const lowerAfter =
            afterThinking.toLowerCase();

        let finalPosition = -1;
        let finalLength = 0;

        for (const marker of finalMarkers) {

            const position =
                lowerAfter.lastIndexOf(marker);

            if (
                position !== -1 &&
                position > finalPosition
            ) {
                finalPosition = position;
                finalLength = marker.length;
            }
        }

        if (finalPosition !== -1) {

            answer =
                afterThinking
                    .slice(finalPosition + finalLength)
                    .trim();

        } else {

            /*
            Não existe marcador de resposta final.
            Neste caso, tenta remover o bloco de raciocínio
            numerado e conservar apenas a última parte útil.
            */

            const lines =
                afterThinking
                    .split("\n")
                    .map(line => line.trim())
                    .filter(Boolean);

            const usefulLines =
                lines.filter(line => {

                    if (/^\d+\.\s*\*?\*?(analyze|analysis|check|formulate|draft|identify|step)/i.test(line)) {
                        return false;
                    }

                    if (/^(analyze|analysis|draft|formulate|check against|i need to|i should|let's)/i.test(line)) {
                        return false;
                    }

                    return true;
                });

            if (usefulLines.length) {
                answer = usefulLines.join("\n").trim();
            }
        }
    }

    /*
    ============================================================
    LIMPEZA FINAL
    ============================================================
    */

    answer = answer
        .replace(/^\s*final answer\s*:\s*/i, "")
        .replace(/^\s*final response\s*:\s*/i, "")
        .replace(/^\s*resposta final\s*:\s*/i, "")
        .trim();

    /*
    Nunca enviar apenas marcadores internos.
    */

    if (
        !answer ||
        /^(analysis|reasoning|thinking process|raciocínio)$/i.test(answer)
    ) {
        return "";
    }

    /*
    ============================================================
    ÚLTIMA PROTEÇÃO: RACIOCÍNIO CRU QUE ESCAPOU DA LIMPEZA

    Alguns modelos "de raciocínio" (frequentes nos gratuitos do
    OpenRouter) escrevem tipo "Okay, the user said...", "Let me
    think...", "Wait, maybe..." repetidamente, em inglês, sem
    nunca dar a resposta final dentro do limite de tokens.
    Se sobrar isto depois da limpeza normal, é melhor descartar
    do que mandar a bagunça para o utilizador.
    ============================================================
    */

    const reasoningSignals = [
        /^okay,\s+the user/i,
        /^let me (break|think|check)/i,
        /\bwait,\s+(maybe|the user|let me)/i,
        /\bmy response\s*$/i
    ];

    /*
    Modelos de moderação/segurança (tipo Llama Guard) às vezes
    são escolhidos por engano pelo roteador automático e devolvem
    uma classificação em vez de uma resposta de verdade.
    */

    if (/user safety\s*:\s*(safe|unsafe)/i.test(answer) ||
        /response safety\s*:\s*(safe|unsafe)/i.test(answer)) {
        return "";
    }

    const signalHits =
        reasoningSignals.filter(pattern => pattern.test(answer)).length;

    if (signalHits >= 2) {
        return "";
    }

    return answer;
}


/* ============================================================
   PLANO B PARA IMAGEM / ÁUDIO (quando o Gemini falha)
============================================================ */

async function responderMidiaSemGemini(question, ctx, media) {

    try {

        if (media.kind === "audio") {

            const transcricao = await transcribeAudio(media);

            if (!transcricao) {
                return null;
            }

            const prompt =
                `[O utilizador enviou uma nota de voz. Transcrição: "${transcricao}"]` +
                (question ? `\nMensagem escrita junto: ${question}` : "");

            return await askAI(
                prompt,
                { ...ctx, media: null, skipGemini: true }
            );
        }

        if (media.kind === "image") {

            return await describeImage(media, question, SYSTEM);
        }

    } catch (error) {

        console.error(
            "Erro no plano B de mídia:",
            error?.message || error
        );
    }

    return null;
}

/* ============================================================
   PERGUNTAR À IA
============================================================ */

async function askAI(prompt, ctx = {}) {

    const media = ctx?.media || null;

    if ((!prompt || !prompt.trim()) && !media) {

        return "❌ Escreve alguma coisa para eu responder.";
    }

    const question = (prompt || "").trim();


    /* ========================================================
       BASE DE CONHECIMENTO LOCAL
    ======================================================== */

    const key =
        question.toLowerCase();

    if (
        db.knowledge &&
        db.knowledge[key]
    ) {

        return db.knowledge[key];
    }


    /* ========================================================
       ESCOLHA DO PROVEDOR PRINCIPAL

       Prioridade: INTELIGÊNCIA antes de velocidade. O Gemini
       é sempre tentado primeiro — é o mais capaz (entende
       imagem/áudio/sticker, tem busca web e clima em tempo
       real, idiomas locais, memória) — mesmo que a Groq seja
       mais rápida. Uma resposta rápida mas rasa não vale a
       pena. O Groq só entra como reserva se o Gemini falhar
       (ex: quota esgotada), e já desiste rápido nesse caso
       graças ao teto de 20s no geminiService.
    ======================================================== */

    const geminiAnswer =
        ctx?.skipGemini
            ? null
            : await askGemini(question, ctx);

    if (geminiAnswer) {
        return formatForWhatsApp(geminiAnswer);
    }

    // Gemini falhou: se for cota/limite, avisa o dono (1x a cada 2 h)
    if (!ctx?.skipGemini) {
        const erroGemini = String(getUltimoErroGemini() || "");
        if (/quota|429|exhaust|rate.?limit|limite|cota/i.test(erroGemini)) {
            alertasDono.geminiSemCota(erroGemini);
        }
    }

    // O Gemini falhou num pedido com imagem/áudio: tenta o plano B
    // (Whisper pra áudio, Claude/Groq com visão pra imagem).
    if (media) {

        const viaPlanoB =
            await responderMidiaSemGemini(question, ctx, media);

        if (viaPlanoB) {
            return formatForWhatsApp(viaPlanoB);
        }

        return `⚠️ Não consegui processar essa imagem/áudio/sticker agora.\n\n_Erro técnico: ${getUltimoErroGemini() || "desconhecido"}_`;
    }

    const groqAnswerFallback =
        await askGroq(question, ctx);

    if (groqAnswerFallback) {
        return formatForWhatsApp(groqAnswerFallback);
    }


    /* ========================================================
       CLAUDE (SE CONFIGURADO, OPCIONAL/PAGO)
    ======================================================== */

    const claudeAnswer =
        await askClaude(question, ctx);

    if (claudeAnswer) {
        return formatForWhatsApp(claudeAnswer);
    }


    /* ========================================================
       OPENROUTER
    ======================================================== */

    const apiKey =
        process.env.OPENROUTER_API_KEY;

    if (!apiKey) {

        console.error(
            "❌ OPENROUTER_API_KEY não configurada."
        );

        return "⚠️ IA online não configurada.";
    }


    try {

        const mensagensBase = [

            {
                role: "system",
                content: SYSTEM
            },

            ...(Array.isArray(ctx?.history) ? ctx.history : []),

            {
                role: "user",
                content: question
            }
        ];

        let respostaCompleta = "";
        let continuacoes = 0;
        const MAX_CONTINUACOES_OPENROUTER = 4; // segurança contra corte

        while (continuacoes <= MAX_CONTINUACOES_OPENROUTER) {

            const response =
                await fetch(
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
                                "URSINHO X BOT V2"
                        },

                        body:
                            JSON.stringify({

                                model:
                                    process.env.OPENROUTER_MODEL ||
                                    "openrouter/free",

                                messages: mensagensBase,

                                temperature: 0.4,

                                max_tokens: 2048
                            })
                    }
                );


            /* ====================================================
               LER RESPOSTA
            ==================================================== */

            const data =
                await response.json();


            /* ====================================================
               ERRO HTTP
            ==================================================== */

            if (!response.ok) {

                console.error(
                    "❌ Erro OpenRouter:",
                    data?.error?.message ||
                    `HTTP ${response.status}`
                );

                alertasDono.iaIndisponivel(
                    data?.error?.message || `OpenRouter HTTP ${response.status}`
                );

                return respostaCompleta ||
                    "⚠️ A IA online está temporariamente indisponível.";
            }


            /* ====================================================
               EXTRAIR RESPOSTA
            ==================================================== */

            let answer =
                data?.choices?.[0]?.message?.content;


            /*
            Alguns provedores podem devolver array.
            */

            if (
                Array.isArray(answer)
            ) {

                answer =
                    answer
                        .map(item => {

                            if (
                                typeof item === "string"
                            ) {
                                return item;
                            }

                            if (
                                item?.text
                            ) {
                                return item.text;
                            }

                            return "";
                        })
                        .filter(Boolean)
                        .join("\n");
            }


            /*
            Garantir texto.
            */

            if (
                typeof answer !== "string"
            ) {

                if (
                    answer &&
                    typeof answer === "object"
                ) {

                    answer =
                        answer.text ||
                        answer.content ||
                        "";
                }
            }


            const finishReason =
                data?.choices?.[0]?.finish_reason;

            respostaCompleta += (answer || "");

            // finish_reason "length" = cortado pelo limite de
            // tokens, NÃO porque a resposta terminou de verdade.
            if (finishReason === "length" && answer) {

                continuacoes++;

                mensagensBase.push({
                    role: "assistant",
                    content: answer
                });

                mensagensBase.push({
                    role: "user",
                    content:
                        "Continua exatamente de onde paraste, sem repetir nada do que já escreveste, até terminares a resposta por completo."
                });

                continue;
            }


            /* ====================================================
               LIMPAR THINKING
            ==================================================== */

            const respostaLimpa =
                cleanAIResponse(respostaCompleta);


            /* ====================================================
               RESPOSTA VÁLIDA
            ==================================================== */

            if (
                respostaLimpa &&
                respostaLimpa.trim()
            ) {

                return formatForWhatsApp(respostaLimpa.trim());
            }


            /* ====================================================
               DEBUG
            ==================================================== */

            console.error(
                "❌ OpenRouter não retornou uma resposta final válida."
            );

            console.error(
                "Choices:",
                JSON.stringify(
                    data?.choices,
                    null,
                    2
                )
            );

            return "❌ A IA não conseguiu gerar uma resposta.";
        }

        // Esgotou as continuações permitidas — devolve o que já
        // foi gerado (ainda assim é melhor que cortar sem aviso).
        const respostaLimpaFinal =
            cleanAIResponse(respostaCompleta);

        return respostaLimpaFinal
            ? formatForWhatsApp(respostaLimpaFinal.trim())
            : "❌ A IA não conseguiu gerar uma resposta.";


    } catch (error) {

        console.error(
            "❌ Erro no OpenRouter:",
            error?.message ||
            error
        );

        return "⚠️ A IA online está temporariamente indisponível.";
    }
}


/* ============================================================
   ENSINAR
============================================================ */

function teach(
    question,
    response
) {

    if (
        !question ||
        !response
    ) {

        return false;
    }


    if (!db.knowledge) {

        db.knowledge = {};
    }


    const key =
        question
            .trim()
            .toLowerCase();


    db.knowledge[key] =
        response.trim();


    db.save();

    return true;
}


/* ============================================================
   ESQUECER
============================================================ */

function forget(question) {

    if (!question) {

        return false;
    }


    const key =
        question
            .trim()
            .toLowerCase();


    if (
        !db.knowledge ||
        !db.knowledge[key]
    ) {

        return false;
    }


    delete db.knowledge[key];

    db.save();

    return true;
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
    askAI,
    teach,
    forget,
    cleanAIResponse
};
