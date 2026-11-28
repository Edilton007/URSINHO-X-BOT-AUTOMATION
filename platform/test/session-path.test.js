"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { resolveSessionPath } = require("../src/core/multisession/auth");

test("a pasta de sessões Baileys pode ser movida para armazenamento persistente", () => {
    const previous = process.env.BAILEYS_SESSION_DIR;
    process.env.BAILEYS_SESSION_DIR = path.resolve("/tmp/ursinho-sessions-test");
    try {
        assert.equal(resolveSessionPath("principal"), path.join(path.resolve("/tmp/ursinho-sessions-test"), "principal"));
    } finally {
        if (previous === undefined) delete process.env.BAILEYS_SESSION_DIR;
        else process.env.BAILEYS_SESSION_DIR = previous;
    }
});

test("o nome da sessão não pode escapar da raiz persistente", () => {
    assert.throws(() => resolveSessionPath("../outside"), /Nome de sessão inválido/);
    assert.throws(() => resolveSessionPath("a/b"), /Nome de sessão inválido/);
    assert.throws(() => resolveSessionPath(".."), /Nome de sessão inválido/);
});
