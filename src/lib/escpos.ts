/**
 * ESC/POS Receipt Generator for 80mm Thermal Printers
 * Optimized for Epson printers (Kitchen, Bar, and Bill tickets)
 */

// ESC/POS Command constants
const COMMANDS = {
  // Initialization
  INITIALIZE: '1B40',           // ESC @
  
  // Alignment
  ALIGN_LEFT: '1B6100',         // ESC a 0
  ALIGN_CENTER: '1B6101',       // ESC a 1
  ALIGN_RIGHT: '1B6102',        // ESC a 2
  
  // Text formatting
  NORMAL: '1B2100',              // ESC ! 0
  BOLD_ON: '1B2108',            // ESC ! 8
  BOLD_OFF: '1B2100',           // ESC ! 0
  DOUBLE_HEIGHT: '1D2101',      // GS ! 1
  DOUBLE_WIDTH: '1D2110',       // GS ! 16
  DOUBLE_SIZE: '1D2111',        // GS ! 17
  
  // Line spacing
  LINE_FEED: '0A',              // LF
  FEED_1_LINE: '1B6401',        // ESC d 1
  FEED_2_LINES: '1B6402',       // ESC d 2
  FEED_3_LINES: '1B6403',       // ESC d 3
  
  // Paper cutting — works on POS-58C and most 58mm thermal printers
  CUT_PARTIAL: '1D564230',      // GS V B 48 (partial cut, feed 48 dots — n byte required)
  CUT_FULL: '1D564230',         // GS V B 48 (full cut with feed — same as partial on 58mm)
  
  // Drawer kick
  DRAWER_KICK: '1B700019FA',    // ESC p 0 25 250
  
  // Barcode
  BARCODE_HEIGHT: '1D683C',     // GS h 60
  BARCODE_WIDTH: '1D7702',      // GS w 2
  BARCODE_HRI_BELOW: '1D4802',  // GS H 2
} as const;

/**
 * Convert string to hexadecimal ESC/POS commands
 */
function strToHex(str: string): string {
  return Buffer.from(str).toString('hex');
}

/**
 * Pad string to fit 48 characters (80mm @ 12cpi)
 * 80mm = ~48 characters with 12cpi font
 */
function padRight(str: string, length: number): string {
  return str.padEnd(length, ' ').substring(0, length);
}

function padLeft(str: string, length: number): string {
  return str.padStart(length, ' ').substring(0, length);
}

function center(str: string, width: number = 48): string {
  const padding = Math.max(0, width - str.length);
  const left = Math.floor(padding / 2);
  return ' '.repeat(left) + str.substring(0, width);
}

/**
 * Build ESC/POS command string
 */
function build(...parts: string[]): string {
  return parts.join('');
}

// ==================== KITCHEN TICKET ====================

export interface KitchenTicketItem {
  name: string;
  quantity: number;
  notes?: string;
  modifiers?: string[];
}

export interface KitchenTicketData {
  orderId: string;
  tableName: string;
  waiterName: string;
  items: KitchenTicketItem[];
  timestamp: Date;
  category: string;
}

/**
 * Generate kitchen ticket (no prices, just items)
 * 80mm format optimized for fast reading
 */
