"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizePublicContact,
  getPublicSiteConfig
} = require("../src/services/publicSiteConfigService");

test("site público expõe apenas marca e número de contacto validado", () => {
  assert.equal(normalizePublicContact("+258 84 123 4567"), "258841234567");
  assert.equal(normalizePublicContact("abc 123"), null);
  assert.equal(normalizePublicContact("258123"), null);
  assert.equal(normalizePublicContact(null), null);

  const config = getPublicSiteConfig({
    PUBLIC_CONTACT_NUMBER: "+258 84 123 4567",
    API_KEY: "segredo-nao-deve-sair",
    ADMIN_API_KEY: "admin-nao-deve-sair"
  });
  assert.deepEqual(config, {
    brand: "URSINHO X BOT AUTOMATION",
    contactNumber: "258841234567"
  });
  assert.equal(Object.hasOwn(config, "API_KEY"), false);
  assert.equal(Object.hasOwn(config, "ADMIN_API_KEY"), false);
});
