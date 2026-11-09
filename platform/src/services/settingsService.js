const db = require("../database/database");

const DEFAULT_SETTINGS = {
    prefix: ".",
    interactAI: false,
    welcomeEnabled: false,
    font: "serif"
};

function isGroupId(groupId) {
    return (
        typeof groupId === "string" &&
        groupId.endsWith("@g.us")
    );
}

function normalizeGroupSettings(group) {
    if (!group || typeof group !== "object") {
        return null;
    }

    if (typeof group.prefix !== "string" || !group.prefix) {
        group.prefix = DEFAULT_SETTINGS.prefix;
    }

    if (typeof group.interactAI !== "boolean") {
        group.interactAI = DEFAULT_SETTINGS.interactAI;
    }

    if (typeof group.welcomeEnabled !== "boolean") {
        group.welcomeEnabled = DEFAULT_SETTINGS.welcomeEnabled;
    }

    if (typeof group.font !== "string" || !group.font) {
        group.font = DEFAULT_SETTINGS.font;
    }

    return group;
}

function getSettings(groupId) {
    if (!isGroupId(groupId)) {
        return { ...DEFAULT_SETTINGS };
    }

    const group = normalizeGroupSettings(
        db.group(groupId)
    );

    return {
        prefix: group.prefix,
        interactAI: group.interactAI,
        welcomeEnabled: group.welcomeEnabled,
        font: group.font
    };
}

function updateSettings(groupId, data) {
    if (!isGroupId(groupId)) {
        return null;
    }

    const group = normalizeGroupSettings(
        db.group(groupId)
    );

    if (data && Object.prototype.hasOwnProperty.call(data, "prefix")) {
        if (typeof data.prefix === "string" && data.prefix) {
            group.prefix = data.prefix;
        }
    }

    if (data && Object.prototype.hasOwnProperty.call(data, "interactAI")) {
        group.interactAI = Boolean(data.interactAI);
    }

    if (data && Object.prototype.hasOwnProperty.call(data, "welcomeEnabled")) {
        group.welcomeEnabled = Boolean(data.welcomeEnabled);
    }

    if (data && Object.prototype.hasOwnProperty.call(data, "font")) {
        if (typeof data.font === "string" && data.font) {
            group.font = data.font;
        }
    }

    db.save();

    return getSettings(groupId);
}

function getPrefix(groupId) {
    if (!isGroupId(groupId)) {
        return DEFAULT_SETTINGS.prefix;
    }

    const group = normalizeGroupSettings(
        db.group(groupId)
    );

    db.save();

    return group.prefix;
}

module.exports = {
    getSettings,
    updateSettings,
    getPrefix
};
