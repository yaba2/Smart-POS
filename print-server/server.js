/**
 * Smart POS - Local WebSocket Print Server
 * Supports both USB (Windows spooler) and Network (TCP) thermal printers.
 *
 * For local use only: listens on ws://localhost:9090 (plain WebSocket).
 * This avoids all SSL certificate issues when the POS app is opened via http://.
 *
 * For USB printers: uses Windows "copy /b" to send raw ESC/POS bytes to the printer.
 * For Network printers: connects via TCP socket directly.
 */

const WebSocket = require("ws");
const http = require("http");
const net = require("net");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

// ── Configuration ──────────────────────────────────────────────────────────────
// For each destination set EITHER:
//   usbName  → the exact Windows printer name (from Control Panel → Devices & Printers)
//   ip+port  → for network printers
//
// To find your Windows printer name + port, run in PowerShell:
//   Get-Printer | Select-Object Name, PortName
//
const PRINTER_CONFIG = {
  KITCHEN: {
    name:     "Kitchen Printer",
    usbName:  process.env.KITCHEN_PRINTER_USB  || null,  // e.g. "POS-58C"
    portName: process.env.KITCHEN_PRINTER_PORT_NAME || null, // e.g. "USB002"
    ip:       process.env.KITCHEN_PRINTER_IP   || null,
    port:     parseInt(process.env.KITCHEN_PRINTER_PORT  || "9100"),
  },
  BAR: {
    name:     "Bar Printer",
    usbName:  process.env.BAR_PRINTER_USB      || null,
    portName: process.env.BAR_PRINTER_PORT_NAME || null,
    ip:       process.env.BAR_PRINTER_IP       || null,
    port:     parseInt(process.env.BAR_PRINTER_PORT      || "9100"),
  },
  BILL: {
    name:     "Bill Printer",
    usbName:  process.env.BILL_PRINTER_USB     || null,
    portName: process.env.BILL_PRINTER_PORT_NAME || null,
    ip:       process.env.BILL_PRINTER_IP      || null,
    port:     parseInt(process.env.BILL_PRINTER_PORT     || "9100"),
  },
};

const WS_PORT = parseInt(process.env.PRINT_SERVER_PORT || "9090"); // plain ws://

// ── Job Queue ──────────────────────────────────────────────────────────────────
const jobQueue = new Map(); // jobId → { jobId, destination, commands, status, attempts, error }
const MAX_ATTEMPTS = 3;

// ── WebSocket Server ───────────────────────────────────────────────────────────
function logPrinterConfig() {
  console.log("[Print Server] Printer config:");
  Object.entries(PRINTER_CONFIG).forEach(([dest, cfg]) => {
    if (cfg.usbName) console.log(`  ${dest}: USB → "${cfg.usbName}" (port: ${cfg.portName || "auto"})`);
    else if (cfg.ip) console.log(`  ${dest}: Network → ${cfg.ip}:${cfg.port}`);
    else             console.log(`  ${dest}: NOT CONFIGURED`);
  });
}

function startServer() {
  const plainServer = http.createServer();
  const wss = new WebSocket.Server({ server: plainServer });

  plainServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[Print Server] Port ${WS_PORT} already in use. Retrying in 2s...`);
      setTimeout(startServer, 2000);
    } else {
      console.error("[Print Server] Fatal error:", err.message);
    }
  });

  plainServer.listen(WS_PORT, () => {
    console.log(`[Print Server] ws:// listening on port ${WS_PORT}`);
  });

  setupHandlers(wss);

  // Auto-detect printers and log config
  autoDetectWindowsPrinter().then(() => logPrinterConfig());
}

startServer();

