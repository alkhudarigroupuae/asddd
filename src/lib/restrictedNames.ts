/**
 * Token name/symbol restrictions. Currently none — you can use any name and symbol.
 */

const RESTRICTED_SYMBOLS = new Set<string>([]);
const RESTRICTED_NAMES = new Set<string>([]);

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isRestrictedSymbol(symbol: string): boolean {
  return RESTRICTED_SYMBOLS.has(symbol.trim().toUpperCase());
}

export function isRestrictedName(name: string): boolean {
  const n = normalize(name);
  if (RESTRICTED_NAMES.has(n)) return true;
  for (const r of Array.from(RESTRICTED_NAMES)) {
    if (n === r || n.startsWith(r + " ") || n.endsWith(" " + r) || n.includes(" " + r + " "))
      return true;
  }
  return false;
}

export function getRestrictedReason(symbol: string, name: string): string | null {
  if (isRestrictedSymbol(symbol))
    return `Symbol "${symbol}" is reserved.`;
  if (isRestrictedName(name))
    return `Token name is reserved.`;
  return null;
}
