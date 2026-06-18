"""
Raw ESC/POS printer helper.
Usage: python rawprint.py <printer_name> <hex_string>
Sends raw bytes to the named Windows printer via win32print (winspool).
"""
import sys
import win32print

def raw_print(printer_name, hex_data):
    raw_bytes = bytes.fromhex(hex_data)
    hPrinter = win32print.OpenPrinter(printer_name)
    try:
        hJob = win32print.StartDocPrinter(hPrinter, 1, ("POS Receipt", None, "RAW"))
        try:
            win32print.StartPagePrinter(hPrinter)
            win32print.WritePrinter(hPrinter, raw_bytes)
            win32print.EndPagePrinter(hPrinter)
        finally:
            win32print.EndDocPrinter(hPrinter)
    finally:
        win32print.ClosePrinter(hPrinter)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python rawprint.py <printer_name> <hex_string>", file=sys.stderr)
        sys.exit(1)
    try:
        raw_print(sys.argv[1], sys.argv[2])
        print("OK")
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