function setupHandlers(wss) {
wss.on("connection", (ws) => {
  console.log("[Print Server] Client connected");

  // Send initial state
  ws.send(JSON.stringify({
    type: "connected",
    printers: Object.entries(PRINTER_CONFIG).map(([dest, cfg]) => ({
      destination: dest,
      name: cfg.name,
      configured: !!(cfg.usbName || cfg.portName || cfg.ip),
    })),
  }));

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    switch (msg.type) {
      case "print": {
        const { jobId, destination, commands } = msg;
        if (!jobId || !destination || !commands) {
          ws.send(JSON.stringify({ type: "error", message: "Missing jobId, destination, or commands" }));
          return;
        }

        const job = { jobId, destination, commands, status: "pending", attempts: 0, error: null };
        jobQueue.set(jobId, job);

        ws.send(JSON.stringify({ type: "print_queued", jobId, destination }));
        console.log(`[Print Server] Job queued: ${jobId} → ${destination}`);

        // Execute print
        await executePrint(job, ws);
        break;
      }

      case "retry": {
        const job = jobQueue.get(msg.jobId);
        if (!job) {
          ws.send(JSON.stringify({ type: "error", message: "Job not found" }));
          return;
        }
        job.status = "pending";
        job.attempts = 0;
        await executePrint(job, ws);
        break;
      }

      case "get_queue": {
        ws.send(JSON.stringify({
          type: "queue_status",
          queue: Array.from(jobQueue.values()).map(({ jobId, destination, status, attempts, error }) => ({
            id: jobId, destination, status, attempts, error,
          })),
        }));
        break;
      }

      case "detect_printers": {
        const results = {};
        const winPrinters = await listWindowsPrinters();
        console.log("[Print Server] Windows printers found:", winPrinters);

        await Promise.all(
          Object.entries(PRINTER_CONFIG).map(async ([dest, cfg]) => {
            if (cfg.usbName || cfg.portName) {
              const found = winPrinters.some(p =>
                (cfg.usbName && p.name.toLowerCase() === cfg.usbName.toLowerCase()) ||
                (cfg.portName && p.portName.toLowerCase() === cfg.portName.toLowerCase())
              );
              results[dest] = { name: cfg.name, usbName: cfg.usbName, portName: cfg.portName, found, type: "USB" };
            } else if (cfg.ip) {
              const reachable = await testConnection(cfg.ip, cfg.port);
              results[dest] = { name: cfg.name, ip: cfg.ip, port: cfg.port, reachable, type: "NETWORK" };
            } else {
              results[dest] = { configured: false };
            }
          })
        );
        ws.send(JSON.stringify({ type: "printers_detected", config: results }));
        break;
      }

      default:
        ws.send(JSON.stringify({ type: "error", message: `Unknown message type: ${msg.type}` }));
    }
  });

  ws.on("close", () => console.log("[Print Server] Client disconnected"));
  ws.on("error", (err) => console.error("[Print Server] WS error:", err.message));
});
} // end setupHandlers

// ── Print Execution ────────────────────────────────────────────────────────────
async function executePrint(job, ws) {
  const config = PRINTER_CONFIG[job.destination];

  if (!config || (!config.usbName && !config.portName && !config.ip)) {
    job.status = "failed";
    job.error = `No printer configured for destination: ${job.destination}`;
    console.warn(`[Print Server] ${job.error}`);
    ws.send(JSON.stringify({ type: "print_failed", jobId: job.jobId, error: job.error }));
    return;
  }

  while (job.attempts < MAX_ATTEMPTS) {
    job.attempts++;
    job.status = "printing";

    try {
      if (config.usbName || config.portName) {
        console.log(`[Print Server] Printing job ${job.jobId} → USB "${config.usbName}" port "${config.portName}" (attempt ${job.attempts})`);
        await sendToUsbPrinter(config.usbName, config.portName, job.commands);
      } else {
        console.log(`[Print Server] Printing job ${job.jobId} → ${config.ip}:${config.port} (attempt ${job.attempts})`);
        await sendToNetworkPrinter(config.ip, config.port, job.commands);
      }
      job.status = "completed";
      console.log(`[Print Server] ✓ Job completed: ${job.jobId}`);
      ws.send(JSON.stringify({ type: "print_completed", jobId: job.jobId }));
      return;
    } catch (err) {
      console.error(`[Print Server] Attempt ${job.attempts} failed: ${err.message}`);
      job.error = err.message;
      if (job.attempts < MAX_ATTEMPTS) {
        await sleep(1000 * job.attempts); // back-off: 1s, 2s
      }
    }
  }

  job.status = "failed";
  console.error(`[Print Server] ✗ Job failed after ${MAX_ATTEMPTS} attempts: ${job.jobId}`);
  ws.send(JSON.stringify({ type: "print_failed", jobId: job.jobId, error: job.error }));
}