export function generateKitchenTicket(data: KitchenTicketData): string {
  const commands: string[] = [];
  
  // Initialize
  commands.push(COMMANDS.INITIALIZE);
  
  // Header - Large and bold
  commands.push(COMMANDS.ALIGN_CENTER);
  commands.push(COMMANDS.DOUBLE_SIZE);
  commands.push(strToHex('*** KITCHEN ***'));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(COMMANDS.NORMAL);
  commands.push(COMMANDS.BOLD_ON);
  commands.push(strToHex(`TABLE: ${data.tableName}`));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(COMMANDS.BOLD_OFF);
  commands.push(strToHex(`Order #${data.orderId.slice(-4)} • ${data.waiterName}`));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex(new Date(data.timestamp).toLocaleTimeString()));
  commands.push(COMMANDS.LINE_FEED);
  
  // Separator line
  commands.push(COMMANDS.ALIGN_LEFT);
  commands.push(strToHex('='.repeat(48)));
  commands.push(COMMANDS.LINE_FEED);
  
  // Items - Big and clear
  data.items.forEach((item, index) => {
    commands.push(COMMANDS.LINE_FEED);
    
    // Quantity and name - BOLD and large
    commands.push(COMMANDS.BOLD_ON);
    commands.push(COMMANDS.DOUBLE_HEIGHT);
    commands.push(strToHex(`${item.quantity}x ${item.name.toUpperCase()}`));
    commands.push(COMMANDS.NORMAL);
    commands.push(COMMANDS.BOLD_OFF);
    commands.push(COMMANDS.LINE_FEED);
    
    // Modifiers
    if (item.modifiers && item.modifiers.length > 0) {
      commands.push(strToHex(`   > ${item.modifiers.join(', ')}`));
      commands.push(COMMANDS.LINE_FEED);
    }
    
    // Special notes
    if (item.notes) {
      commands.push(COMMANDS.BOLD_ON);
      commands.push(strToHex(`   *** ${item.notes.toUpperCase()} ***`));
      commands.push(COMMANDS.BOLD_OFF);
      commands.push(COMMANDS.LINE_FEED);
    }
    
    // Separator between items
    if (index < data.items.length - 1) {
      commands.push(strToHex('-'.repeat(48)));
      commands.push(COMMANDS.LINE_FEED);
    }
  });
  
  // Footer
  commands.push(COMMANDS.LINE_FEED);
  commands.push(COMMANDS.ALIGN_CENTER);
  commands.push(strToHex('='.repeat(48)));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex(`${data.items.length} item(s)`));
  commands.push(COMMANDS.LINE_FEED);
  
  // Cut paper (GS V B already feeds before cutting)
  commands.push(COMMANDS.CUT_PARTIAL);
  
  return build(...commands);
}

// ==================== BAR TICKET ====================

export interface BarTicketData extends KitchenTicketData {
  priority?: 'NORMAL' | 'URGENT' | 'RUSH';
}

/**
 * Generate bar ticket (similar to kitchen but drink-focused)
 */
export function generateBarTicket(data: BarTicketData): string {
  const commands: string[] = [];
  
  // Initialize
  commands.push(COMMANDS.INITIALIZE);
  
  // Header
  commands.push(COMMANDS.ALIGN_CENTER);
  commands.push(COMMANDS.DOUBLE_SIZE);
  commands.push(strToHex('*** BAR ***'));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(COMMANDS.NORMAL);
  
  // Priority indicator
  if (data.priority && data.priority !== 'NORMAL') {
    commands.push(COMMANDS.BOLD_ON);
    commands.push(COMMANDS.DOUBLE_HEIGHT);
    commands.push(strToHex(`!!! ${data.priority} !!!`));
    commands.push(COMMANDS.NORMAL);
    commands.push(COMMANDS.BOLD_OFF);
    commands.push(COMMANDS.LINE_FEED);
  }
  
  commands.push(COMMANDS.BOLD_ON);
  commands.push(strToHex(`TABLE: ${data.tableName}`));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(COMMANDS.BOLD_OFF);
  commands.push(strToHex(`Order #${data.orderId.slice(-4)} • ${data.waiterName}`));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex(new Date(data.timestamp).toLocaleTimeString()));
  commands.push(COMMANDS.LINE_FEED);
  
  // Separator
  commands.push(COMMANDS.ALIGN_LEFT);
  commands.push(strToHex('='.repeat(48)));
  commands.push(COMMANDS.LINE_FEED);
  
  // Drinks - Extra large for visibility in dim bar
  data.items.forEach((item, index) => {
    commands.push(COMMANDS.LINE_FEED);
    
    // Drink name - EXTRA LARGE
    commands.push(COMMANDS.BOLD_ON);
    commands.push(COMMANDS.DOUBLE_SIZE);
    commands.push(strToHex(`${item.quantity}x ${item.name.toUpperCase()}`));
    commands.push(COMMANDS.NORMAL);
    commands.push(COMMANDS.BOLD_OFF);
    commands.push(COMMANDS.LINE_FEED);
    
    // Mixers/garnishes
    if (item.modifiers && item.modifiers.length > 0) {
      commands.push(COMMANDS.BOLD_ON);
      commands.push(strToHex(`   + ${item.modifiers.join(' + ')}`));
      commands.push(COMMANDS.BOLD_OFF);
      commands.push(COMMANDS.LINE_FEED);
    }
    
    if (item.notes) {
      commands.push(strToHex(`   * ${item.notes}`));
      commands.push(COMMANDS.LINE_FEED);
    }
    
    if (index < data.items.length - 1) {
      commands.push(strToHex('-'.repeat(48)));
      commands.push(COMMANDS.LINE_FEED);
    }
  });
  
  // Footer
  commands.push(COMMANDS.LINE_FEED);
  commands.push(COMMANDS.ALIGN_CENTER);
  commands.push(strToHex('='.repeat(48)));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex(`${data.items.length} drink(s)`));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(COMMANDS.CUT_PARTIAL);
  
  return build(...commands);
}

