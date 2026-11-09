const db = require("../database/database");


function getInfractions(groupJid, userJid) {

    const group = db.group(groupJid);

    group.infractions = group.infractions || {};

    if (typeof group.infractions[userJid] !== "number") {
        group.infractions[userJid] = 0;
    }

    return group.infractions[userJid];

}


function addInfraction(groupJid, userJid) {

    const group = db.group(groupJid);

    const total =
        getInfractions(groupJid, userJid) + 1;

    group.infractions[userJid] = total;

    db.save();

    return total;

}


function clearInfractions(groupJid, userJid) {

    const group = db.group(groupJid);

    if (group.infractions?.[userJid]) {

        delete group.infractions[userJid];

        db.save();

    }

}


module.exports = {
    getInfractions,
    addInfraction,
    clearInfractions
};
