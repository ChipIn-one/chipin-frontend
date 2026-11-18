import { useState } from 'react';
import { Button, Card, Flex, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { legacyAmountFromMoney } from 'entities/balance';
import {
    discardOutboxItem,
    type FailedOutboxItem,
    type PendingOutboxItem,
    retryOutboxItem,
} from 'entities/ledger';
import type { Money } from 'shared/money';

import { Amount } from 'basics/numbers';
import { BaseAlertDialog } from 'components/modals';

type Item = PendingOutboxItem | FailedOutboxItem;

const isFailed = (item: Item): item is FailedOutboxItem => 'reason' in item;

const MoneyText = ({ money }: { money: Money }) => (
    <Amount value={legacyAmountFromMoney(money)} tokenCode={money.currency} />
);

// "Cancel operation" (§2.5): confirmed; a create names the edits of its entry cancelled with it.
// The store refuses an op being sent: the toast says so and nothing is cancelled.
const CancelOperation = ({ item }: { item: Item }) => {
    const { t } = useTranslation(['common', 'toasts']);
    const [isOpened, setIsOpened] = useState(false);
    const related = item.relatedOpIds.length;

    const onAction = (): Promise<void> =>
        discardOutboxItem(item).then(
            refused => {
                if (refused.length > 0) {
                    toast.error(t('toasts:offline.cancelRefused'));
                }
            },
            (error: unknown) => {
                toast.error(t('toasts:offline.actionFailed'));
                throw error;
            },
        );

    return (
        <BaseAlertDialog
            isOpened={isOpened}
            setIsOpened={setIsOpened}
            triggerElement={
                <Button type="button" size="1" variant="soft" color="red">
                    {t('outbox.cancel')}
                </Button>
            }
            title={t('outbox.cancelTitle')}
            description={
                related > 0
                    ? t('outbox.cancelDescriptionRelated', { count: related })
                    : t('outbox.cancelDescription')
            }
            actionLabel={t('outbox.cancel')}
            actionColor="red"
            onAction={onAction}
        />
    );
};

const RetryOperation = ({ item }: { item: FailedOutboxItem }) => {
    const { t } = useTranslation(['common', 'toasts']);
    const [isRequesting, setIsRequesting] = useState(false);

    const onRetry = (): void => {
        setIsRequesting(true);
        retryOutboxItem(item)
            .then(
                isRequested => {
                    if (!isRequested) {
                        toast.error(t('toasts:offline.actionFailed'));
                    }
                },
                () => {
                    toast.error(t('toasts:offline.actionFailed'));
                },
            )
            .finally(() => {
                setIsRequesting(false);
            });
    };

    return (
        <Button
            type="button"
            size="1"
            variant="soft"
            loading={isRequesting}
            disabled={isRequesting}
            onClick={onRetry}
        >
            {t(item.reason === 'stale' ? 'outbox.sendAnyway' : 'outbox.retry')}
        </Button>
    );
};

/** One op of `OutboxSheet`: what it is, its status or failure, and what may be done with it. */
export const OutboxItemRow = ({ item }: { item: Item }) => {
    const { t } = useTranslation('common');
    const failed = isFailed(item) ? item : null;

    return (
        <Card size="1">
            <Flex direction="column" gap="2">
                <Flex justify="between" align="start" gap="3">
                    <Flex direction="column" gap="1" minWidth="0">
                        <Text size="2" weight="medium" truncate>
                            {item.description ?? t(`outbox.kind.${item.kind}`)}
                        </Text>
                        <Text size="1" color="gray">
                            {t(`outbox.kind.${item.kind}`)}
                            {' · '}
                            {failed
                                ? t(`outbox.reason.${failed.reason}`)
                                : 'status' in item && t(`outbox.status.${item.status}`)}
                        </Text>
                    </Flex>
                    {item.amount && (
                        <Text size="2" weight="medium">
                            <MoneyText money={item.amount} />
                        </Text>
                    )}
                </Flex>
                {item.share && (
                    <Text size="1" color="gray">
                        {t('outbox.yourShare')} <MoneyText money={item.share} />
                    </Text>
                )}
                {/* TODO(03-16a part B, deferred): "Create as a new expense" for a failed
                    `deletedRemotely` edit (§2.5) needs the edit form prefilled from the cached entry
                    and the patch; until then the row offers Retry and Cancel only. */}
                {(failed?.isRetrying || item.canCancel || failed?.canRetry) && (
                    <Flex gap="2" justify="end" wrap="wrap">
                        {failed?.isRetrying ? (
                            <Text size="1" color="gray">
                                {t('outbox.retrying')}
                            </Text>
                        ) : (
                            failed?.canRetry && <RetryOperation item={failed} />
                        )}
                        {item.canCancel && <CancelOperation item={item} />}
                    </Flex>
                )}
            </Flex>
        </Card>
    );
};
