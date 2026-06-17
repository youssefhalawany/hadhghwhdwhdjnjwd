export interface DesignElement {
  id: string;
  type: "text" | "barcode" | "qrcode" | "logo" | "line";
  value: string;
  x: number; // grid positioning in pixels
  y: number;
  width: number;
  height: number;
  fontSize?: number; // e.g. 12, 14, 18, 24
  fontWeight?: "normal" | "bold";
  barcodeType?: "CODE128" | "EAN13" | "EAN8" | "UPC" | "CODE39";
  align?: "left" | "center" | "right";
}

export interface PrintJobOptions {
  widthMm: 58 | 80 | 100;
  mode: "receipt" | "label";
  printerType: "escpos" | "bplz" | "bple";
}

export const generateThermalCommands = (elements: DesignElement[], options: PrintJobOptions): string => {
  const { widthMm, mode, printerType } = options;

  if (printerType === "bplz") {
    // Compile to BPL-Z / ZPL commands
    let commands = "^XA\n"; // Start Label
    
    // Set DPI and print width (e.g. 8 dots/mm for 203 DPI)
    // 80mm ~ 640 dots, 100mm ~ 800 dots
    const dotsPerMm = 8;
    const widthDots = widthMm * dotsPerMm;
    commands += `^PW${widthDots}\n`;
    
    elements.forEach(el => {
      // Map elements to BPL-Z/ZPL coordinates
      const posX = Math.round(el.x * 2); // scaling factor
      const posY = Math.round(el.y * 2);

      switch (el.type) {
        case "text":
          const fontHeight = el.fontSize ? Math.round(el.fontSize * 1.5) : 30;
          commands += `^FO${posX},${posY}^A0N,${fontHeight},${fontHeight}^FD${el.value}^FS\n`;
          break;

        case "barcode":
          // ^BC = Code 128, ^B3 = Code 39, ^BE = EAN13
          let barcodeCmd = "BC";
          if (el.barcodeType === "EAN13") barcodeCmd = "BE";
          if (el.barcodeType === "EAN8") barcodeCmd = "B8";
          if (el.barcodeType === "CODE39") barcodeCmd = "B3";
          
          commands += `^FO${posX},${posY}^BY2,3,${el.height}^${barcodeCmd}N,${el.height},Y,N,N^FD${el.value}^FS\n`;
          break;

        case "qrcode":
          commands += `^FO${posX},${posY}^BQN,2,6^FDQA,${el.value}^FS\n`;
          break;

        case "line":
          commands += `^FO${posX},${posY}^GB${Math.round(el.width * 2)},4,4^FS\n`;
          break;

        case "logo":
          commands += `^FO${posX},${posY}^A0N,40,40^FD[CIRCLE K LOGO]^FS\n`;
          break;
      }
    });

    commands += "^XZ"; // End Label
    return commands;
  } else if (printerType === "escpos") {
    // Compile to readable representation of ESC/POS commands
    let commands = "[ESC @] // Initialize Printer\n";
    
    // Receipt header
    if (mode === "receipt") {
      commands += "[ESC a 1] // Center Align\n";
      commands += "[GS ! 17] // Double Size text\n";
      commands += "CIRCLE K CONVENIENCE\n";
      commands += "[GS ! 0] // Normal Text\n";
      commands += "--------------------------------\n";
    }

    elements.sort((a,b) => a.y - b.y).forEach(el => {
      // Alignments
      const alignCode = el.align === "center" ? 1 : el.align === "right" ? 2 : 0;
      commands += `[ESC a ${alignCode}] // Align\n`;

      if (el.fontWeight === "bold") {
        commands += "[ESC E 1] // Bold On\n";
      }

      switch (el.type) {
        case "text":
          commands += `${el.value}\n`;
          break;
        case "line":
          commands += `${widthMm === 58 ? "------------------" : "--------------------------------"}\n`;
          break;
        case "barcode":
          commands += `[GS k 67 ${el.value.length}] ${el.value} // Barcode ${el.barcodeType}\n`;
          break;
        case "qrcode":
          commands += `[GS ( k 3 0 49 67 48] [GS ( k 3 0 49 80 48] ${el.value} // QR Code\n`;
          break;
        case "logo":
          commands += "[IMAGE: CIRCLE K RED LOGO]\n";
          break;
      }

      if (el.fontWeight === "bold") {
        commands += "[ESC E 0] // Bold Off\n";
      }
    });

    if (mode === "receipt") {
      commands += "\n\nThank you for shopping!\n";
      commands += "[GS V 66 0] // Cut Paper\n";
    }

    return commands;
  }

  return "// Unsupported printer format config";
};

// Web Serial API Print Trigger Helper
export const printToWebSerial = async (rawCommands: string): Promise<boolean> => {
  if (typeof window === "undefined" || !("serial" in navigator)) {
    throw new Error("Web Serial API is not supported in this browser. Use Chrome/Edge.");
  }

  try {
    // Request a port and open it
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 9600 });

    const encoder = new TextEncoder();
    const writer = port.writable.getWriter();
    
    // Convert commands and write to serial port
    const data = encoder.encode(rawCommands);
    await writer.write(data);
    
    // Release lock and close port
    writer.releaseLock();
    await port.close();
    return true;
  } catch (error) {
    console.error("Serial Print Error:", error);
    return false;
  }
};

// Web Bluetooth Printing Trigger Helper
export const printToWebBluetooth = async (rawCommands: string): Promise<boolean> => {
  if (typeof window === "undefined" || !("bluetooth" in navigator)) {
    throw new Error("Web Bluetooth API is not supported in this browser.");
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ services: ["000018f0-0000-1000-8000-00805f9b34fb"] }] // Standard Printer uuid
    });
    
    const server = await device.gatt?.connect();
    if (!server) return false;

    // Retrieve active print channel characteristic
    const service = await server.getPrimaryService("000018f0-0000-1000-8000-00805f9b34fb");
    const characteristics = await service.getCharacteristics();
    const writeCharacteristic = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);

    if (writeCharacteristic) {
      const encoder = new TextEncoder();
      const chunks = chunkString(rawCommands, 512); // Send in chunks to prevent Bluetooth buffers overflow
      for (const chunk of chunks) {
        await writeCharacteristic.writeValue(encoder.encode(chunk));
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error("Bluetooth Print Error:", error);
    return false;
  }
};

function chunkString(str: string, size: number): string[] {
  const numChunks = Math.ceil(str.length / size);
  const chunks = new Array(numChunks);
  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size);
  }
  return chunks;
}
