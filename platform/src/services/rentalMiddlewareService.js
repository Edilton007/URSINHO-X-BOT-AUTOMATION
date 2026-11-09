const {
  checkRentalAccess
} = require("./rentalGuardService");


function checkRentalMiddleware(sender, chat, cmdName) {

  return checkRentalAccess(
    sender,
    chat,
    cmdName
  );

}


module.exports = {
  checkRentalMiddleware
};
