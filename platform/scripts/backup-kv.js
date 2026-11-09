"use strict";
require("dotenv").config();
const backup = require("../src/services/offsiteBackupService");

backup.createBackup()
    .then((result) => {
        if (!result.ok) throw new Error(result.reason || "Backup não concluído.");
        console.log("BACKUP EXTERNO CONCLUÍDO");
        console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
        console.error("BACKUP EXTERNO FALHOU:", error?.message || error);
        process.exitCode = 1;
    });
