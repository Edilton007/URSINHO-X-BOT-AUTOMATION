const config = require("../config/bot");

/*
============================================================
CACHE DE METADATA DOS GRUPOS
============================================================
*/

const groupMetadataCache = new Map();

const METADATA_CACHE_TIME = 30 * 1000; // 30 segundos

async function getGroupMetadataCached(sock, chat) {
    const now = Date.now();

    const cached = groupMetadataCache.get(chat);

    if (
        cached &&
        cached.metadata &&
        now - cached.timestamp < METADATA_CACHE_TIME
    ) {
        return cached.metadata;
    }

    try {
        const metadata = await sock.groupMetadata(chat);

        groupMetadataCache.set(chat, {
            metadata,
            timestamp: now
        });

        return metadata;

    } catch (error) {

        /*
        ========================================================
        RATE LIMIT
        ========================================================
        */

        if (
            error?.message === "rate-overlimit" ||
            error?.data === 429
        ) {
            console.error(
                "⚠️ WhatsApp aplicou rate-limit ao consultar metadata:",
                chat
            );

            /*
            Se existir metadata antiga no cache,
            usamos ela em vez de fazer outra consulta.
            */
            if (cached?.metadata) {
                return cached.metadata;
            }

            return null;
        }

        console.error(
            "❌ Erro ao obter metadata do grupo:",
            error?.message || error
        );

        /*
        Metadata antiga continua válida como fallback.
        */
        if (cached?.metadata) {
            return cached.metadata;
        }

        return null;
    }
}

/*
============================================================
LIMPAR CACHE DE UM GRUPO
============================================================
*/

function clearGroupMetadataCache(chat) {

    if (!chat) {
        return;
    }

    groupMetadataCache.delete(chat);
}

/*
============================================================
OWNER
============================================================
*/

function normalizarId(id) {
    return String(id || "")
        .split(":")[0]
        .split("@")[0];
}

function isOwner(sender, alt = null) {

    const ownerNumber =
        String(config.OWNER_NUMBER || "");

    const ownerLid =
        "132844076699658@lid";

    // O WhatsApp pode identificar a mesma pessoa por LID ou por
    // número; confere os dois (sender e, se existir, o alternativo).
    return [sender, alt]
        .filter(Boolean)
        .map(item => String(item))
        .some(item =>
            item === ownerLid ||
            (ownerNumber && item.includes(ownerNumber))
        );
}

/*
============================================================
ADMIN
============================================================
*/

async function isAdmin(sock, chat, sender, alt = null) {

    try {

        /*
        ========================================================
        OWNER
        ========================================================
        */

        if (isOwner(sender, alt)) {
            return true;
        }

        /*
        ========================================================
        METADATA COM CACHE
        ========================================================
        */

        const metadata =
            await getGroupMetadataCached(
                sock,
                chat
            );

        if (!metadata) {
            return false;
        }

        /*
        ========================================================
        PROCURAR PARTICIPANTE
        ========================================================
        */

        const idsDoRemetente =
            [sender, alt]
                .filter(Boolean)
                .map(normalizarId);

        const participante =
            metadata.participants.find(
                p =>
                    [p.id, p.lid, p.phoneNumber]
                        .filter(Boolean)
                        .map(normalizarId)
                        .some(id => idsDoRemetente.includes(id))
            );

        if (!participante) {
            return false;
        }

        /*
        ========================================================
        VERIFICAR ADMIN
        ========================================================
        */

        return (
            participante.admin === "admin" ||
            participante.admin === "superadmin"
        );

    } catch (error) {

        console.error(
            "❌ Erro isAdmin:",
            error?.message || error
        );

        return false;
    }
}

/*
============================================================
PERMISSÕES
============================================================
*/

async function hasPermission(
    sock,
    chat,
    sender,
    level = "admin",
    alt = null
) {

    /*
    OWNER
    */

    if (isOwner(sender, alt)) {
        return true;
    }

    /*
    OWNER EXCLUSIVO
    */

    if (level === "owner") {
        return false;
    }

    /*
    ADMIN
    */

    return await isAdmin(
        sock,
        chat,
        sender,
        alt
    );
}

/*
============================================================
EXPORTS
============================================================
*/

module.exports = {

    isOwner,

    isAdmin,

    hasPermission,

    getGroupMetadataCached,

    clearGroupMetadataCache

};
