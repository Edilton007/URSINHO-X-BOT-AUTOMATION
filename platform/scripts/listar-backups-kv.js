"use strict";
require("dotenv").config();
const backup = require("../src/services/offsiteBackupService");

backup.listSnapshots()
    .then((items) => {
        if (!items.length) {
            console.log("Nenhum snapshot encontrado no prefixo configurado.");
            return;
        }
        console.log("SNAPSHOTS DISPONÍVEIS (mais recentes primeiro)");
        for (const item of items.slice(0, 100)) console.log(`${item.snapshotId}  ${item.manifestKey}`);
        console.log(`\nTotal: ${items.length}. Retenção configurada: ${process.env.OFFSITE_BACKUP_RETENTION_DAYS || 7} dias.`);
    })
    .catch((error) => {
        console.error("FALHA AO LISTAR SNAPSHOTS:", error?.message || error);
        process.exitCode = 1;
    });
