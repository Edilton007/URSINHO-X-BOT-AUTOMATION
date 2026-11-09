const db = require("../database/database");

function getGroupStats(groupId) {
    if (!groupId) {
        return {
            messages: 0,
            commands: 0
        };
    }

    const group = db.group(groupId);

    if (!group.stats || typeof group.stats !== "object") {
        group.stats = {
            messages: 0,
            commands: 0
        };
    }

    if (typeof group.stats.messages !== "number") {
        group.stats.messages = 0;
    }

    if (typeof group.stats.commands !== "number") {
        group.stats.commands = 0;
    }

    return group.stats;
}

function getStats(groupId) {
    return getGroupStats(groupId);
}

function addMessage(groupId) {
    if (!groupId) {
        return;
    }

    const stats = getGroupStats(groupId);

    stats.messages++;

    db.save();
}

function addCommand(groupId) {
    if (!groupId) {
        return;
    }

    const stats = getGroupStats(groupId);

    stats.commands++;

    db.save();
}

function resetStats(groupId) {
    if (!groupId) {
        return {
            messages: 0,
            commands: 0
        };
    }

    const group = db.group(groupId);

    group.stats = {
        messages: 0,
        commands: 0
    };

    db.save();

    return group.stats;
}

module.exports = {
    getStats,
    addMessage,
    addCommand,
    resetStats
};
