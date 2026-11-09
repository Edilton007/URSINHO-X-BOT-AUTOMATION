const db = require("../database/database");

function getGroup(jid) {
    return db.group(jid);
}


function updateGroup(jid, data) {

    const group = db.group(jid);

    Object.assign(group, data);

    db.save();

    return group;
}


function setAnti(jid, anti) {

    const group = db.group(jid);

    group.anti = {
        ...group.anti,
        ...anti
    };

    db.save();

    return group.anti;
}


module.exports = {
    getGroup,
    updateGroup,
    setAnti
};
