const db = require("../database/database");

function getUser(groupId, jid) {
    if (!groupId || !jid) {
        return null;
    }

    return db.groupUser(groupId, jid);
}

function updateUser(groupId, jid, name) {
    const user = getUser(groupId, jid);

    if (!user) {
        return null;
    }

    if (name) {
        user.name = name;
    }

    db.save();
    return user;
}

function addMessage(groupId, jid) {
    const user = getUser(groupId, jid);

    if (!user) {
        return null;
    }

    user.msgs++;

    db.save();
    return user;
}

function addCommand(groupId, jid) {
    const user = getUser(groupId, jid);

    if (!user) {
        return null;
    }

    user.cmdsUsed++;

    db.save();
    return user;
}

function addWarn(groupId, jid) {
    const user = getUser(groupId, jid);

    if (!user) {
        return null;
    }

    user.warns++;

    db.save();
    return user;
}

function removeWarn(groupId, jid) {
    const user = getUser(groupId, jid);

    if (!user) {
        return null;
    }

    if (user.warns > 0) {
        user.warns--;
    }

    db.save();
    return user;
}

function setBalance(groupId, jid, amount) {
    const user = getUser(groupId, jid);

    if (!user) {
        return null;
    }

    user.balance = Number(amount) || 0;

    db.save();
    return user;
}

function addBalance(groupId, jid, amount) {
    const user = getUser(groupId, jid);

    if (!user) {
        return null;
    }

    user.balance += Number(amount) || 0;

    db.save();
    return user;
}

function removeBalance(groupId, jid, amount) {
    const user = getUser(groupId, jid);

    if (!user) {
        return null;
    }

    user.balance -= Number(amount) || 0;

    db.save();
    return user;
}

module.exports = {
    getUser,
    updateUser,
    addMessage,
    addCommand,
    addWarn,
    removeWarn,
    setBalance,
    addBalance,
    removeBalance
};
