const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { isAdmin, isOwner } = require("../../services/permissionService");


module.exports = {

    name: "revelar",
    aliases: ["r", "reveal"],
    category: "admin-sistema",
    permission: "admin",
    description: "Revela mídia de visualização única",


    run: async (sock, m, ctx) => {


        try {


            const owner =
                isOwner(ctx.sender);


            const admin =
                await isAdmin(
                    sock,
                    ctx.chat,
                    ctx.sender
                );


            if (!owner && !admin) {

                return ctx.reply(
`╭━━━〔 🚫 ACESSO NEGADO 〕━━━╮

❌ Apenas administradores ou dono podem usar este comando.

╰━━━━〔 🐻 URSINHO X BOT V2 〕━━━━╯`
                );

            }



            const contextInfo =
                ctx.m?.message?.extendedTextMessage?.contextInfo ||
                ctx.m?.message?.imageMessage?.contextInfo ||
                ctx.m?.message?.videoMessage?.contextInfo;



            const quoted =
                contextInfo?.quotedMessage;



            console.log(
                "DEBUG QUOTED:",
                JSON.stringify(
                    contextInfo,
                    null,
                    2
                )
            );



            if (!quoted) {

                return ctx.reply(
`╭━━━〔 ⚠️ REVELAR 〕━━━╮

👁️ Responda uma foto,
vídeo ou áudio de visualização única.

╰━━━━〔 🐻 URSINHO X BOT V2 〕━━━━╯`
                );

            }




            const viewOnce =
                quoted.viewOnceMessageV2?.message ||
                quoted.viewOnceMessage?.message ||
                quoted.viewOnceMessageV2Extension?.message ||
                quoted;



            const image =
                viewOnce.imageMessage;


            const video =
                viewOnce.videoMessage;


            const audio =
                viewOnce.audioMessage;



            if (!image && !video && !audio) {


                return ctx.reply(
`╭━━━〔 ❌ ERRO 〕━━━╮

Não encontrei uma mídia
de visualização única válida.

╰━━━━〔 🐻 URSINHO X BOT V2 〕━━━━╯`
                );

            }




            let media;
            let type;
            let tipoTexto;



            if (image) {

                media = image;
                type = "image";
                tipoTexto = "📷 Foto";


            } else if (video) {

                media = video;
                type = "video";
                tipoTexto = "🎥 Vídeo";


            } else {

                media = audio;
                type = "audio";
                tipoTexto = "🔊 Áudio";

            }





            const stream =
                await downloadContentFromMessage(
                    media,
                    type
                );



            let buffer =
                Buffer.alloc(0);



            for await (const chunk of stream) {

                buffer =
                    Buffer.concat([
                        buffer,
                        chunk
                    ]);

            }





            const caption =
`╭━━━〔 ✨ REVELAÇÃO CONCLUÍDA 〕━━━╮

👁️ Aquilo que estava oculto,
agora foi revelado.

✅ Conteúdo recuperado com sucesso!

📂 Tipo de mídia:
${tipoTexto}

━━━━━━━━━━━━━━━━━━━━━━

📖 “Pois nada há oculto que não venha a ser manifesto, e nada se faz escondido que não venha a ser revelado.”

✨ Marcos 4:22

━━━━━━━━━━━━━━━━━━━━━━

╰━━━━━━━🐻 URSINHO X BOT V2━━━━━━━╯`;





            if (type === "image") {


                await sock.sendMessage(
                    ctx.chat,
                    {
                        image: buffer,
                        caption
                    },
                    {
                        quoted: m
                    }
                );


            } else if (type === "video") {


                await sock.sendMessage(
                    ctx.chat,
                    {
                        video: buffer,
                        caption
                    },
                    {
                        quoted: m
                    }
                );


            } else {


                await sock.sendMessage(
                    ctx.chat,
                    {
                        audio: buffer,
                        mimetype: "audio/mp4",
                        ptt: false
                    },
                    {
                        quoted: m
                    }
                );


                await sock.sendMessage(
                    ctx.chat,
                    {
                        text: caption
                    },
                    {
                        quoted: m
                    }
                );

            }



        } catch (e) {


            console.log(
                "REVELAR ERROR:",
                e
            );


            return ctx.reply(
`╭━━━〔 ❌ ERRO 〕━━━╮

Não foi possível revelar este conteúdo.

⚠️ ${e.message}

╰━━━━〔 🐻 URSINHO X BOT V2 〕━━━━╯`
            );


        }


    }

};
