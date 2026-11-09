/* ============================================================
   ANTI-PALAVRÃO

   Lista padrão moderada de palavrões comuns em português.
   Cada grupo pode adicionar as suas próprias palavras/gírias
   locais através de .addpalavrao, sem precisar mexer no código.
============================================================ */

const DEFAULT_WORDS = [
    "porra",
    "caralho",
    "merda",
    "puta",
    "foda-se",
    "fodase",
    "cabrão",
    "cabrao",
    "arrombado",
    "filho da puta",
    "desgraçado",
    "desgracado",
    "cu",
    "corno"
];


function normalize(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}


function containsProfanity(text, customWords = []) {

    if (!text || !text.trim()) {
        return null;
    }

    const normalizedText =
        ` ${normalize(text)} `;

    const words =
        [
            ...DEFAULT_WORDS,
            ...customWords
        ];

    for (const word of words) {

        const normalizedWord =
            normalize(word);

        if (!normalizedWord) {
            continue;
        }

        /* limite de palavra simples, funciona bem para
           expressões com espaço também (ex: "filho da puta") */

        if (normalizedText.includes(` ${normalizedWord} `) ||
            normalizedText.includes(`${normalizedWord} `) ||
            normalizedText.includes(` ${normalizedWord}`)) {

            return normalizedWord;
        }
    }

    return null;
}


module.exports = {
    containsProfanity,
    DEFAULT_WORDS
};
