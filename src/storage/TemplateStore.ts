import type { AnyTemplateData, TemplateData, TemplateRecord } from '../types';

const DB_NAME = 'CardMakerDB';
const DB_VERSION = 1;
const TEMPLATES_STORE = 'templates';
const AUTOSAVE_STORE = 'autosave';
const AUTOSAVE_KEY = 'current';

/**
 * IndexedDB-backed persistence for named templates and the autosave slot.
 * Uses the same database/store names as the original app, so existing
 * saved templates keep working.
 */
export class TemplateStore {
    private db: IDBDatabase | null = null;

    private open(): Promise<IDBDatabase> {
        if (this.db) return Promise.resolve(this.db);
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => {
                this.db = req.result;
                resolve(req.result);
            };
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(TEMPLATES_STORE)) {
                    db.createObjectStore(TEMPLATES_STORE, { keyPath: 'name' });
                }
                if (!db.objectStoreNames.contains(AUTOSAVE_STORE)) {
                    db.createObjectStore(AUTOSAVE_STORE, { keyPath: 'id' });
                }
            };
        });
    }

    private async run<T>(
        storeName: string,
        mode: IDBTransactionMode,
        op: (store: IDBObjectStore) => IDBRequest<T>,
    ): Promise<T> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const req = op(db.transaction(storeName, mode).objectStore(storeName));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    saveTemplate(record: TemplateRecord): Promise<IDBValidKey> {
        return this.run(TEMPLATES_STORE, 'readwrite', (s) => s.put(record));
    }

    listTemplates(): Promise<TemplateRecord[]> {
        return this.run(TEMPLATES_STORE, 'readonly', (s) => s.getAll() as IDBRequest<TemplateRecord[]>);
    }

    deleteTemplate(name: string): Promise<undefined> {
        return this.run(TEMPLATES_STORE, 'readwrite', (s) => s.delete(name));
    }

    saveAutosave(data: TemplateData): Promise<IDBValidKey> {
        return this.run(AUTOSAVE_STORE, 'readwrite', (s) => s.put({ id: AUTOSAVE_KEY, data }));
    }

    async loadAutosave(): Promise<AnyTemplateData | null> {
        const record = await this.run<{ id: string; data?: AnyTemplateData } | undefined>(
            AUTOSAVE_STORE,
            'readonly',
            (s) => s.get(AUTOSAVE_KEY),
        );
        return record?.data ?? null;
    }
}
