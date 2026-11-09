const { getGroup } = require("./groupService");


function getProtectionSettings(chat) {

    const group = getGroup(chat);

    return group.anti || {};

}


module.exports = {
    getProtectionSettings
};
