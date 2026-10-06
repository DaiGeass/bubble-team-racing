#!/usr/bin/env node
// Servidor de partidas en red para Bubble Team Racing.
//
// Hace dos cosas por el mismo puerto: sirve el juego (dist/index.html) a quien
// abra la dirección en un navegador, y reenvía los mensajes de la partida entre
// los que estén dentro. No lleva la carrera: cada jugador conduce su kart en su
// propia máquina y el anfitrión, el primero que entra, lleva los bots.
//
// No usa ninguna dependencia: solo lo que trae Node.
//
//   node servidor/servidor.mjs [puerto]
//
// Sirve igual en la red de casa que por Hamachi o Radmin VPN: los demás solo
// necesitan la dirección que sale abajo y un navegador.

import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8765);
const MAX_PLAYERS = 8;
const here = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.join(here, "..", "dist", "index.html");

/** @type {Map<number, import("node:net").Socket & { buf?: Buffer }>} */
const clients = new Map();
let nextId = 1;
let hostId = 0;

// ---------------------------------------------------------------- http
const server = http.createServer((req, res) => {
  const url = (req.url ?? "/").split("?")[0];
  if (url === "/" || url === "/index.html") {
    fs.readFile(GAME, (err, data) => {
      if (err) {
        res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        res.end("No encuentro dist/index.html. Compila primero el juego con: npm run build\n");
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(data);
    });
    return;
  }
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("404\n");
});

// ---------------------------------------------------------------- websocket
/** One text frame, unmasked, as a server sends it. */
function frame(text) {
  const body = Buffer.from(text, "utf8");
  const n = body.length;
  let head;
  if (n < 126) head = Buffer.from([0x81, n]);
  else if (n < 65536) {
    head = Buffer.alloc(4);
    head[0] = 0x81;
    head[1] = 126;
    head.writeUInt16BE(n, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x81;
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(n), 2);
  }
  return Buffer.concat([head, body]);
}

function send(id, obj) {
  const s = clients.get(id);
  if (s && !s.destroyed) s.write(frame(JSON.stringify(obj)));
}

function broadcast(obj, except = 0) {
  const data = frame(JSON.stringify(obj));
  for (const [id, s] of clients) if (id !== except && !s.destroyed) s.write(data);
}

function drop(id) {
  const s = clients.get(id);
  if (!s) return;
  clients.delete(id);
  s.destroy();
  broadcast({ t: "bye", from: id });
  if (id === hostId) {
    // the longest-standing player takes over the room
    hostId = clients.size ? Math.min(...clients.keys()) : 0;
    if (hostId) broadcast({ t: "host", id: hostId });
  }
  console.log(`  - sale el jugador ${id} (${clients.size} dentro)`);
}

/** Pull every complete frame out of what has arrived so far. */
function read(id, socket) {
  for (;;) {
    const buf = socket.buf;
    if (!buf || buf.length < 2) return;
    const op = buf[0] & 0x0f;
    const masked = (buf[1] & 0x80) !== 0;
    let len = buf[1] & 0x7f;
    let at = 2;
    if (len === 126) {
      if (buf.length < 4) return;
      len = buf.readUInt16BE(2);
      at = 4;
    } else if (len === 127) {
      if (buf.length < 10) return;
      len = Number(buf.readBigUInt64BE(2));
      at = 10;
    }
    if (len > 1 << 20) return drop(id);
    const need = at + (masked ? 4 : 0) + len;
    if (buf.length < need) return;
    let body = buf.subarray(at + (masked ? 4 : 0), need);
    if (masked) {
      const mask = buf.subarray(at, at + 4);
      body = Buffer.from(body);
      for (let i = 0; i < body.length; i++) body[i] ^= mask[i & 3];
    }
    socket.buf = buf.subarray(need);
    if (op === 0x8) return drop(id);
    if (op === 0x9) {
      // ping: answer with the same payload
      socket.write(Buffer.concat([Buffer.from([0x8a, body.length]), body]));
      continue;
    }
    if (op !== 0x1) continue;
    let msg;
    try {
      msg = JSON.parse(body.toString("utf8"));
    } catch {
      continue;
    }
    if (!msg || typeof msg !== "object") continue;
    msg.from = id;
    // addressed to one player, or to everybody else
    if (typeof msg.to === "number") send(msg.to, msg);
    else broadcast(msg, id);
  }
}

server.on("upgrade", (req, socket) => {
  const key = req.headers["sec-websocket-key"];
  if (!key || (req.headers.upgrade ?? "").toLowerCase() !== "websocket") return socket.destroy();
  const accept = crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  if (clients.size >= MAX_PLAYERS) {
    socket.write(frame(JSON.stringify({ t: "full" })));
    socket.end();
    return;
  }
  const id = nextId++;
  clients.set(id, socket);
  if (!hostId) hostId = id;
  socket.buf = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    socket.buf = Buffer.concat([socket.buf, chunk]);
    read(id, socket);
  });
  socket.on("close", () => drop(id));
  socket.on("error", () => drop(id));
  send(id, { t: "hello", id, host: hostId, others: [...clients.keys()].filter((k) => k !== id) });
  broadcast({ t: "join", from: id }, id);
  console.log(`  + entra el jugador ${id}${id === hostId ? " (anfitrión)" : ""} (${clients.size} dentro)`);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("\nBubble Team Racing — partida en red\n");
  console.log(`  Tú:         http://localhost:${PORT}`);
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family !== "IPv4" || a.internal) continue;
      console.log(`  Los demás:  http://${a.address}:${PORT}   (${name})`);
    }
  }
  console.log("\nPasa a tus amigos la dirección de la red que compartan (la de casa, o la de Hamachi / Radmin VPN).");
  console.log("Solo necesitan abrirla en el navegador. Ctrl+C para cerrar.\n");
});
