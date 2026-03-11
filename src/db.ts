import { openDB, type IDBPDatabase } from "idb";
import { CONFIG } from "./config";
import { searchManager } from "./search";
import type {
  TranscriptRecord,
  SearchResult,
  SearchFilters,
  DBStats,
  AISettings,
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
    return data;
  }

  async get(id: string): Promise<TranscriptRecord | undefined> {
    await this.ready;
    return this.db!.get(CONFIG.STORE_NAME, id);
  }

  async update(
    id: string,
    updates: Partial<TranscriptRecord>,
  ): Promise<TranscriptRecord | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    return this.add({ ...existing, ...updates });
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
    const limit = options.limit || 500;
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

  getAISettings(): AISettings | null {
    const raw = localStorage.getItem("ytc-ai-settings");
    if (!raw) return null;
    return JSON.parse(raw) as AISettings;
  }

  saveAISettings(settings: AISettings): void {
    localStorage.setItem("ytc-ai-settings", JSON.stringify(settings));
  }

  async clear(): Promise<boolean> {
    await this.ready;
    this.invalidateCache();
    await this.db!.clear(CONFIG.STORE_NAME);
    return true;
  }

  async export(): Promise<string> {
    const all = await this.getAll();
    return JSON.stringify(all, null, 2);
  }

  async import(jsonData: string): Promise<number> {
    const data = JSON.parse(jsonData) as TranscriptRecord[];
    await this.ready;
    this.invalidateCache();

    const tx = this.db!.transaction(CONFIG.STORE_NAME, "readwrite");
    for (const item of data) {
      await tx.store.put(item);
    }
    await tx.done;

    return data.length;
  }
}

export const db = new TranscriptDB();
