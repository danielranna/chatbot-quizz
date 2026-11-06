import fs from "fs";
import { createRequire } from "module";
import P from "pino";
import { downloadMediaMessage, WAMessage, WASocket } from "@whiskeysockets/baileys";
import { extractText } from "./message-utils";

const nodeRequire = createRequire(__filename);
const GASTOS_ROOT = process.env.GASTOS_ROOT || "/opt/gastos";
const STATE_FILE = `${GASTOS_ROOT}/bot/state.json`;

type GastosImage = { base64: string; mime: string } | null;

type GastosHandle = (input: {
  chatId: string;
  text: string;
  image: GastosImage;
  name: string;
}) => Promise<{ handled: boolean; text: string }>;

const { createGastos } = nodeRequire(`${GASTOS_ROOT}/bot/src/gastos`) as {
  createGastos: (options?: { env?: Record<string, string | undefined> }) => { handle: GastosHandle };
};

let gastos: { handle: GastosHandle } | null = null;

function gastosClient() {
  if (!gastos) {
    gastos = createGastos({
      env: {
        SUPABASE_URL: process.env.GASTOS_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.GASTOS_SUPABASE_SERVICE_ROLE_KEY,
        OPENAI_API_KEY: process.env.GASTOS_OPENAI_API_KEY,
        OPENAI_MODEL: process.env.GASTOS_OPENAI_MODEL || "gpt-4o"
      }
    });
  }
  return gastos;
}

function gastosActive(chatId: string) {
  try {
    const all = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as Record<string, { active?: boolean }>;
    return Boolean(all[chatId]?.active);
  } catch {
    return false;
  }
}

async function receiptImage(sock: WASocket, msg: WAMessage): Promise<GastosImage> {
  const imageMessage = msg.message?.imageMessage;
  if (!imageMessage) return null;
  const stream = await downloadMediaMessage(
    msg,
    "buffer",
    {},
    { logger: P({ level: "silent" }), reuploadRequest: sock.updateMediaMessage }
  );
  const data = Buffer.isBuffer(stream) ? stream : Buffer.from(stream as ArrayBuffer);
  return { base64: data.toString("base64"), mime: imageMessage.mimetype || "image/jpeg" };
}

/** Usa só o Supabase do Gastos. O banco do quiz não entra aqui. */
export async function tryHandleGastos(sock: WASocket, msg: WAMessage, remoteJid: string) {
  const text = extractText(msg);
  const lower = text.trim().toLowerCase();
  const active = gastosActive(remoteJid);
  const entering = lower === "/gastos" || lower === "gastos";
  if (!active && !entering && !text && !msg.message?.imageMessage) return false;

  const image = active && msg.message?.imageMessage ? await receiptImage(sock, msg) : null;
  const result = await gastosClient().handle({
    chatId: remoteJid,
    text,
    image,
    name: msg.pushName || ""
  });
  if (result.text) await sock.sendMessage(remoteJid, { text: result.text });
  return result.handled;
}
