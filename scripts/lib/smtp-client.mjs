import net from "node:net";
import tls from "node:tls";
import { Buffer } from "node:buffer";

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function base64(value) {
    return Buffer.from(String(value), "utf8").toString("base64");
}

function base64Chunked(value) {
    const b64 = Buffer.from(String(value), "utf8").toString("base64");
    return b64.replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

function encodeMimeWord(value) {
    return `=?UTF-8?B?${Buffer.from(String(value || ""), "utf8").toString("base64")}?=`;
}

function parseCode(line) {
    const match = String(line).match(/^(\d{3})/);
    return match ? Number(match[1]) : null;
}

async function readReply(socket, timeoutMs) {
    let buffer = "";
    const lines = [];

    const readUntilComplete = async () =>
        new Promise((resolve, reject) => {
            const onData = (chunk) => {
                buffer += chunk.toString("utf8");
                const parts = buffer.split(/\r?\n/);
                buffer = parts.pop() || "";
                for (const raw of parts) {
                    if (!raw) continue;
                    lines.push(raw);
                    const code = parseCode(raw);
                    const isDone = code && raw[3] === " ";
                    if (isDone) {
                        cleanup();
                        resolve(lines);
                        return;
                    }
                }
            };
            const onError = (err) => {
                cleanup();
                reject(err);
            };
            const onClose = () => {
                cleanup();
                reject(new Error("SMTP socket closed unexpectedly"));
            };
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error("SMTP response timeout"));
            }, timeoutMs);

            const cleanup = () => {
                clearTimeout(timeout);
                socket.off("data", onData);
                socket.off("error", onError);
                socket.off("close", onClose);
            };

            socket.on("data", onData);
            socket.on("error", onError);
            socket.on("close", onClose);
        });

    return readUntilComplete();
}

async function sendCommand(socket, command, expectedCodes, timeoutMs) {
    if (command) socket.write(`${command}\r\n`);
    const lines = await readReply(socket, timeoutMs);
    const last = lines[lines.length - 1] || "";
    const code = parseCode(last);
    if (!code || !expectedCodes.includes(code)) {
        throw new Error(`SMTP command failed: ${command || "<greeting>"} -> ${last}`);
    }
    return lines;
}

export async function sendMailSmtp({
    host,
    port = 465,
    secure = true,
    username,
    password,
    from,
    to = [],
    cc = [],
    subject,
    text,
    html,
    timeoutMs = 15000
}) {
    const recipients = [...to, ...cc].filter(Boolean);
    if (recipients.length === 0) throw new Error("No recipients");

    const socket = secure
        ? tls.connect({ host, port, servername: host, rejectUnauthorized: true })
        : net.createConnection({ host, port });

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("SMTP connect timeout")), timeoutMs);
        socket.once("error", (err) => {
            clearTimeout(timeout);
            reject(err);
        });
        socket.once("connect", () => {
            clearTimeout(timeout);
            resolve();
        });
        socket.once("secureConnect", () => {
            clearTimeout(timeout);
            resolve();
        });
    });

    try {
        await sendCommand(socket, "", [220], timeoutMs);
        await sendCommand(socket, `EHLO ${host}`, [250], timeoutMs);

        if (username && password) {
            await sendCommand(socket, "AUTH LOGIN", [334], timeoutMs);
            await sendCommand(socket, base64(username), [334], timeoutMs);
            await sendCommand(socket, base64(password), [235], timeoutMs);
        }

        await sendCommand(socket, `MAIL FROM:<${from}>`, [250], timeoutMs);
        for (const recipient of recipients) {
            await sendCommand(socket, `RCPT TO:<${recipient}>`, [250, 251], timeoutMs);
        }

        await sendCommand(socket, "DATA", [354], timeoutMs);
        const mime = [
            `From: ${from}`,
            `To: ${to.join(", ")}`,
            cc.length ? `Cc: ${cc.join(", ")}` : "",
            `Subject: ${encodeMimeWord(subject)}`,
            `Date: ${new Date().toUTCString()}`,
            `Message-ID: <${Date.now()}.${Math.random().toString(16).slice(2)}@${host}>`,
            "MIME-Version: 1.0",
            'Content-Type: multipart/alternative; boundary="boundary_001"',
            "",
            "--boundary_001",
            "Content-Type: text/plain; charset=UTF-8",
            "Content-Transfer-Encoding: base64",
            "",
            base64Chunked(text || ""),
            "",
            "--boundary_001",
            "Content-Type: text/html; charset=UTF-8",
            "Content-Transfer-Encoding: base64",
            "",
            base64Chunked(html || ""),
            "",
            "--boundary_001--",
            "."
        ]
            .filter(Boolean)
            .join("\r\n");

        socket.write(`${mime}\r\n`);
        await sendCommand(socket, "", [250], timeoutMs);
        await sendCommand(socket, "QUIT", [221], timeoutMs);
    } finally {
        await sleep(10);
        socket.end();
    }
}
