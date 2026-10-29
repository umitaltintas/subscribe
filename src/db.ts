import { openDB, type IDBPDatabase } from "idb";
import { CONFIG } from "./config";
import { searchManager } from "./search";
import type {
  TranscriptRecord,
  SearchResult,
  SearchFilters,
  DBStats,
} from "./types";

type DB = IDBPDatabase<unknown>;

export class TranscriptDB {
  private db: DB | null = null;
  public ready: Promise<DB>;
  private cache: TranscriptRecord[] | null = null;
  private cacheTime = 0;
  private readonly CACHE_TTL = 5000;

  constructor() {
    this.ready = this.init();
  }

  private async init(): Promise<DB> {
    this.db = await openDB(CONFIG.DB_NAME, CONFIG.DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(CONFIG.STORE_NAME)) {
          const store = db.createObjectStore(CONFIG.STORE_NAME, {
            keyPath: "id",
          });
          store.createIndex("date", "date", { unique: false });
          store.createIndex("channel", "channel", { unique: false });
          store.createIndex("favorite", "favorite", { unique: false });
          store.createIndex("tags", "tags", {
            unique: false,
            multiEntry: true,
          });
          store.createIndex("title", "title", { unique: false });
        }
      },
    });
    return this.db;
  }

  invalidateCache(): void {
    this.cache = null;
    this.cacheTime = 0;
    searchManager.invalidate();
  }

  async add(record: Partial<TranscriptRecord>): Promise<TranscriptRecord> {
    await this.ready;
    this.invalidateCache();

    const data = {
      ...record,
      date: record.date || new Date().toISOString(),
      favorite: record.favorite || false,
      tags: record.tags || [],
      copyCount: record.copyCount || 1,
    } as TranscriptRecord;

    await this.db!.put(CONFIG.STORE_NAME, data);
    this.invalidateCache();
    return data;
  }

  async get(id: string): Promise<TranscriptRecord | undefined> {
    await this.ready;
    return this.db!.get(CONFIG.STORE_NAME, id);
  }

  /**
   * Merges `updates` into the stored record inside one readwrite transaction,
   * so concurrent writers (a translation finishing while a summary is saved)
   * cannot overwrite each other.
   */
  async update(
    id: string,
    updates: Partial<TranscriptRecord> | ((current: TranscriptRecord) => Partial<TranscriptRecord>),
  ): Promise<TranscriptRecord | null> {
    await this.ready;
    const tx = this.db!.transaction(CONFIG.STORE_NAME, "readwrite");
    const existing = (await tx.store.get(id)) as TranscriptRecord | undefined;
    if (!existing) {
      await tx.done;
      return null;
    }
    const patch = typeof updates === "function" ? updates(existing) : updates;
    const next = { ...existing, ...patch, id };
    await tx.store.put(next);
    await tx.done;
    this.invalidateCache();
    return next;
  }

  /**
   * Inserts or merges a record in one transaction. Fields already stored
   * (translations, summaries, favorite, tags…) are kept unless overridden.
   */
  async upsert(record: Partial<TranscriptRecord> & { id: string }): Promise<TranscriptRecord> {
    await this.ready;
    const tx = this.db!.transaction(CONFIG.STORE_NAME, "readwrite");
    const existing = (await tx.store.get(record.id)) as TranscriptRecord | undefined;
    const defined = Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined));
    const next = {
      date: new Date().toISOString(),
      favorite: false,
      tags: [],
      copyCount: 0,
      ...existing,
      ...defined,
    } as TranscriptRecord;
    await tx.store.put(next);
    await tx.done;
    this.invalidateCache();
    return next;
  }

  async delete(id: string): Promise<boolean> {
    await this.ready;
    this.invalidateCache();
    await this.db!.delete(CONFIG.STORE_NAME, id);
    return true;
  }

  async getAll(options: { limit?: number } = {}): Promise<TranscriptRecord[]> {
    const now = Date.now();
    if (this.cache && now - this.cacheTime < this.CACHE_TTL) {
      return this.cache;
    }

    await this.ready;
    const limit = options.limit || 10_000;
    const results: TranscriptRecord[] = [];

    let cursor = await this.db!
      .transaction(CONFIG.STORE_NAME)
      .store.index("date")
      .openCursor(null, "prev");

    while (cursor && results.length < limit) {
      results.push(cursor.value as TranscriptRecord);
      cursor = await cursor.continue();
    }

    this.cache = results;
    this.cacheTime = now;
    return results;
  }

  async getFavorites(): Promise<TranscriptRecord[]> {
    const all = await this.getAll();
    return all.filter((x) => x.favorite);
  }

  async search(query: string): Promise<SearchResult[]> {
    const all = await this.getAll();

    if (!query || !query.trim()) {
      return all.slice(0, CONFIG.MAX_SEARCH_RESULTS);
    }

    return searchManager.search(query, all, CONFIG.MAX_SEARCH_RESULTS);
  }

  async searchWithFilters(
    query: string,
    filters: SearchFilters = {},
  ): Promise<SearchResult[]> {
    let items = await this.getAll();

    if (filters.tag) {
      items = items.filter((x) => x.tags?.includes(filters.tag!));
    }
    if (filters.favoritesOnly) {
      items = items.filter((x) => x.favorite);
    }
    if (filters.channel) {
      items = items.filter((x) => x.channel === filters.channel);
    }

    if (!query || !query.trim()) {
      return items.slice(0, CONFIG.MAX_SEARCH_RESULTS);
    }

    return searchManager.search(query, items, CONFIG.MAX_SEARCH_RESULTS);
  }

  async getAllTags(): Promise<string[]> {
    const all = await this.getAll();
    const tags = new Set<string>();
    all.forEach((item) => item.tags?.forEach((t) => tags.add(t)));
    return [...tags].sort();
  }

  async getAllChannels(): Promise<string[]> {
    const all = await this.getAll();
    const channels = new Set<string>();
    all.forEach((item) => {
      if (item.channel) channels.add(item.channel);
    });
    return [...channels].sort();
  }

  async getStats(): Promise<DBStats> {
    const all = await this.getAll();
    const favorites = all.filter((x) => x.favorite).length;
    const totalTokens = all.reduce((s, x) => s + (x.tokens || 0), 0);
    const totalWords = all.reduce((s, x) => s + (x.words || 0), 0);
    const channels = [
      ...new Set(all.map((x) => x.channel).filter(Boolean)),
    ];
    const tags = await this.getAllTags();

    const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeek = all.filter(
      (x) => new Date(x.date).getTime() > week,
    ).length;

    const topCopied = [...all]
      .sort((a, b) => (b.copyCount || 1) - (a.copyCount || 1))
      .slice(0, 5);

    return {
      total: all.length,
      favorites,
      totalTokens,
      totalWords,
      channelCount: channels.length,
      tagCount: tags.length,
      thisWeek,
      topCopied,
      channels: channels.slice(0, 10),
      indexTime: searchManager.lastIndexTime,
    };
  }

  async saveTranslation(
    id: string,
    langCode: string,
    translatedText: string,
  ): Promise<void> {
    await this.ready;
    const tx = this.db!.transaction(CONFIG.STORE_NAME, "readwrite");
    const record = (await tx.store.get(id)) as TranscriptRecord | undefined;

    if (!record) {
      throw new Error(`Record not found: ${id}`);
    }

    record.translations = record.translations || {};
    record.translations[langCode] = translatedText;
    await tx.store.put(record);
    await tx.done;
    this.invalidateCache();
  }

  async deleteTranslation(id: string, langCode: string): Promise<void> {
    await this.update(id, (current) => {
      const translations = { ...(current.translations ?? {}) };
      delete translations[langCode];
      return { translations };
    });
  }

  async clear(): Promise<boolean> {
    await this.ready;
    this.invalidateCache();
    await this.db!.clear(CONFIG.STORE_NAME);
    return true;
  }

  async export(): Promise<string> {
    await this.ready;
    // Read the store directly: getAll() is capped and cached.
    const all = await this.db!.getAll(CONFIG.STORE_NAME);
    return JSON.stringify(all, null, 2);
  }

  async import(jsonData: string): Promise<number> {
    let data: unknown;
    try {
      data = JSON.parse(jsonData);
    } catch {
      throw new Error("Dosya geçerli bir JSON değil");
    }
    if (!Array.isArray(data)) throw new Error("Beklenen format: kayıt dizisi");
    const valid = data.filter(
      (x): x is TranscriptRecord =>
        !!x && typeof x === "object" && typeof x.id === "string" && typeof x.transcript === "string",
    );
    if (!valid.length) throw new Error("Dosyada geçerli kayıt bulunamadı");
    data = valid;
    await this.ready;
    this.invalidateCache();

    const tx = this.db!.transaction(CONFIG.STORE_NAME, "readwrite");
    const defaults: Partial<TranscriptRecord> = { tags: [], favorite: false, copyCount: 1, date: new Date().toISOString() };
    for (const item of valid) {
      await tx.store.put({ ...defaults, ...item });
    }
    await tx.done;

    return valid.length;
  }
}

export const db = new TranscriptDB();
