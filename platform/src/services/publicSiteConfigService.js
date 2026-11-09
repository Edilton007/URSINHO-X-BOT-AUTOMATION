"use strict";

const BRAND = "URSINHO X BOT AUTOMATION";

/**
 * Returns only information intended for the public institutional website.
 * Never forward process.env or internal tenant configuration to a browser.
 */
function normalizePublicContact(value) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return /^\d{9,15}$/.test(digits) ? digits : null;
}

function getPublicSiteConfig(env = process.env) {
  return Object.freeze({
    brand: BRAND,
    contactNumber: normalizePublicContact(env.PUBLIC_CONTACT_NUMBER)
  });
}

module.exports = { normalizePublicContact, getPublicSiteConfig };
