import { useState } from 'react';
import { LucideCheckCircle, LucideSearch, LucideUserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
    Avatar,
    Button,
    Card,
    Container,
    Flex,
    Separator,
    Skeleton,
    Text,
    TextField,
} from '@radix-ui/themes';

import type { Friend } from 'api/chipin.types';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/usersStore';

import { NoFriendsEmptyState } from 'basics/empty-states';
import { MobileNavBar } from 'components/nav-bars';

import type { CurrencyGroupItem } from './components';
import { CurrencyGroupCard, FriendsPageHeader } from './components';

interface CurrencyGroup {
    currency: string;
    netTotal: number;
    items: CurrencyGroupItem[];
}

const buildCurrencyGroups = (friends: Friend[]): CurrencyGroup[] => {
    const map = new Map<string, CurrencyGroupItem[]>();

    for (const friend of friends) {
        for (const [currency, balance] of Object.entries(friend.balances)) {
            // @ts-expect-error Runtime API includes netAmount, but current type definition misses it.
            const netAmount = balance.netAmount;

            if (!map.has(currency)) {
                map.set(currency, []);
            }
            // @ts-expect-error Runtime API includes netAmount, but current type definition misses it.
            map.get(currency)!.push({ user: friend.user, netAmount });
        }
    }

    return Array.from(map.entries()).map(([currency, items]) => ({
        currency,
        netTotal: items.reduce((sum, item) => sum + item.netAmount, 0),
        items,
    }));
};

const SKELETON_COUNT = 3;
const SKELETON_CURRENCY = 'USD';
const SKELETON_TOTAL = '+9999';
const SKELETON_NAME = 'Display Name John';
const SKELETON_AMOUNT = '+999 USD';

const FriendsPage = () => {
    const { t } = useTranslation(['common', 'friends']);
    const friends = useUsersStore(s => s.friends);
    const isLoadingFriends = useLoadingStore(state => state.users.friends);
    const [search, setSearch] = useState('');

    const isSkeletonShown = isLoadingFriends === 'loading' && !friends.length;
    const isEmptyFriends = isLoadingFriends === 'fetched' && friends.length === 0;

    const filteredFriends = friends.filter(f =>
        f.user.displayName.toLowerCase().includes(search.toLowerCase()),
    );

    const currencyGroups = buildCurrencyGroups(filteredFriends);
    const settledUpFriends = filteredFriends.filter(f => Object.keys(f.balances).length === 0);

    return (
        <Container size="2" pb={{ initial: '9', sm: '6' }}>
            <Flex direction="column" gap="4">
                <FriendsPageHeader isLoading={isSkeletonShown} />

                <Skeleton loading={isSkeletonShown}>
                    <TextField.Root
                        placeholder={t('friends:searchPlaceholder')}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        size="3"
                    >
                        <TextField.Slot>
                            <LucideSearch size={16} />
                        </TextField.Slot>
                    </TextField.Root>
                </Skeleton>

                {isSkeletonShown ? (
                    Array.from({ length: SKELETON_COUNT }, (_, i) => (
                        <Card key={i}>
                            <Flex justify="between" align="center" mb="3">
                                <Skeleton>
                                    <Text size="3" weight="bold">
                                        {SKELETON_CURRENCY}
                                    </Text>
                                </Skeleton>
                                <Skeleton>
                                    <Text size="3">{SKELETON_TOTAL}</Text>
                                </Skeleton>
                            </Flex>
                            <Flex direction="column" gap="3">
                                {Array.from({ length: 2 }, (_, j) => (
                                    <Flex key={j} justify="between" align="center">
                                        <Flex align="center" gap="3">
                                            <Skeleton>
                                                <Avatar
                                                    size={{ initial: '1', sm: '2' }}
                                                    radius="full"
                                                    fallback="A"
                                                />
                                            </Skeleton>
                                            <Skeleton>
                                                <Text size={{ initial: '2', sm: '3' }}>
                                                    {SKELETON_NAME}
                                                </Text>
                                            </Skeleton>
                                        </Flex>
                                        <Skeleton>
                                            <Text size="2">{SKELETON_AMOUNT}</Text>
                                        </Skeleton>
                                    </Flex>
                                ))}
                            </Flex>
                        </Card>
                    ))
                ) : isEmptyFriends ? (
                    <NoFriendsEmptyState
                        action={
                            <Button size="2" variant="soft">
                                <LucideUserPlus size={14} />
                                {t('common:buttons.addFriend')}
                            </Button>
                        }
                    />
                ) : (
                    <>
                        {currencyGroups.map(group => (
                            <CurrencyGroupCard
                                key={group.currency}
                                currency={group.currency}
                                netTotal={group.netTotal}
                                items={group.items}
                            />
                        ))}

                        {settledUpFriends.length > 0 && (
                            <Card>
                                <Flex align="center" gap="2" mb="3">
                                    <LucideCheckCircle size={16} />
                                    <Text weight="medium" size="2">
                                        {t('common:balances.settledUp')}
                                    </Text>
                                </Flex>
                                <Flex direction="column" gap="3">
                                    {settledUpFriends.map((friend, index) => (
                                        <Flex key={friend.user.id} direction="column" gap="3">
                                            {index > 0 && <Separator size="4" />}
                                            <Flex justify="between" align="center">
                                                <Flex align="center" gap="3">
                                                    <Avatar
                                                        src={friend.user.picture || ''}
                                                        fallback={friend.user.displayName.charAt(0)}
                                                        size={{ initial: '1', sm: '2' }}
                                                        radius="full"
                                                    />
                                                    <Text
                                                        as="span"
                                                        weight="medium"
                                                        size={{ initial: '2', sm: '3' }}
                                                    >
                                                        {friend.user.displayName}
                                                    </Text>
                                                </Flex>
                                                <LucideCheckCircle
                                                    size={18}
                                                    color="var(--gray-9)"
                                                />
                                            </Flex>
                                        </Flex>
                                    ))}
                                </Flex>
                            </Card>
                        )}
                    </>
                )}
            </Flex>

            <MobileNavBar />
        </Container>
    );
};

export default FriendsPage;
