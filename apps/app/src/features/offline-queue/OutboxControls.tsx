import { Button, Callout, Flex, VisuallyHidden } from '@radix-ui/themes';
import { CloudUploadIcon, TriangleAlertIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { type OutboxOverlay, useOutboxOverlay } from 'entities/ledger';
import { useOutboxSheetStore } from 'store/outboxSheetStore';

import { ConflictNotices } from './ConflictNotices';
import { OutboxSheet } from './OutboxSheet';

// The badge, the banner and the sheet, shown while anything is queued or the sheet is open.
const OutboxView = ({ overlay }: { overlay: OutboxOverlay }) => {
    const { t } = useTranslation('common');
    const setIsOpen = useOutboxSheetStore(state => state.setIsOpen);
    const { count, restore } = overlay;

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
                        onClick={() => {
                            setIsOpen(true);
                        }}
                    >
                        <CloudUploadIcon size={14} aria-hidden="true" />
                        {t('outbox.badge', { count })}
                        <VisuallyHidden>{t('outbox.badgeHint')}</VisuallyHidden>
                    </Button>
                </Flex>
            )}
            <OutboxSheet overlay={overlay} />
        </>
    );
};

/**
 * The outbox in the internal layout (spec 03 §1.6, §2.5): the badge with the number of unsent
 * operations and conflict drafts (it opens `OutboxSheet`), the non-blocking `outboxUnavailable`
 * banner when this tab could not read the outbox, and the conflict toasts (§2.6). Flag off (not
 * mounted), or nothing queued: nothing is rendered.
 */
export const OutboxControls = () => {
    const overlay = useOutboxOverlay();
    const isOpen = useOutboxSheetStore(state => state.isOpen);
    const { count, restore } = overlay;
    const isShown = count > 0 || restore === 'failed' || isOpen;

    return (
        <>
            <ConflictNotices />
            {isShown && <OutboxView overlay={overlay} />}
        </>
    );
};
