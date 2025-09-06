export function decodeJwtPayload<T = any>(jwt: string): T {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT");

  // base64url → base64
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length + 3) % 4);

  // atob returns a binary string; convert to proper UTF-8
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);

  return JSON.parse(json);
}
