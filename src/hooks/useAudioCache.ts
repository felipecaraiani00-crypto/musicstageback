import { useCallback, useEffect, useState } from 'react';

const DB_NAME = 'stageback-audio-cache';
const DB_VERSION = 1;
const TRACKS_STORE = 'audio-tracks';
const META_STORE = 'track-metadata';

interface TrackMetadata {
  fileUrl: string;
  songId: string;
  trackName: string;
  cachedAt: number;
}

class AudioCacheManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Store for audio blobs
        if (!db.objectStoreNames.contains(TRACKS_STORE)) {
          db.createObjectStore(TRACKS_STORE);
        }
        
        // Store for metadata
        if (!db.objectStoreNames.contains(META_STORE)) {
          const metaStore = db.createObjectStore(META_STORE, { keyPath: 'fileUrl' });
          metaStore.createIndex('songId', 'songId', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  async getCachedTrack(fileUrl: string): Promise<Blob | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(TRACKS_STORE, 'readonly');
      const store = transaction.objectStore(TRACKS_STORE);
      const request = store.get(fileUrl);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => {
        console.error('Error getting cached track:', request.error);
        resolve(null);
      };
    });
  }

  async cacheTrack(fileUrl: string, blob: Blob, songId: string, trackName: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TRACKS_STORE, META_STORE], 'readwrite');
      
      // Store the blob
      const tracksStore = transaction.objectStore(TRACKS_STORE);
      tracksStore.put(blob, fileUrl);

      // Store metadata
      const metaStore = transaction.objectStore(META_STORE);
      const metadata: TrackMetadata = {
        fileUrl,
        songId,
        trackName,
        cachedAt: Date.now(),
      };
      metaStore.put(metadata);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        console.error('Error caching track:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  async deleteSongTracks(songId: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([TRACKS_STORE, META_STORE], 'readwrite');
      const metaStore = transaction.objectStore(META_STORE);
      const index = metaStore.index('songId');
      const request = index.getAllKeys(songId);

      request.onsuccess = () => {
        const fileUrls = request.result as string[];
        const tracksStore = transaction.objectStore(TRACKS_STORE);
        
        for (const fileUrl of fileUrls) {
          tracksStore.delete(fileUrl);
          metaStore.delete(fileUrl);
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        console.error('Error deleting song tracks from cache:', transaction.error);
        resolve();
      };
    });
  }

  async getCacheSize(): Promise<number> {
    await this.init();
    if (!this.db) return 0;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(TRACKS_STORE, 'readonly');
      const store = transaction.objectStore(TRACKS_STORE);
      const request = store.openCursor();
      let totalSize = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const blob = cursor.value as Blob;
          totalSize += blob.size;
          cursor.continue();
        } else {
          resolve(totalSize);
        }
      };

      request.onerror = () => resolve(0);
    });
  }

  async getCachedSongIds(): Promise<string[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(META_STORE, 'readonly');
      const store = transaction.objectStore(META_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const metadata = request.result as TrackMetadata[];
        const uniqueSongIds = [...new Set(metadata.map(m => m.songId))];
        resolve(uniqueSongIds);
      };

      request.onerror = () => resolve([]);
    });
  }

  async clearCache(): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([TRACKS_STORE, META_STORE], 'readwrite');
      transaction.objectStore(TRACKS_STORE).clear();
      transaction.objectStore(META_STORE).clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }
}

// Singleton instance
export const audioCacheManager = new AudioCacheManager();

// Hook for using audio cache
export function useAudioCache() {
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [cachedSongIds, setCachedSongIds] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);

  const refreshCacheInfo = useCallback(async () => {
    const [size, songIds] = await Promise.all([
      audioCacheManager.getCacheSize(),
      audioCacheManager.getCachedSongIds(),
    ]);
    setCacheSize(size);
    setCachedSongIds(songIds);
  }, []);

  useEffect(() => {
    audioCacheManager.init().then(() => {
      setIsReady(true);
      refreshCacheInfo();
    });
  }, [refreshCacheInfo]);

  const clearCache = useCallback(async () => {
    await audioCacheManager.clearCache();
    await refreshCacheInfo();
  }, [refreshCacheInfo]);

  const deleteSongCache = useCallback(async (songId: string) => {
    await audioCacheManager.deleteSongTracks(songId);
    await refreshCacheInfo();
  }, [refreshCacheInfo]);

  const formatCacheSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  return {
    isReady,
    cacheSize,
    cachedSongIds,
    formattedCacheSize: formatCacheSize(cacheSize),
    clearCache,
    deleteSongCache,
    refreshCacheInfo,
  };
}