// ==================== CUSTOMER RECEIPT ====================

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ReceiptData {
  orderId: string;
  tableName: string;
  waiterName: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change: number;
  timestamp: Date;
  restaurantName: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  header?: string;
  footer?: string;
}

/**
 * Generate customer receipt with prices and totals
 * 80mm format
 */
export function generateReceipt(data: ReceiptData): string {
  const commands: string[] = [];
  const SYM = '$'; // Could be dynamic from settings
  
  // Initialize
  commands.push(COMMANDS.INITIALIZE);
  
  // Restaurant header
  commands.push(COMMANDS.ALIGN_CENTER);
  commands.push(COMMANDS.BOLD_ON);
  commands.push(COMMANDS.DOUBLE_HEIGHT);
  commands.push(strToHex(data.restaurantName.toUpperCase()));
  commands.push(COMMANDS.NORMAL);
  commands.push(COMMANDS.BOLD_OFF);
  commands.push(COMMANDS.LINE_FEED);
  
  if (data.restaurantAddress) {
    commands.push(strToHex(data.restaurantAddress));
    commands.push(COMMANDS.LINE_FEED);
  }
  if (data.restaurantPhone) {
    commands.push(strToHex(data.restaurantPhone));
    commands.push(COMMANDS.LINE_FEED);
  }

  if (data.header) {
    data.header.split('\n').filter(Boolean).forEach(line => {
      commands.push(strToHex(line));
      commands.push(COMMANDS.LINE_FEED);
    });
  }
  
  commands.push(strToHex(new Date(data.timestamp).toLocaleString()));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex('='.repeat(48)));
  commands.push(COMMANDS.LINE_FEED);
  
  // Order info
  commands.push(COMMANDS.ALIGN_LEFT);
  commands.push(strToHex(`Table: ${data.tableName}`));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex(`Order #: ${data.orderId.slice(-6)}`));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex(`Server: ${data.waiterName}`));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex('-'.repeat(48)));
  commands.push(COMMANDS.LINE_FEED);
  
  // Items with prices
  data.items.forEach(item => {
    const qtyStr = `${item.quantity}x`;
    const nameStr = item.name.substring(0, 32);
    const totalStr = `${SYM}${item.total.toFixed(2)}`;
    
    // Line 1: Qty + Name (left) + Total (right)
    const leftPart = `${qtyStr} ${nameStr}`;
    const spaces = 48 - leftPart.length - totalStr.length;
    commands.push(strToHex(leftPart + ' '.repeat(Math.max(0, spaces)) + totalStr));
    commands.push(COMMANDS.LINE_FEED);
    
    // Line 2: Unit price (if qty > 1)
    if (item.quantity > 1) {
      const unitStr = `   @ ${SYM}${item.price.toFixed(2)}`;
      commands.push(strToHex(unitStr));
      commands.push(COMMANDS.LINE_FEED);
    }
  });
  
  // Totals
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex('-'.repeat(48)));
  commands.push(COMMANDS.LINE_FEED);
  
  // Subtotal
  const subtotalLabel = 'Subtotal:';
  const subtotalValue = `${SYM}${data.subtotal.toFixed(2)}`;
  commands.push(strToHex(
    subtotalLabel + ' '.repeat(48 - subtotalLabel.length - subtotalValue.length) + subtotalValue
  ));
  commands.push(COMMANDS.LINE_FEED);
  
  // Tax
  if (data.tax > 0) {
    const taxLabel = 'Tax:';
    const taxValue = `${SYM}${data.tax.toFixed(2)}`;
    commands.push(strToHex(
      taxLabel + ' '.repeat(48 - taxLabel.length - taxValue.length) + taxValue
    ));
    commands.push(COMMANDS.LINE_FEED);
  }
  
  // Total - BOLD
  commands.push(COMMANDS.LINE_FEED);
  commands.push(COMMANDS.BOLD_ON);
  const totalLabel = 'TOTAL:';
  const totalValue = `${SYM}${data.total.toFixed(2)}`;
  commands.push(strToHex(
    totalLabel + ' '.repeat(48 - totalLabel.length - totalValue.length) + totalValue
  ));
  commands.push(COMMANDS.BOLD_OFF);
  commands.push(COMMANDS.LINE_FEED);
  
  // Payment info
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex('-'.repeat(48)));
  commands.push(COMMANDS.LINE_FEED);

  // Footer message
  commands.push(COMMANDS.ALIGN_CENTER);
  if (data.footer) {
    data.footer.split('\n').filter(Boolean).forEach(line => {
      commands.push(strToHex(line));
      commands.push(COMMANDS.LINE_FEED);
    });
  } else {
    commands.push(strToHex('Thank you for dining with us!'));
    commands.push(COMMANDS.LINE_FEED);
  }

  // Cut paper after all content is printed
  commands.push(COMMANDS.CUT_FULL);
  
  return build(...commands);
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Test print pattern - helps verify printer connection
 */
