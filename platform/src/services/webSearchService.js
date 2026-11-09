// ============================================================
// BUSCA NA WEB (Tavily — grátis, sem cartão, 1000/mês)
//
// Cria a chave grátis em https://app.tavily.com (login por
// email ou Google, sem cartão) e coloca no .env:
// TAVILY_API_KEY=tvly-xxxxxxxx
// ============================================================

async function searchWeb(query) {

    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey || !query) {
        return null;
    }

    try {

        const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                api_key: apiKey,
                query,
                search_depth: "basic",
                include_answer: true,
                max_results: 5
            })
        });

        if (!response.ok) {
            console.error(
                "Erro na busca Tavily:",
                `HTTP ${response.status}`
            );
            return null;
        }

        const data = await response.json();

        const partes = [];

        if (data.answer) {
            partes.push(`Resumo: ${data.answer}`);
        }

        if (Array.isArray(data.results)) {
            data.results.slice(0, 5).forEach((r, i) => {
                partes.push(
                    `[${i + 1}] ${r.title}\n${r.content}\nFonte: ${r.url}`
                );
            });
        }

        if (partes.length === 0) {
            return "Nenhum resultado encontrado.";
        }

        return partes.join("\n\n");

    } catch (error) {
        console.error(
            "Erro na busca Tavily:",
            error?.message || error
        );
        return null;
    }
}

module.exports = {
    searchWeb
};
