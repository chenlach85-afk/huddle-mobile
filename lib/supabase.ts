import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

const CHUNK_SIZE = 1800;

class LargeSecureStore {
  private async _store(key: string, value: string) {
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${key}__count`, String(chunks.length));
    await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(`${key}__${i}`, c)));
  }

  private async _load(key: string): Promise<string | null> {
    const countStr = await SecureStore.getItemAsync(`${key}__count`);
    if (!countStr) return null;
    const count = parseInt(countStr, 10);
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}__${i}`))
    );
    if (chunks.some((c) => c === null)) return null;
    return chunks.join("");
  }

  private async _remove(key: string) {
    const countStr = await SecureStore.getItemAsync(`${key}__count`);
    if (!countStr) return;
    const count = parseInt(countStr, 10);
    await Promise.all([
      SecureStore.deleteItemAsync(`${key}__count`),
      ...Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}__${i}`)),
    ]);
  }

  async getItem(key: string): Promise<string | null> {
    return this._load(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    return this._store(key, value);
  }

  async removeItem(key: string): Promise<void> {
    return this._remove(key);
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
