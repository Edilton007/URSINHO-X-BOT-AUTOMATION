require("dotenv").config();

const config = require("./config/bot");

const {
    startSession
} = require("./core/multisession/SessionManager");

const {
    loadCommands
} = require("./core/commandLoader");

const {
    buildHandler
} = require("./handler");

const {
    registerEvents
} = require("./core/events");

const log = require("./lib/logger");

const {
    startApi,
    setSocket
} = require("./api/server");

const {
    iniciarAgendamentosPendentes
} = require("./services/schedulerService");

const {
    iniciarLimpezaAutomatica
} = require("./services/cleanupService");

const {
    iniciarHorariosAutomaticosPendentes
} = require("./services/groupScheduleService");


const alertas = require("./services/alertService");
const licencas = require("./services/licenseWatchService");
const canalPost = require("./services/channelPostService");
const automationBridge = require("./services/automationBridgeService");
const healthAlertService = require("./services/healthAlertService");
const offsiteBackupService = require("./services/offsiteBackupService");

let fatalExitScheduled = false;
function terminateAfterFatalError(label, error) {
    log.err(`${label}: ${error?.stack || error?.message || error}`);
    if (!fatalExitScheduled) {
        fatalExitScheduled = true;
        try { alertas.erroGlobal(label, error); } catch {}
        // Não continuar a aceitar pedidos depois de uma falha não tratada:
        // o supervisor do alojamento deve reiniciar o processo limpo.
        setTimeout(() => process.exit(1), 1000);
    }
}

process.on("unhandledRejection", (reason) => {
    terminateAfterFatalError("Promessa rejeitada sem tratamento", reason);
});

process.on("uncaughtException", (error) => {
    terminateAfterFatalError("Exceção não tratada", error);
});


async function start() {

    log.banner();

    log.step(
        1,
        `${config.BOT_NAME} a iniciar...`
    );

    const data =
        loadCommands();

    const commands =
        data.commands;

    const commandCount =
        data.commandCount;

    log.ok(
        `${commands.size} comandos carregados`
    );

    const handle =
        buildHandler(
            commands,
            config,
            commandCount
        );

    /*
    ============================================================
    API DO PAINEL
    A API precisa iniciar antes da sessão WhatsApp.
    O socket real será entregue através de setSocket()
    assim que o WhatsApp estiver conectado.
    ============================================================
    */

    await startApi();

    log.ok(
        "API do painel iniciada e porta confirmada"
    );

    iniciarLimpezaAutomatica();

    alertas.iniciarMonitorDeDisco();
    offsiteBackupService.setFailureHandler((error) => healthAlertService.sendBackupFailure(error));
    offsiteBackupService.startOffsiteBackup();

    await startSession(
        "principal",

        async (newSock) => {

            /*
            ====================================================
            SOCKET REAL DO WHATSAPP
            ====================================================
            */

            setSocket(newSock);

            alertas.definirSocket(newSock);

            console.log(
                "✅ Socket real entregue à API do painel"
            );

            registerEvents(
                newSock,
                handle
            );

            console.log(
                "✅ Eventos registados no socket atual"
            );

            iniciarAgendamentosPendentes(newSock);
            iniciarHorariosAutomaticosPendentes(newSock);
            licencas.iniciar(newSock);
            canalPost.iniciar(newSock);
            automationBridge.startAutomationMonitor(newSock);
            healthAlertService.startHealthAlertMonitor(newSock);

        }
    );

    log.ok(
        "API do painel ligada ao socket real"
    );

    log.ok(
        "Sistema de eventos registado"
    );

    log.ok(
        `${config.BOT_NAME} pronto para funcionar`
    );

}


start().catch((error) => {

    log.err(
        `Erro fatal: ${error.message}`
    );
    process.exitCode = 1;

});
