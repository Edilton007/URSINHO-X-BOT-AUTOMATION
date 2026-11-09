const axios = require("axios");

const UA =
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124 Mobile Safari/537.36";

async function searchGoogleImages(query, limit = 5) {
    try {
        const { data } = await axios.get(
            "https://www.google.com/search",
            {
                params: {
                    q: query,
                    tbm: "isch",
                    hl: "pt"
                },
                headers: {
                    "User-Agent": UA,
                    "Accept-Language": "pt-PT,pt;q=0.9"
                },
                timeout: 15000
            }
        );

        const images = [];
        const seen = new Set();

        const regex =
            /\["(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"/gi;

        let match;

        while (
            (match = regex.exec(data)) &&
            images.length < limit
        ) {
            const url = match[1]
                .replace(/\\u003d/g, "=")
                .replace(/\\u0026/g, "&")
                .replace(/\\\//g, "/");

            if (
                !url.startsWith("http") ||
                url.includes("gstatic.com") ||
                url.includes("google.com/logos") ||
                seen.has(url)
            ) {
                continue;
            }

            seen.add(url);
            images.push(url);
        }

        return images;

    } catch (error) {
        console.error(
            "Erro Google Images:",
            error?.message || error
        );

        return [];
    }
}

async function searchBingImages(query, limit = 5) {
    try {
        const { data } = await axios.get(
            "https://www.bing.com/images/search",
            {
                params: {
                    q: query,
                    form: "HDRSC2"
                },
                headers: {
                    "User-Agent": UA
                },
                timeout: 15000
            }
        );

        const images = [];
        const seen = new Set();

        const regex =
            /murl&quot;:&quot;(https?:\/\/[^&"]+)/gi;

        let match;

        while (
            (match = regex.exec(data)) &&
            images.length < limit
        ) {
            const url = match[1]
                .replace(/&quot;.*$/, "")
                .replace(/\\u0026/g, "&")
                .replace(/\\\//g, "/");

            if (
                !url.startsWith("http") ||
                seen.has(url)
            ) {
                continue;
            }

            seen.add(url);
            images.push(url);
        }

        return images;

    } catch (error) {
        console.error(
            "Erro Bing Images:",
            error?.message || error
        );

        return [];
    }
}

async function searchImages(query, limit = 5) {
    if (!query || !query.trim()) {
        return [];
    }

    const pesquisa = query.trim();

    let images =
        await searchGoogleImages(
            pesquisa,
            limit
        );

    if (!images.length) {
        images =
            await searchBingImages(
                pesquisa,
                limit
            );
    }

    return images;
}

module.exports = {
    searchImages,
    searchGoogleImages,
    searchBingImages
};
