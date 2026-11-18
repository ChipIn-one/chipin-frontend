import { Button, Callout, Flex } from '@radix-ui/themes';
import { CloudUploadIcon, TriangleAlertIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useOutboxOverlay } from 'entities/ledger';
import { useOutboxSheetStore } from 'store/outboxSheetStore';

import { OutboxSheet } from './OutboxSheet';

/**
 * The outbox in the internal layout (spec 03 §1.6, §2.5): the badge with the number of unsent
 * operations (it opens `OutboxSheet`), and the non-blocking `outboxUnavailable` banner when this
 * tab could not read the outbox. Flag off, or nothing queued: nothing is rendered.
 */
export const OutboxControls = () => {
    const { t } = useTranslation('common');
    const overlay = useOutboxOverlay();
    const isOpen = useOutboxSheetStore(state => state.isOpen);
    const setIsOpen = useOutboxSheetStore(state => state.setIsOpen);
    const { count, restore } = overlay;

    if (count === 0 && restore !== 'failed' && !isOpen) {
        return null;
    }
    return (
        <>
            {restore === 'failed' && (
                <Callout.Root color="amber" size="1" mb="3" role="status">
                    <Callout.Icon>
                        <TriangleAlertIcon size={16} aria-hidden="true" />
                    </Callout.Icon>
                    <Callout.Text>{t('outbox.unavailable')}</Callout.Text>
                </Callout.Root>
            )}
            {count > 0 && (
                <Flex justify="end" mb="3">
                    <Button
                        type="button"
                        size="1"
                        variant="soft"
                        color="amber"
                        aria-label={t('outbox.badgeLabel', { count })}
                        onClick={() => {
                            setIsOpen(true);
                        }}
                    >
                        <CloudUploadIcon size={14} aria-hidden="true" />
                        {t('outbox.badge', { count })}
                    </Button>
                </Flex>
            )}
            <OutboxSheet overlay={overlay} />
        </>
    );
};