export function generateTestPrint(destination: string): string {
  const commands: string[] = [];
  
  commands.push(COMMANDS.INITIALIZE);
  commands.push(COMMANDS.ALIGN_CENTER);
  commands.push(COMMANDS.DOUBLE_SIZE);
  commands.push(strToHex('*** TEST PRINT ***'));
  commands.push(COMMANDS.NORMAL);
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex(`Destination: ${destination}`));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex('Printer is working correctly!'));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex(new Date().toLocaleString()));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(COMMANDS.CUT_PARTIAL);
  
  return build(...commands);
}

/**
 * Generate condensed report for shift/period
 */
export function generateShiftReport(data: {
  shiftType: string;
  openedAt: Date;
  closedAt?: Date;
  totalSales: number;
  orderCount: number;
  byCategory: { name: string; qty: number; total: number }[];
}): string {
  const commands: string[] = [];
  const SYM = '$';
  
  commands.push(COMMANDS.INITIALIZE);
  commands.push(COMMANDS.ALIGN_CENTER);
  commands.push(COMMANDS.BOLD_ON);
  commands.push(strToHex('SHIFT REPORT'));
  commands.push(COMMANDS.BOLD_OFF);
  commands.push(COMMANDS.LINE_FEED);
  commands.push(COMMANDS.NORMAL);
  commands.push(strToHex(`${data.shiftType} Shift`));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex(new Date(data.openedAt).toLocaleString()));
  if (data.closedAt) {
    commands.push(COMMANDS.LINE_FEED);
    commands.push(strToHex(`to ${new Date(data.closedAt).toLocaleString()}`));
  }
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex('='.repeat(48)));
  commands.push(COMMANDS.LINE_FEED);
  
  commands.push(COMMANDS.ALIGN_LEFT);
  
  // Summary
  commands.push(strToHex(`Orders: ${data.orderCount}`));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex(`Total Sales: ${SYM}${data.totalSales.toFixed(2)}`));
  commands.push(COMMANDS.LINE_FEED);
  commands.push(strToHex('-'.repeat(48)));
  commands.push(COMMANDS.LINE_FEED);
  
  // By category
  data.byCategory.forEach(cat => {
    const line = `${padRight(cat.name, 32)} ${padLeft(String(cat.qty), 4)} ${padLeft(SYM + cat.total.toFixed(2), 10)}`;
    commands.push(strToHex(line));
    commands.push(COMMANDS.LINE_FEED);
  });
  
  commands.push(COMMANDS.LINE_FEED);
  commands.push(COMMANDS.CUT_FULL);
  
  return build(...commands);
}

// Export command constants for custom usage
export { COMMANDS };
