// The manifest scenarios (docs/design-system/screens.md "Test data") as provisioning calls: staging
// users and data of this run only, purged by the global teardown. Each capture row provisions its
// own scenario: a refresh cookie rotates on first use, so users are never shared between rows.
import type { ProvisionedUser, ProvisioningClient } from '../support/provisioning';

import type { ScenarioUserKey } from './captureModel';

export interface ScenarioData {
    users: Partial<Record<ScenarioUserKey, ProvisionedUser>>;
    groupId?: string;
    /** A credential: masked in every capture and never put in a message. */
    inviteToken?: string;
}

type Provisioner = (client: ProvisioningClient) => Promise<ScenarioData>;

const LONG_MEMBER_COUNT = 8;
// More expenses than one feed page, so the next-page rows have a second page to fail on.
const LONG_EXTRA_EXPENSES = 25;

const pair = async (client: ProvisioningClient, friends: boolean) => {
    const A = await client.register('E2E A');
    const B = await client.register('E2E B');
    if (friends) {
        await client.makeFriends(A, B);
    }

    return { A, B };
};

const groupPair = async (client: ProvisioningClient, friends: boolean): Promise<ScenarioData> => {
    const { A, B } = await pair(client, friends);
    const groupId = await client.createGroup(A, 'E2E Trip', [B]);

    return { users: { A, B }, groupId };
};

/** Scenario id → provisioning. `friend-invite` is absent: its rows are manual (no token helper). */
export const SCENARIOS: Readonly<Record<string, Provisioner>> = {
    'new-user': async client => ({ users: { A: await client.register('E2E A') } }),
    'friends-pair': async client => ({ users: await pair(client, true) }),
    'solo-group': async client => {
        const A = await client.register('E2E A');

        return { users: { A }, groupId: await client.createGroup(A, 'E2E Trip', []) };
    },
    'group-pair': client => groupPair(client, true),
    'group-no-friend': client => groupPair(client, false),
    'group-with-expense': async client => {
        const data = await groupPair(client, true);
        const { A, B } = data.users;
        if (!A || !B || !data.groupId) {
            throw new Error('group-pair did not provide A, B and the group');
        }
        await client.addEqualGroupExpense({
            groupId: data.groupId,
            payer: A,
            participants: [A, B],
            amount: 30,
            description: 'E2E dinner',
        });

        return data;
    },
    'long-content': async client => {
        const A = await client.register('E2E Alexandria Konstantinopolskaya-Wolfeschlegel');
        const members: ProvisionedUser[] = [];
        for (let index = 1; index <= LONG_MEMBER_COUNT; index += 1) {
            const member = await client.register(
                `E2E Member ${index} with a rather long display name`,
            );
            await client.makeFriends(A, member);
            members.push(member);
        }
        const groupId = await client.createGroup(
            A,
            'E2E Weekend in the mountains with the whole extended family 2026',
            members,
        );
        await client.addEqualGroupExpense({
            groupId,
            payer: A,
            participants: [A, ...members],
            amount: 9999999.99,
            description:
                'E2E very long expense description that does not fit on one line at phone width',
        });
        for (let index = 1; index <= LONG_EXTRA_EXPENSES; index += 1) {
            await client.addEqualGroupExpense({
                groupId,
                payer: A,
                participants: [A, ...members],
                amount: 9 + index,
                description: `E2E expense ${index}`,
            });
        }

        return { users: { A }, groupId };
    },
    'group-invite': async client => {
        const A = await client.register('E2E A');
        const C = await client.register('E2E C');
        const groupId = await client.createGroup(A, 'E2E Trip', []);

        return {
            users: { A, C },
            groupId,
            inviteToken: await client.getGroupInviteToken(A, groupId),
        };
    },
};
