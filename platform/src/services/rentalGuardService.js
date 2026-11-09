const { isOwner } = require("./permissionService");
const { getGroup } = require("./groupService");
const { isBlocked } = require("./rentalService");

function checkRentalAccess(sender, chat, command) {

    console.log("===== RENTAL GUARD DEBUG =====");
    console.log("sender:", sender);
    console.log("chat:", chat);
    console.log("command:", command);

    if (!chat.endsWith("@g.us")) {
        console.log("RESULTADO: PERMITIDO — não é grupo");
        return true;
    }

    const owner = isOwner(sender);

    console.log("isOwner(sender):", owner);

    if (owner) {
        console.log("RESULTADO: PERMITIDO — proprietário oficial");
        return true;
    }

    const group = getGroup(chat);

    console.log("group.rentalActive:", group.rentalActive);
    console.log("group.rentalExpiresAt:", group.rentalExpiresAt);

    const now = Date.now();

    const active =
        group.rentalActive === true &&
        Number(group.rentalExpiresAt) > now;

    const blocked = isBlocked(chat);

    console.log("agora:", now);
    console.log("active:", active);
    console.log("blocked:", blocked);

    const allowedCommands = ["ativar"];

    if (blocked) {
        const result = allowedCommands.includes(command);

        console.log(
            "RESULTADO:",
            result
                ? "PERMITIDO — ativar"
                : "BLOQUEADO — grupo bloqueado"
        );

        return result;
    }

    if (!active && !allowedCommands.includes(command)) {
        console.log("RESULTADO: BLOQUEADO — licença inativa");
        return false;
    }

    console.log("RESULTADO: PERMITIDO — licença do grupo ativa");

    return true;
}

module.exports = {
    checkRentalAccess
};
