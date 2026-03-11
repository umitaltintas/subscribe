import Fuse from "fuse.js";
import { CONFIG } from "./config";
import type { TranscriptRecord, SearchableItem, SearchResult } from "./types";

class FuseSearchManager {
  private fuse: Fuse<SearchableItem> | null = null;
  private indexedData: SearchableItem[] = [];
  private isDirty = true;
  public lastIndexTime = 0;
  private indexPromise: Promise<Fuse<SearchableItem> | null> | null = null;

  invalidate(): void {
    this.isDirty = true;
    this.fuse = null;
  }

  private prepareSearchableItem(item: TranscriptRecord): SearchableItem {
    return {
      id: item.id,
      title: item.title || "",
      channel: item.channel || "",
      tags: (item.tags || []).join(" "),
      searchableTranscript: (item.transcript || "").slice(
        0,
        CONFIG.SEARCH_PREVIEW_LENGTH,
      ),
      _original: item,
    };
  }

  private fallbackSearch(
    query: string,
    items: TranscriptRecord[],
    limit: number,
  ): TranscriptRecord[] {
    const q = query.toLowerCase().trim();
    return items
      .filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.channel?.toLowerCase().includes(q) ||
          item.transcript?.toLowerCase().includes(q) ||
          item.tags?.some((t) => t.toLowerCase().includes(q)),
      )
      .slice(0, limit);
  }

  async buildIndex(
    items: TranscriptRecord[],
  ): Promise<Fuse<SearchableItem> | null> {
    if (this.indexPromise) return this.indexPromise;
    if (
      !this.isDirty &&
      this.fuse &&
      this.indexedData.length === items.length
    ) {
      return this.fuse;
    }

    this.indexPromise = new Promise((resolve) => {
      const buildFn = () => {
        const startTime = performance.now();
        this.indexedData = items.map((item) =>
          this.prepareSearchableItem(item),
        );
        this.fuse = new Fuse(this.indexedData, CONFIG.FUSE_OPTIONS);
        this.isDirty = false;
        this.lastIndexTime = performance.now() - startTime;
        this.indexPromise = null;
        console.log(
          `[YTC] Fuse index: ${items.length} items in ${this.lastIndexTime.toFixed(1)}ms`,
        );
        resolve(this.fuse);
      };

      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(buildFn, { timeout: 500 });
      } else {
        setTimeout(buildFn, 0);
      }
    });

    return this.indexPromise;
  }

  async search(
    query: string,
    items: TranscriptRecord[],
    limit = CONFIG.MAX_SEARCH_RESULTS,
  ): Promise<SearchResult[]> {
    if (!query || !query.trim()) {
      return items.slice(0, limit);
    }

    const fuse = await this.buildIndex(items);
    if (!fuse) return this.fallbackSearch(query, items, limit);

    const results = fuse.search(query, { limit });
    return results.map((r) => ({
      ...r.item._original,
      _score: r.score,
      _matches: r.matches as SearchResult["_matches"],
    }));
  }
}

export const searchManager = new FuseSearchManager();
