const axios = require("axios");

const {
    searchImages
} = require("../../services/imageSearchService");

module.exports = {

    name: "imagem",

    aliases: [
        "img",
        "imagens"
    ],

    category: "ia",
    iaGroup: "imagens",

    description: "Pesquisar imagens na internet",

    run: async (sock, m, ctx) => {

        const query =
            ctx.args
                .join(" ")
                .trim();

        if (!query) {
            return ctx.reply(
`🖼️ *PESQUISA DE IMAGENS*

Escreve o que queres pesquisar.

Exemplo:
${ctx.prefix}imagem gato

Outros exemplos:
${ctx.prefix}imagem carros BMW
${ctx.prefix}imagem paisagem de Maputo
${ctx.prefix}imagem wallpaper`
            );
        }

        await ctx.reply(
`🔎 *A pesquisar imagens...*

Pesquisa: ${query}`
        );

        try {

            const images =
                await searchImages(
                    query,
                    5
                );

            if (!images.length) {
                return ctx.reply(
`❌ Não encontrei imagens para:

"${query}"

Tenta fazer uma pesquisa diferente.`
                );
            }

            /*
             * Tentamos as imagens encontradas
             * até conseguirmos baixar uma.
             */
            for (let i = 0; i < images.length; i++) {

                const url = images[i];

                try {

                    const response =
                        await axios.get(
                            url,
                            {
                                responseType:
                                    "arraybuffer",

                                timeout: 15000,

                                maxContentLength:
                                    10 * 1024 * 1024,

                                headers: {
                                    "User-Agent":
                                        "Mozilla/5.0"
                                }
                            }
                        );

                    const contentType =
                        String(
                            response.headers[
                                "content-type"
                            ] || ""
                        ).toLowerCase();

                    if (
                        !contentType.startsWith(
                            "image/"
                        )
                    ) {
                        continue;
                    }

                    const buffer =
                        Buffer.from(
                            response.data
                        );

                    return await sock.sendMessage(
                        ctx.chat,
                        {
                            image: buffer,

                            caption:
`🖼️ *RESULTADO DA PESQUISA*

🔎 ${query}

🐻 URSINHO X BOT V2`
                        },
                        {
                            quoted: m
                        }
                    );

                } catch (error) {

                    console.log(
                        `Imagem ${i + 1} falhou:`,
                        error?.message || error
                    );

                }
            }

            return ctx.reply(
`❌ Encontrei imagens, mas não consegui baixar nenhuma delas.

Tenta pesquisar novamente.`
            );

        } catch (error) {

            console.error(
                "Erro no comando imagem:",
                error?.message || error
            );

            return ctx.reply(
                "❌ Ocorreu um erro ao pesquisar imagens."
            );
        }
    }
};
