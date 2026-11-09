const { isOwner } = require("./permissionService");

function hasActiveLicense(group, sender) {

  const dono = isOwner(sender);

  const ativo =
    group.rentalActive === true &&
    group.rentalExpiresAt > Date.now();

  return dono || ativo;

}


function canUseWithoutLicense(cmdName) {

  const liberados = [
    "ativar"
  ];

  return liberados.includes(cmdName);

}


module.exports = {
  hasActiveLicense,
  canUseWithoutLicense
};
