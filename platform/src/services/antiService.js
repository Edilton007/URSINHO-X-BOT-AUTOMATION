const { isOwner, isAdmin } = require("./permissionService");


function unwrapMessage(message) {

    if (!message) return {};

    if (message.ephemeralMessage?.message)
        return unwrapMessage(message.ephemeralMessage.message);

    if (message.viewOnceMessage?.message)
        return unwrapMessage(message.viewOnceMessage.message);

    if (message.viewOnceMessageV2?.message)
        return unwrapMessage(message.viewOnceMessageV2.message);

    return message;

}



function isMediaImage(message) {

    return !!unwrapMessage(message).imageMessage;

}



function isMediaVideo(message) {

    return !!unwrapMessage(message).videoMessage;

}



function isMediaAudio(message) {

    return !!unwrapMessage(message).audioMessage;

}



function isMediaSticker(message) {

    return !!unwrapMessage(message).stickerMessage;

}



function hasLink(text) {

    return /(https?:\/\/|www\.|chat\.whatsapp\.com\/)/i
        .test(text);

}



async function canIgnore(sock, chat, sender) {

    const dono =
        isOwner(sender);


    const admin =
        await isAdmin(
            sock,
            chat,
            sender
        );


    return dono || admin;

}



async function deleteMessage(sock, chat, m) {

    try {

        await sock.sendMessage(
            chat,
            {
                delete: m.key
            }
        );


        return true;


    } catch (e) {

        console.log(
            "Erro apagar mensagem:",
            e.message
        );


        return false;

    }

}



async function removeAndWarn(
    sock,
    chat,
    m,
    text,
    sender
) {

    await deleteMessage(
        sock,
        chat,
        m
    );


    await sock.sendMessage(
        chat,
        {
            text,
            mentions: [
                sender
            ]
        },
        {
            quoted: m
        }
    );

}



module.exports = {

    unwrapMessage,

    isMediaImage,

    isMediaVideo,

    isMediaAudio,

    isMediaSticker,

    hasLink,

    canIgnore,

    deleteMessage,

    removeAndWarn

};
