"""
Raw ESC/POS printer helper.
Usage: python rawprint.py <printer_name> <hex_string_or_file>
Sends raw bytes to the named Windows printer via win32print (winspool).
If the second argument starts with '@', the rest is treated as a file path
containing the hex string (used to avoid Windows command-line length limits
when printing large logos).
"""
import os
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
            win32print.EndDocPrinter(hJob)
    finally:
        win32print.ClosePrinter(hPrinter)

def read_hex_arg(arg):
    if arg.startswith("@"):
        hex_file = arg[1:]
        with open(hex_file, "r", encoding="utf-8") as f:
            return f.read().strip()
    return arg

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python rawprint.py <printer_name> <hex_string_or_file>", file=sys.stderr)
        sys.exit(1)
    try:
        hex_data = read_hex_arg(sys.argv[2])
        raw_print(sys.argv[1], hex_data)
        print("OK")
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
