import { Button, Flex, Text, VisuallyHidden } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { useOutboxOverlay } from 'entities/ledger';
import { useOutboxSheetStore } from 'store/outboxSheetStore';

/**
 * Spec 03 §3: a balance is the server's and is never recomputed here, so while unsent operations
 * exist it says that it excludes them, with their number opening `OutboxSheet`. Flag off, or
 * nothing queued: nothing is rendered.
 */
export const OutboxBalanceCaption = () => {
    const { t } = useTranslation('common');
    const { count } = useOutboxOverlay();
    const setIsOpen = useOutboxSheetStore(state => state.setIsOpen);

    if (count === 0) {
        return null;
    }
    return (
        <Flex align="center" gap="2" wrap="wrap">
            <Text size="1" color="gray">
                {t('outbox.balanceExcludesPending')}
            </Text>
            <Button
                type="button"
                size="1"
                variant="soft"
                color="amber"
                onClick={() => {
                    setIsOpen(true);
                }}
            >
                {count} <VisuallyHidden>{t('outbox.balanceCounterHint', { count })}</VisuallyHidden>
            </Button>
        </Flex>
    );
};
