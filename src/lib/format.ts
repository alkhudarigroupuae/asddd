/** Format wei (string) to ether for display (e.g. "0.123456"). */
export function formatWeiToEther(wei: string): string {
  try {
    const w = BigInt(wei);
    const div = BigInt(1e18);
    const whole = w / div;
    const frac = w % div;
    const fracStr = frac.toString().padStart(18, "0").slice(0, 6).replace(/0+$/, "") || "0";
    return fracStr ? `${whole}.${fracStr}` : `${whole}`;
  } catch {
    return "—";
  }
}
