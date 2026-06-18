# Smart POS — Print Server

A lightweight Node.js WebSocket server that bridges the browser app to your network thermal printers (ESC/POS, e.g. Epson TM-T20/T88).

## Setup

### 1. Install dependencies
```bash
cd print-server
npm install
```

### 2. Configure your printer IPs

Edit `server.js` lines at the top, or set environment variables:

| Variable | Default | Description |
|---|---|---|
| `KITCHEN_PRINTER_IP` | *(none)* | IP of kitchen thermal printer |
| `BAR_PRINTER_IP` | *(none)* | IP of bar thermal printer |
| `BILL_PRINTER_IP` | *(none)* | IP of bill/receipt printer |
| `KITCHEN_PRINTER_PORT` | `9100` | Port (usually 9100) |
| `BAR_PRINTER_PORT` | `9100` | |
| `BILL_PRINTER_PORT` | `9100` | |
| `PRINT_SERVER_PORT` | `9100` | WebSocket port the browser connects to |

Example using environment variables:
```bash
KITCHEN_PRINTER_IP=192.168.1.100 BILL_PRINTER_IP=192.168.1.101 node server.js
```

Or edit `server.js` directly:
```js
const PRINTER_CONFIG = {
  KITCHEN: { ip: "192.168.1.100", port: 9100, name: "Kitchen Printer" },
  BAR:     { ip: null,            port: 9100, name: "Bar Printer" },
  BILL:    { ip: "192.168.1.101", port: 9100, name: "Bill Printer" },
};
```

### 3. Start the server
```bash
npm start
```

The server listens on `ws://localhost:9100` by default. The POS app connects to it automatically.

## Finding your printer's IP

1. Print a self-test page from the printer (hold Feed button while powering on)
2. The IP address will be printed on the test page
3. Make sure the printer and the PC running this server are on the **same network**
