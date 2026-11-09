// ============================================================
// RESUMO DE CONVERSA
//
// Antes, quando uma conversa passava de 6 mensagens guardadas
// (3 trocas), as mais antigas eram simplesmente apagadas — o
// bot "esquecia" tudo o que foi dito antes disso, de repente.
//
// Agora, antes de apagar, resume-se o que estava prestes a ser
// perdido (numa frase curta) e guarda-se esse resumo, que vai
// sendo atualizado/condensado à medida que a conversa continua.
// Assim, mesmo em conversas longas, o bot mantém uma noção geral
// do que já foi falado, só perde o detalhe exato das palavras.
//
// Usa o Groq (rápido e barato) para este resumo — é uma tarefa
// simples, não precisa do modelo mais "inteligente".
// ============================================================

const MAX_RESUMO_CARACTERES = 500;

async function resumirTrecho(resumoAnterior, mensagensAntigas) {

    const apiKey = process.env.GROQ_API_KEY;

    // Sem chave disponível, ou nada para resumir: não bloqueia
    // o fluxo normal, só não atualiza o resumo desta vez.
    if (!apiKey || !Array.isArray(mensagensAntigas) || mensagensAntigas.length === 0) {
        return resumoAnterior || null;
    }

    const trechoTexto =
        mensagensAntigas
            .map(m => `${m.role === "user" ? "Pessoa" : "Bot"}: ${m.content}`)
            .join("\n");

    const prompt =
        `Resumo da conversa até agora (pode estar vazio se for o início):\n"${resumoAnterior || "(nenhum ainda)"}"\n\n` +
        `Novo trecho da conversa a incorporar nesse resumo:\n${trechoTexto}\n\n` +
        `Escreve um resumo atualizado, curto (no máximo 3 frases, até ${MAX_RESUMO_CARACTERES} caracteres), em português, juntando o que já se sabia com o que há de novo. ` +
        `Foca-te em factos úteis para continuar a conversa depois (nomes, decisões, pedidos, preferências da pessoa) — não precisas de incluir saudações nem conversa fiada. ` +
        `Responde SOMENTE com o resumo, sem introduções.`;

    try {

        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
                    messages: [
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 300
                })
            }
        );

        if (!response.ok) {
            return resumoAnterior || null;
        }

        const data = await response.json();
        const texto = data?.choices?.[0]?.message?.content?.trim();

        if (!texto) {
            return resumoAnterior || null;
        }

        return texto.slice(0, MAX_RESUMO_CARACTERES);

    } catch (error) {
        console.error("Erro ao resumir conversa:", error?.message || error);
        return resumoAnterior || null;
    }
}

module.exports = {
    resumirTrecho
};
