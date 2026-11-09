const { registerMessages } = require("./messages");
const { registerConnection } = require("./connection");
const { registerParticipants } = require("./participants");
const { registerGroupUpdate } = require("./groupUpdate");

function registerEvents(sock, handle) {
    registerConnection(sock);

    registerMessages(
        sock,
        handle
    );

    registerParticipants(
        sock
    );

    registerGroupUpdate(sock);


}

module.exports = {
    registerEvents
};
