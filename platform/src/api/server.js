const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const path = require("path");

const db = require("../database/database");
const settingsService = require("../services/settingsService");
const { getPublicSiteConfig } = require("../services/publicSiteConfigService");

// URSINHO X BOT AUTOMATION: Backend, Tenant App e Android Agent
// partilham o mesmo processo Express para caberem no servidor atual.
const automationTenantRoutes = require("../automation/routes/tenantRoutes");
const automationDeviceRoutes = require("../automation/routes/deviceRoutes");
const automationAdminRoutes = require("../automation/routes/adminRoutes");
const storefrontApiRoutes = require("../automation/routes/storefrontRoutes");
const { limitarTentativasAdmin } = require("../automation/middleware/rateLimit");

const app = express();

// Em hosts PaaS, PORT é a porta atribuída pelo painel. API_PORT
// continua como fallback para instalações locais antigas.
const PORT = Number(process.env.PORT || process.env.API_PORT) || 3000;
const API_KEY = process.env.API_KEY;

let realSocket = null;

/*
============================================================
MIDDLEWARES
============================================================
*/

const ALLOWED_ORIGINS =
    (process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map(origin => origin.trim())
        .filter(Boolean);

if (ALLOWED_ORIGINS.length === 0) {
    console.log(
        "⚠️  ALLOWED_ORIGINS não configurado no .env — CORS desativado: só a mesma origem (painel servido por este servidor) e apps nativas conseguem usar a API.\n" +
        "   Para travar isso, adiciona no .env algo como:\n" +
        "   ALLOWED_ORIGINS=http://10.192.150.252:3000,https://painel.seudominio.com"
    );
}

app.use(
    cors(
        ALLOWED_ORIGINS.length > 0
            ? {
                origin: ALLOWED_ORIGINS
            }
            : {
                origin: false
            }
    )
);
app.use(express.json({ limit: "1mb" }));

/*
============================================================
AUTENTICAÇÃO DA API
============================================================
*/

function requireApiKey(req, res, next) {

    if (!API_KEY) {
        return res.status(500).json({
            ok: false,
            error: "API_KEY não configurada no servidor."
        });
    }

    const providedKey = req.headers["x-api-key"];

    const expected = Buffer.from(String(API_KEY));
    const received = Buffer.from(String(providedKey || ""));
    const valid = !!providedKey && expected.length === received.length && crypto.timingSafeEqual(expected, received);
    if (!valid) {
        return res.status(401).json({
            ok: false,
            error: "Chave de acesso inválida."
        });
    }

    next();
}

/*
============================================================
URSINHO X BOT AUTOMATION — ROTAS E PAINEL TENANT
============================================================
*/

app.use(
    "/tenant",
    express.static(path.join(__dirname, "../../automation/painel"))
);

app.use("/automation/tenants", automationTenantRoutes);
app.use("/automation/device", automationDeviceRoutes);
app.use("/admin", limitarTentativasAdmin, automationAdminRoutes);
app.use("/api/storefront", storefrontApiRoutes);

// Loja pública de cada tenant e consola global. A página pública nunca recebe credenciais.
app.get("/loja/:slug", (req, res) => {
    res.sendFile(path.join(__dirname, "../../storefront/index.html"));
});
app.use("/master", express.static(path.join(__dirname, "../../master-admin"), { index: "index.html" }));

// Site institucional público. Mantemos o painel antigo do Bot V2 na raiz
// para não quebrar a instalação existente; o website fica em /site/.
app.get("/site/config", (req, res) => {
    res.set("Cache-Control", "no-store").json(getPublicSiteConfig());
});
app.use("/site", (req, res, next) => {
    res.set({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
    });
    next();
}, express.static(path.join(__dirname, "../../site"), { index: "index.html" }));

app.get("/automation/health", (req, res) => {
    res.set("Cache-Control", "no-store").json({ ok: true, service: "URSINHO X BOT AUTOMATION Backend", version: "2.1.1" });
});

/*
============================================================
PAINEL WEB ORIGINAL DO BOT V2
============================================================
*/

app.use(
    express.static(
        path.join(__dirname, "../../painel")
    )
);

/*
============================================================
SOCKET WHATSAPP
============================================================
*/

function setSocket(sock) {
    realSocket = sock;
}

/*
============================================================
ESTATÍSTICAS
============================================================
*/

function getStoredGroupStats() {

    let messages = 0;
    let commands = 0;

    for (const group of Object.values(db.groups || {})) {

        messages += Number(
            group?.stats?.messages || 0
        );

        commands += Number(
            group?.stats?.commands || 0
        );
    }

    return {
        messages,
        commands
    };
}

/*
============================================================
GRUPOS REAIS DO WHATSAPP
============================================================
*/

async function getRealGroups() {

    if (
        !realSocket?.user ||
        typeof realSocket.groupFetchAllParticipating !== "function"
    ) {
        return [];
    }

    try {

        const groups =
            await realSocket.groupFetchAllParticipating();

        return Object.values(groups || {});

    } catch (error) {

        console.error(
            "Erro ao obter grupos reais:",
            error?.message || error
        );

        return [];
    }
}

/*
============================================================
OBTER GRUPO REAL POR ID
============================================================
*/

async function getRealGroupById(groupId) {

    if (
        typeof groupId !== "string" ||
        !groupId.endsWith("@g.us")
    ) {
        return null;
    }

    const groups = await getRealGroups();

    return (
        groups.find(
            group => group?.id === groupId
        ) || null
    );
}

/*
============================================================
HEALTH
============================================================
*/

app.get(
    "/api/health",
    requireApiKey,
    (req, res) => {

        const socketConnected =
            !!realSocket?.user;

        res.json({

            ok: true,

            service:
                "URSINHO X BOT V2",

            status:
                socketConnected
                    ? "online"
                    : "offline",

            socketConnected,

            timestamp:
                new Date().toISOString()
        });
    }
);

/*
============================================================
DASHBOARD
============================================================
*/

app.get(
    "/api/dashboard",
    requireApiKey,
    async (req, res) => {

        try {

            const socketConnected =
                !!realSocket?.user;

            const stats =
                getStoredGroupStats();

            const realGroups =
                await getRealGroups();

            res.json({

                ok: true,

                bot: {

                    name:
                        "URSINHO X BOT V2",

                    status:
                        socketConnected
                            ? "online"
                            : "offline"
                },

                stats,

                groups: {

                    total:
                        realGroups.length
                },

                sessions: {

                    active:
                        socketConnected
                            ? 1
                            : 0,

                    history:
                        Object.keys(
                            db.botSessions?.history || {}
                        ).length
                },

                rental: {

                    codes:
                        Object.keys(
                            db.rental?.codes || {}
                        ).length
                },

                timestamp:
                    new Date().toISOString()
            });

        } catch (error) {

            console.error(
                "Erro no dashboard:",
                error?.message || error
            );

            return res.status(500).json({
                ok: false,
                error: "Não foi possível obter o dashboard."
            });
        }
    }
);

/*
============================================================
GRUPOS
============================================================
*/

app.get(
    "/api/groups",
    requireApiKey,
    async (req, res) => {

        try {

            const realGroups =
                await getRealGroups();

            if (!realGroups.length) {

                return res.json({

                    ok: true,

                    connected:
                        !!realSocket?.user,

                    total: 0,

                    groups: []
                });
            }

            const result =
                realGroups.map((group) => {

                    const groupId =
                        group.id;

                    const storedGroup =
                        db.groups?.[groupId] || {};

                    return {

                        groupId,

                        name:
                            group.subject ||
                            storedGroup.name ||
                            "",

                        subject:
                            group.subject ||
                            storedGroup.subject ||
                            "",

                        owner:
                            group.owner ||
                            null,

                        size:
                            Array.isArray(
                                group.participants
                            )
                                ? group.participants.length
                                : 0,

                        rentalActive:
                            storedGroup.rentalActive === true,

                        rentalExpiresAt:
                            Number(
                                storedGroup.rentalExpiresAt
                            ) || null,

                        font:
                            typeof storedGroup.font === "string"
                                ? storedGroup.font
                                : "serif",

                        prefix:
                            typeof storedGroup.prefix === "string"
                                ? storedGroup.prefix
                                : ".",

                        welcomeEnabled:
                            storedGroup.welcomeEnabled ??
                            storedGroup.bemvindo?.enabled ??
                            false,

                        chatAI:
                            storedGroup.chatAI === true,

                        interactAI:
                            storedGroup.interactAI === true,

                        anti:
                            storedGroup.anti || {},

                        stats: {

                            messages:
                                Number(
                                    storedGroup.stats?.messages || 0
                                ),

                            commands:
                                Number(
                                    storedGroup.stats?.commands || 0
                                )
                        },

                        users:
                            storedGroup.users || {}
                    };
                });

            return res.json({

                ok: true,

                connected: true,

                total:
                    result.length,

                groups:
                    result
            });

        } catch (error) {

            console.error(
                "Erro ao obter grupos:",
                error?.message || error
            );

            return res.status(500).json({
                ok: false,
                error: "Não foi possível obter os grupos."
            });
        }
    }
);

/*
============================================================
CONFIGURAÇÕES DO GRUPO
============================================================
GET
/api/groups/:groupId/settings
============================================================
*/

app.get(
    "/api/groups/:groupId/settings",
    requireApiKey,
    async (req, res) => {

        try {

            const groupId =
                req.params.groupId;

            const realGroup =
                await getRealGroupById(groupId);

            if (!realGroup) {

                return res.status(404).json({
                    ok: false,
                    error: "Grupo não encontrado no WhatsApp."
                });
            }

            const settings =
                settingsService.getSettings(groupId);

            return res.json({

                ok: true,

                groupId,

                groupName:
                    realGroup.subject || "",

                settings
            });

        } catch (error) {

            console.error(
                "Erro ao obter configurações do grupo:",
                error?.message || error
            );

            return res.status(500).json({
                ok: false,
                error:
                    "Não foi possível obter as configurações do grupo."
            });
        }
    }
);

/*
============================================================
ATUALIZAR CONFIGURAÇÕES DO GRUPO
============================================================
PATCH
/api/groups/:groupId/settings
============================================================
*/

app.patch(
    "/api/groups/:groupId/settings",
    requireApiKey,
    async (req, res) => {

        try {

            const groupId =
                req.params.groupId;

            const realGroup =
                await getRealGroupById(groupId);

            if (!realGroup) {

                return res.status(404).json({
                    ok: false,
                    error: "Grupo não encontrado no WhatsApp."
                });
            }

            const body =
                req.body &&
                typeof req.body === "object"
                    ? req.body
                    : {};

            const allowed = [
                "prefix",
                "font",
                "interactAI",
                "welcomeEnabled"
            ];

            const changes = {};

            for (const key of allowed) {

                if (
                    Object.prototype.hasOwnProperty.call(
                        body,
                        key
                    )
                ) {
                    changes[key] = body[key];
                }
            }

            /*
            ====================================================
            PREFIXO
            ====================================================
            */

            if (
                Object.prototype.hasOwnProperty.call(
                    changes,
                    "prefix"
                )
            ) {

                if (
                    typeof changes.prefix !== "string" ||
                    !changes.prefix.trim() ||
                    changes.prefix.length > 5
                ) {

                    return res.status(400).json({
                        ok: false,
                        error: "Prefixo inválido."
                    });
                }

                changes.prefix =
                    changes.prefix.trim();
            }

            /*
            ====================================================
            FONTE
            ====================================================
            */

            if (
                Object.prototype.hasOwnProperty.call(
                    changes,
                    "font"
                )
            ) {

                if (
                    typeof changes.font !== "string" ||
                    !changes.font.trim() ||
                    changes.font.length > 40
                ) {

                    return res.status(400).json({
                        ok: false,
                        error: "Fonte inválida."
                    });
                }

                changes.font =
                    changes.font.trim();
            }

            /*
            ====================================================
            IA INTERATIVA
            ====================================================
            */

            if (
                Object.prototype.hasOwnProperty.call(
                    changes,
                    "interactAI"
                )
            ) {

                changes.interactAI =
                    Boolean(changes.interactAI);
            }

            /*
            ====================================================
            BEM-VINDO
            ====================================================
            */

            if (
                Object.prototype.hasOwnProperty.call(
                    changes,
                    "welcomeEnabled"
                )
            ) {

                changes.welcomeEnabled =
                    Boolean(changes.welcomeEnabled);
            }

            /*
            ====================================================
            NENHUMA ALTERAÇÃO
            ====================================================
            */

            if (!Object.keys(changes).length) {

                return res.status(400).json({
                    ok: false,
                    error:
                        "Nenhuma configuração válida enviada."
                });
            }

            /*
            ====================================================
            SALVAR
            ====================================================
            */

            const settings =
                settingsService.updateSettings(
                    groupId,
                    changes
                );

            return res.json({

                ok: true,

                groupId,

                groupName:
                    realGroup.subject || "",

                settings,

                updated:
                    Object.keys(changes)
            });

        } catch (error) {

            console.error(
                "Erro ao atualizar configurações do grupo:",
                error?.message || error
            );

            return res.status(500).json({
                ok: false,
                error:
                    "Não foi possível atualizar as configurações do grupo."
            });
        }
    }
);

/*
============================================================
INICIAR API
============================================================
*/

function startApi() {
    return new Promise((resolve, reject) => {
        const server = app.listen(PORT, "0.0.0.0", () => {
            console.log(`🌐 API URSINHO X BOT V2 disponível na porta ${PORT}`);
            console.log("🔐 Autenticação da API ativada");
            resolve(server);
        });
        server.once("error", reject);
    });
}

/*
============================================================
EXPORTS
============================================================
*/

module.exports = {

    app,

    startApi,

    setSocket
};
