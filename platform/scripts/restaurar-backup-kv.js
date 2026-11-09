"use strict";
require("dotenv").config();
const backup = require("../src/services/offsiteBackupService");

const snapshotId = process.argv[2];
if (!snapshotId) {
    console.error("Uso: npm run restore:stage -- <SNAPSHOT_ID>");
    process.exit(2);
}

backup.restoreSnapshotToStaging(snapshotId)
    .then((receipt) => {
        console.log("RESTAURO VALIDADO EM PASTA TEMPORÁRIA");
        console.log(JSON.stringify(receipt, null, 2));
        console.log("Nenhum ficheiro de produção foi substituído. Pare o bot e faça a revisão manual antes de qualquer recuperação.");
    })
    .catch((error) => {
        console.error("RESTAURO FALHOU:", error?.message || error);
        process.exitCode = 1;
    });
