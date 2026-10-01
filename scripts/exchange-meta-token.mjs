import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(".env");
const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
const values = new Map();

for (const line of lines) {
  const separator = line.indexOf("=");
  if (separator <= 0 || line.trimStart().startsWith("#")) {
    continue;
  }

  const key = line.slice(0, separator).trim();
  const value = line
    .slice(separator + 1)
    .trim()
    .replace(/^['"]|['"]$/g, "");
  values.set(key, value);
}

const required = ["META_ACCESS_TOKEN", "META_APP_ID", "META_APP_SECRET"];

for (const key of required) {
  if (!values.get(key)) {
    throw new Error(`${key} is missing`);
  }
}

const url = new URL("https://graph.facebook.com/v26.0/oauth/access_token");
url.search = new URLSearchParams({
  grant_type: "fb_exchange_token",
  client_id: values.get("META_APP_ID"),
  client_secret: values.get("META_APP_SECRET"),
  fb_exchange_token: values.get("META_ACCESS_TOKEN"),
}).toString();

const response = await fetch(url);
const payload = await response.json();

if (!response.ok || typeof payload.access_token !== "string") {
  throw new Error("Meta token exchange failed");
}

const replacement = `META_ACCESS_TOKEN=${payload.access_token}`;
let replaced = false;
const updatedLines = lines.map((line) => {
  if (!line.match(/^\s*META_ACCESS_TOKEN=/)) {
    return line;
  }

  replaced = true;
  return replacement;
});

if (!replaced) {
  updatedLines.push(replacement);
}

writeFileSync(envPath, `${updatedLines.join("\n").trimEnd()}\n`, "utf8");

const expiresAt = new Date(
  Date.now() + Number(payload.expires_in ?? 0) * 1000,
);
console.log(`Meta token exchanged. Expires near ${expiresAt.toISOString()}.`);
