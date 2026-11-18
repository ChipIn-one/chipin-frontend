import { useState } from 'react';
import { Button, Card, Flex, Text } from '@radix-ui/themes';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
    type ConflictDraftItem,
    discardConflictDraft,
    ledgerEntryQueryOptions,
} from 'entities/ledger';

import { useOpenConflictDraft } from './internal/useOpenConflictDraft';

/**
 * A conflict draft in `OutboxSheet` (spec 03 §2.6): the user's changes of an expense another member
 * changed meanwhile, never sent until saved from the form. "Open my changes" reopens the form on it;
 * "Discard my changes" removes it without a request.
 */
export const ConflictDraftRow = ({ item }: { item: ConflictDraftItem }) => {
    const { t } = useTranslation(['common', 'toasts']);
    const openDraft = useOpenConflictDraft();
    const [isDiscarding, setIsDiscarding] = useState(false);
    // Named by the cached entry when the draft has no new description; never fetched here.
    const { data: cached } = useQuery({
        ...ledgerEntryQueryOptions(item.entryId),
        enabled: false,
    });
    const description = item.description ?? cached?.expense?.description ?? null;
    const { parentActivityId } = item;

    const onDiscard = (): void => {
        setIsDiscarding(true);
        discardConflictDraft(item.entryId)
            .catch(() => {
                toast.error(t('toasts:offline.actionFailed'));
            })
            .finally(() => {
                setIsDiscarding(false);
            });
    };

    return (
        <Card size="1">
            <Flex direction="column" gap="2">
                <Flex direction="column" gap="1" minWidth="0">
                    <Text size="2" weight="medium" truncate>
                        {description ?? t('outbox.kind.updateExpense')}
                    </Text>
                    <Text size="1" color="gray">
                        {t('outbox.conflictDraftState')}
                    </Text>
                </Flex>
                <Flex gap="2" justify="end" wrap="wrap">
                    {parentActivityId !== null && (
                        <Button
                            type="button"
                            size="1"
                            variant="soft"
                            onClick={() => {
                                openDraft(item.entryId, parentActivityId);
                            }}
                        >
                            {t('outbox.openDraft')}
                        </Button>
                    )}
                    <Button
                        type="button"
                        size="1"
                        variant="soft"
                        color="red"
                        loading={isDiscarding}
                        disabled={isDiscarding}
                        onClick={onDiscard}
                    >
                        {t('outbox.discardDraft')}
                    </Button>
                </Flex>
            </Flex>
        </Card>
    );
};
