/**
 * Universal Vision & Receipt Image Sanitizer
 * Prepares image payloads for Google Generative AI Vision models,
 * guaranteeing strict RFC 4648 Base64 compliance matching Google's protobuf validator:
 *   ^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$
 * 
 * Prevents:
 * 1. "Invalid value at inline_data.data (TYPE_BYTES): The string did not match the expected pattern"
 * 2. WebKit / Safari DOMException 12: "The string did not match the expected pattern"
 */

export interface SanitizedVisionImage {
  base64Data: string;
  mimeType: string;
  byteLength: number;
}

export async function prepareVisionImage(input: string): Promise<SanitizedVisionImage> {
  if (!input || typeof input !== "string") {
    throw new Error("No image data provided");
  }

  let rawStr = input.trim();
  let mimeType = "image/jpeg";

  // Case 1: Remote HTTP/HTTPS URL
  if (rawStr.startsWith("http://") || rawStr.startsWith("https://")) {
    try {
      const res = await fetch(rawStr);
      if (!res.ok) {
        throw new Error(`Failed to download image from URL (${res.status} ${res.statusText})`);
      }
      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      if (buf.length < 16) {
        throw new Error("Downloaded image file is empty or corrupted");
      }
      const cType = res.headers.get("content-type");
      if (cType) {
        mimeType = cType.split(";")[0].trim().toLowerCase();
      }
      return {
        base64Data: buf.toString("base64"),
        mimeType: mimeType || "image/jpeg",
        byteLength: buf.length,
      };
    } catch (urlErr: any) {
      throw new Error(`Unable to fetch receipt image URL: ${urlErr.message}`);
    }
  }

  // Case 2: URL-encoded strings
  if (rawStr.startsWith("data%3A") || rawStr.includes("%2C") || rawStr.includes("%2F") || rawStr.includes("%2B")) {
    try {
      rawStr = decodeURIComponent(rawStr);
    } catch {
      // ignore decode error, proceed
    }
  }

  // Case 3: Data URL with header (data:image/...;base64,....)
  if (rawStr.includes(",")) {
    const commaIdx = rawStr.indexOf(",");
    const metadata = rawStr.substring(0, commaIdx);
    rawStr = rawStr.substring(commaIdx + 1);

    const match = metadata.match(/data:([^;]+)/i);
    if (match && match[1]) {
      mimeType = match[1].trim().toLowerCase();
    }
  }

  // Strip all whitespaces, line breaks, carriage returns
  rawStr = rawStr.replace(/\s+/g, "");

  // Convert URL-safe base64 (- and _) to standard base64 (+ and /)
  rawStr = rawStr.replace(/-/g, "+").replace(/_/g, "/");

  // Filter out any characters not part of base64 alphabet
  rawStr = rawStr.replace(/[^A-Za-z0-9+/=]/g, "");

  // Re-encode through Node Buffer to guarantee exact multiple-of-4 length and strict RFC 4648 padding
  const buf = Buffer.from(rawStr, "base64");
  if (buf.length < 16) {
    throw new Error("Receipt image payload is empty, corrupted, or too small to process");
  }

  const base64Data = buf.toString("base64");

  // Validate against Google Generative AI protobuf regex
  const PROTOBUF_BASE64_REGEX = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  if (!PROTOBUF_BASE64_REGEX.test(base64Data)) {
    throw new Error("Image base64 encoding does not conform to standard byte pattern");
  }

  return {
    base64Data,
    mimeType: mimeType || "image/jpeg",
    byteLength: buf.length,
  };
}

/**
 * Standardizes AI extraction error messages so users never see raw internal protobuf
 * strings or cryptic WebKit exceptions like "The string did not match the expected pattern".
 */
export function formatVisionApiError(err: any): string {
  const msg = err?.message || String(err || "");

  if (msg.includes("503") || msg.includes("high demand") || msg.includes("Service Unavailable")) {
    return "AI model is temporarily experiencing high traffic. Please retry in a few seconds.";
  }
  if (msg.includes("429") || msg.includes("quota") || msg.includes("rate limit")) {
    return "AI scanning rate limit reached. Please wait a moment and try again.";
  }
  if (msg.includes("expected pattern") || msg.includes("TYPE_BYTES") || msg.includes("Base64 decoding failed")) {
    return "Image format or resolution was not readable. Please re-take a clear photo or screenshot.";
  }
  if (msg.includes("GEMINI_API_KEY") || msg.includes("API key")) {
    return "Server AI service key is missing or misconfigured.";
  }

  return msg.replace(/\[GoogleGenerativeAI Error\]:.*?(?:\[\d+[^\]]*\])?/g, "").trim() || "Failed to scan receipt image";
}
