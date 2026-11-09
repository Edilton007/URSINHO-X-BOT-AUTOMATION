const db = require("../database/database");

function genId(len = 10) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";

    for (let i = 0; i < len; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }

    return "UX-" + code;
}

function parseDuration(time) {
    const match = String(time).trim().match(/^(\d+)([dhm])$/i);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    if (!Number.isSafeInteger(value) || value <= 0) return null;

    const unit = match[2].toLowerCase();

    if (unit === "d") return value * 86400000;
    if (unit === "h") return value * 3600000;
    if (unit === "m") return value * 60000;

    return null;
}

function generateCode(duration, uses = 1) {
    const ms = parseDuration(duration);

    if (!ms) {
        return {
            error: "Duração inválida. Use formatos como 30d, 12h, 60m ou 365d."
        };
    }

    const parsedUses = Number(uses);
    const maxUses =
        Number.isSafeInteger(parsedUses) && parsedUses > 0
            ? parsedUses
            : 1;

    const code = genId();
    const now = Date.now();

    db.rental.codes[code] = {
        code,
        duration,
        durationMs: ms,
        createdAt: now,
        activatedAt: null,
        expiresAt: null,
        maxUses,
        usedBy: []
    };

    db.save();

    return { code };
}

function activate(code, groupJid) {

    console.log("===== RENTAL ACTIVATE DEBUG =====");
    console.log("1. code recebido:", code);
    console.log("2. groupJid recebido:", groupJid);

    const normalizedCode =
        String(code || "").trim().toUpperCase();

    console.log("3. código normalizado:", normalizedCode);

    const item =
        db.rental.codes[normalizedCode];

    console.log("4. código encontrado:", !!item);

    if (!item) {
        console.log("5. ERRO: código não encontrado");
        return {
            error: "Código não encontrado."
        };
    }

    console.log("6. item:", {
        duration: item.duration,
        durationMs: item.durationMs,
        maxUses: item.maxUses,
        usedBy: item.usedBy
    });

    if (!Array.isArray(item.usedBy)) {
        console.log("7. usedBy não era array. Corrigindo...");
        item.usedBy = [];
    }

    console.log("8. usedBy atual:", item.usedBy);

    if (item.usedBy.includes(groupJid)) {
        console.log("9. ERRO: grupo já utilizou o código");
        return {
            error: "Este grupo já usou este código."
        };
    }

    const maxUses =
        Number(item.maxUses) || 1;

    console.log("10. maxUses:", maxUses);
    console.log("11. usos atuais:", item.usedBy.length);

    if (item.usedBy.length >= maxUses) {
        console.log("12. ERRO: limite de uso atingido");
        return {
            error: "Código atingiu o limite de uso."
        };
    }

    const durationMs =
        Number(item.durationMs) ||
        parseDuration(item.duration);

    console.log("13. durationMs:", durationMs);

    if (!durationMs) {
        console.log("14. ERRO: duração inválida");
        return {
            error: "Duração da licença inválida."
        };
    }

    const now = Date.now();

    console.log("15. agora:", now);

    console.log("16. chamando db.group()...");

    const group =
        db.group(groupJid);

    console.log("17. db.group() OK");

    console.log("18. grupo antes:", {
        rentalActive: group.rentalActive,
        rentalExpiresAt: group.rentalExpiresAt
    });

    const currentExpiresAt =
        Number(group.rentalExpiresAt) || 0;

    const currentActive =
        group.rentalActive === true &&
        currentExpiresAt > now;

    console.log("19. licença atual ativa:", currentActive);
    console.log("20. currentExpiresAt:", currentExpiresAt);

    const baseTime =
        currentActive
            ? currentExpiresAt
            : now;

    const newExpiresAt =
        baseTime + durationMs;

    console.log("21. nova expiração:", newExpiresAt);

    item.usedBy.push(groupJid);

    console.log("22. grupo adicionado ao usedBy");

    if (!item.activatedAt) {
        item.activatedAt = now;
    }

    item.durationMs = durationMs;
    item.expiresAt = newExpiresAt;

    console.log("23. atualizando grupo...");

    group.rentalActive = true;
    group.rentalExpiresAt = newExpiresAt;

    console.log("24. grupo atualizado:", {
        rentalActive: group.rentalActive,
        rentalExpiresAt: group.rentalExpiresAt
    });

    console.log("25. chamando db.save()...");

    db.save();

    console.log("26. db.save() OK");

    console.log("===== RENTAL ACTIVATE DEBUG FIM =====");

    return {
        ok: true,
        expiresAt: newExpiresAt,
        renewed: currentActive,
        duration: item.duration,
        code: normalizedCode
    };
}

function status(groupJid) {
    const group = db.group(groupJid);
    const now = Date.now();
    const expiresAt =
        Number(group.rentalExpiresAt) || null;

    if (
        group.rentalActive === true &&
        expiresAt &&
        expiresAt > now
    ) {
        return {
            active: true,
            blocked: isBlocked(groupJid),
            expiresAt,
            remainingMs: expiresAt - now
        };
    }

    // Normaliza automaticamente uma licença expirada.
    if (
        group.rentalActive === true &&
        expiresAt &&
        expiresAt <= now
    ) {
        group.rentalActive = false;
        db.save();
    }

    return {
        active: false,
        blocked: isBlocked(groupJid),
        expiresAt,
        remainingMs: 0
    };
}

function listCodes() {
    return Object.values(db.rental.codes);
}

function block(groupJid) {
    db.rental.blockedGroups[groupJid] = Date.now();
    db.save();
    return true;
}

function unblock(groupJid) {
    delete db.rental.blockedGroups[groupJid];
    db.save();
    return true;
}

function isBlocked(groupJid) {
    return !!db.rental.blockedGroups[groupJid];
}

function generateUnlock(groupJid) {
    const code = "UNL-" + genId(8);

    db.rental.unlock[code] = {
        groupJid,
        createdAt: Date.now()
    };

    db.save();

    return code;
}

function useUnlock(code, groupJid) {
    const normalizedCode = String(code || "").trim().toUpperCase();
    const unlock = db.rental.unlock[normalizedCode];

    if (!unlock) {
        return { error: "Código inválido." };
    }

    if (unlock.groupJid !== groupJid) {
        return {
            error: "Código não pertence a este grupo."
        };
    }

    unblock(groupJid);

    delete db.rental.unlock[normalizedCode];
    db.save();

    return { ok: true };
}

module.exports = {
    generateCode,
    activate,
    status,
    listCodes,
    block,
    unblock,
    isBlocked,
    generateUnlock,
    useUnlock,
    parseDuration
};
