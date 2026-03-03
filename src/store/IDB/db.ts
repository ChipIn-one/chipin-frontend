import Dexie, { type EntityTable } from 'dexie';

interface AuthTable {
    id: number;
    authToken: string;
}

const db = new Dexie('ChipInDB') as Dexie & {
    auth: EntityTable<AuthTable, 'id'>;
};

db.version(1).stores({
    auth: 'id',
});

export type { AuthTable };
export { db };