// ── USB Printer — raw ESC/POS via Python win32print ───────────────────────────
// Uses rawprint.py (in the same folder) which calls win32print directly.
// This is the most reliable method on Windows without needing Visual Studio.
const RAWPRINT_PY = path.join(__dirname, "rawprint.py");

function sendToUsbPrinter(printerName, portName, hexCommands) {
  return new Promise((resolve, reject) => {
    if (!printerName) {
      return reject(new Error("No printer name configured"));
    }

    // Escape printer name for command line (wrap in quotes, escape internal quotes)
    const safeName = printerName.replace(/"/g, '\\"');
    const cmd = `python "${RAWPRINT_PY}" "${safeName}" ${hexCommands}`;

    exec(cmd, { shell: "cmd.exe", timeout: 15000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`rawprint.py failed: ${stderr.trim() || err.message}`));
      }
      const out = stdout.trim();
      if (out !== "OK") {
        return reject(new Error(`rawprint.py unexpected output: ${out || stderr.trim()}`));
      }
      console.log(`[Print Server] ✓ Raw ESC/POS sent to "${printerName}"`);
      resolve();
    });
  });
}

// ── List Windows Printers (name + port) ───────────────────────────────────────
function listWindowsPrinters() {
  return new Promise((resolve) => {
    exec(
      `powershell -Command "Get-Printer | Select-Object Name,PortName | ConvertTo-Json"`,
      (err, stdout) => {
        if (err) { resolve([]); return; }
        try {
          let raw = JSON.parse(stdout.trim());
          if (!Array.isArray(raw)) raw = [raw]; // single printer returns object
          resolve(raw.map(p => ({ name: String(p.Name || "").trim(), portName: String(p.PortName || "").trim() })));
        } catch {
          resolve([]);
        }
      }
    );
  });
}

// ── Auto-detect: find receipt-type printers (USB port) and assign to all
//    unconfigured destinations automatically.
function autoDetectWindowsPrinter() {
  const unconfigured = Object.values(PRINTER_CONFIG).filter(c => !c.usbName && !c.ip);
  if (unconfigured.length === 0) return Promise.resolve();

  return listWindowsPrinters().then((printers) => {
    if (printers.length === 0) {
      console.warn("[Print Server] No Windows printers found — is the printer plugged in?");
      return;
    }

    // Prefer printers on USB ports (USB001, USB002, etc.) — these are receipt printers
    const usbPrinters = printers.filter(p => /^USB\d+$/i.test(p.portName));
    const chosen = usbPrinters.length > 0 ? usbPrinters[0] : printers[0];

    unconfigured.forEach(cfg => {
      cfg.usbName  = chosen.name;
      cfg.portName = chosen.portName;
    });

    console.log(`[Print Server] Auto-detected: "${chosen.name}" on port "${chosen.portName}"`);
    if (printers.length > 1) {
      console.log("[Print Server] All detected printers:");
      printers.forEach((p, i) => console.log(`  [${i}] "${p.name}" — port: ${p.portName}`));
    }
  });
}

// ── Network Printer Communication ──────────────────────────────────────────────
function sendToNetworkPrinter(ip, port, hexCommands) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timeout = 5000; // 5s

    socket.setTimeout(timeout);

    socket.connect(port, ip, () => {
      // Convert hex string to Buffer and send
      const buffer = Buffer.from(hexCommands, "hex");
      socket.write(buffer, (err) => {
        if (err) { socket.destroy(); reject(err); return; }
        // Give the printer time to receive all data before closing
        setTimeout(() => { socket.destroy(); resolve(); }, 300);
      });
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`Connection timed out to ${ip}:${port}`));
    });

    socket.on("error", (err) => {
      socket.destroy();
      reject(new Error(`Network error: ${err.message}`));
    });
  });
}

function testConnection(ip, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.connect(port, ip, () => { socket.destroy(); resolve(true); });
    socket.on("timeout", () => { socket.destroy(); resolve(false); });
    socket.on("error", () => { socket.destroy(); resolve(false); });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
