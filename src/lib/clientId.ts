import * as SecureStore from "expo-secure-store";

const CLIENT_ID_KEY = "bawn.client_id";

function randomHex(bytes: number): string {
  const alphabet = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < bytes; i += 1) {
    out += alphabet[Math.floor(Math.random() * 16)];
    out += alphabet[Math.floor(Math.random() * 16)];
  }
  return out;
}

function makeUuidV4Like(): string {
  const a = randomHex(4);
  const b = randomHex(2);
  const c = `4${randomHex(2).slice(1)}`;
  const d = `${(8 + Math.floor(Math.random() * 4)).toString(16)}${randomHex(2).slice(1)}`;
  const e = randomHex(6);
  return `${a}-${b}-${c}-${d}-${e}`;
}

export async function getOrCreateClientId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(CLIENT_ID_KEY);
  if (existing) return existing;

  const next = makeUuidV4Like();
  await SecureStore.setItemAsync(CLIENT_ID_KEY, next);
  return next;
}

