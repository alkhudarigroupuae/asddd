/**
 * Convert Tron hex address (41... or 0x...) to base58 (T...) for TronScan URLs.
 * TronScan returns 400 "Address not found" for hex; it expects base58.
 */

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length % 2) throw new Error("Invalid hex length");
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function sha256(data: ArrayBuffer): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", data);
}

/** Returns base58 (T...) address or null if conversion fails. */
export async function tronHexToBase58(hexAddress: string): Promise<string | null> {
  try {
    let hex = hexAddress.trim().toLowerCase();
    if (hex.startsWith("0x")) hex = "41" + hex.slice(2);
    if (!hex.startsWith("41") || hex.length !== 42) return null;

    const addressBytes = hexToBytes(hex); // 21 bytes
    const hash1 = await sha256(addressBytes.buffer as ArrayBuffer);
    const hash2 = await sha256(hash1);
    const checksum = new Uint8Array(hash2, 0, 4);
    const withChecksum = new Uint8Array(25);
    withChecksum.set(addressBytes, 0);
    withChecksum.set(checksum, 21);

    // Count leading zero bytes (encoded as '1' in base58)
    let leadingZeros = 0;
    while (leadingZeros < 25 && withChecksum[leadingZeros] === 0) leadingZeros++;

    const hexStr = Array.from(withChecksum).map((b) => b.toString(16).padStart(2, "0")).join("");
    let num = BigInt("0x" + hexStr);
    const digits: number[] = [];
    const fiftyEight = BigInt(58);
    while (num > BigInt(0)) {
      digits.push(Number(num % fiftyEight));
      num = num / fiftyEight;
    }
    const encoded = digits.reverse().map((d) => BASE58_ALPHABET[d]).join("");
    return "1".repeat(leadingZeros) + encoded;
  } catch {
    return null;
  }
}
