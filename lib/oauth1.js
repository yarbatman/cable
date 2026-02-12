// lib/oauth1.js
// Minimal OAuth 1.0a implementation using only Node.js built-in crypto
// This avoids ESM/CJS issues with the oauth-1.0a + crypto-js packages on Vercel
import { createHmac, randomBytes } from "node:crypto";

function percentEncode(str) {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function generateNonce() {
  return randomBytes(16).toString("hex");
}

function generateTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}

function buildBaseString(method, url, params) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&");
  return `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(sorted)}`;
}

function sign(baseString, consumerSecret, tokenSecret = "") {
  const key = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return createHmac("sha1", key).update(baseString).digest("base64");
}

export function createOAuthHeader({
  method,
  url,
  consumerKey,
  consumerSecret,
  token = "",
  tokenSecret = "",
  extraParams = {},
}) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: generateTimestamp(),
    oauth_version: "1.0",
    ...extraParams,
  };

  if (token) {
    oauthParams.oauth_token = token;
  }

  const baseString = buildBaseString(method, url, oauthParams);
  oauthParams.oauth_signature = sign(baseString, consumerSecret, tokenSecret);

  const header = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(", ");

  return `OAuth ${header}`;
}
