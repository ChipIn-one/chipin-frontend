import Dexie, { type EntityTable } from 'dexie';

interface AuthTable {
    id: number;
    accessToken: string;
    refreshToken: string;
}

const db = new Dexie('ChipInDB') as Dexie & {
    auth: EntityTable<AuthTable, 'id'>;
};

db.version(1).stores({
    auth: 'id',
});

db.version(2)
    .stores({
        auth: 'id',
    })
    .upgrade(transaction => transaction.table('auth').clear());

export type { AuthTable };
export { db };
