import { Button, Callout, Flex } from '@radix-ui/themes';
import { CloudUploadIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useOutboxSheetStore } from 'store/outboxSheetStore';

interface Props {
    /** A group's settle-up names the group's expenses; the friends' one any unsent expense. */
    isGroup: boolean;
    /** `checking`: the stored outbox is not read yet (L5), the list has nothing to show yet. */
    reason: 'queued' | 'checking';
    /** Closes the settle-up before `OutboxSheet` opens. */
    onClose: () => void;
}

/** 03-16a part C: why settle-up is refused now, and the way to the unsent operations. */
const SettleUpQueuedHint = ({ isGroup, reason, onClose }: Props) => {
    const { t } = useTranslation('common');
    const setIsOutboxOpen = useOutboxSheetStore(state => state.setIsOpen);

    return (
        <Flex direction="column" gap="3" align="start">
            <Callout.Root color="amber" size="1" role="status">
                <Callout.Text>
                    {reason === 'checking'
                        ? t('outbox.settleUpChecking')
                        : t(isGroup ? 'outbox.settleUpQueuedGroup' : 'outbox.settleUpQueued')}
                </Callout.Text>
            </Callout.Root>
            {reason === 'queued' && (
                <Button
                    type="button"
                    variant="soft"
                    color="amber"
                    onClick={() => {
                        onClose();
                        setIsOutboxOpen(true);
                    }}
                >
                    <CloudUploadIcon size={14} aria-hidden="true" />
                    {t('outbox.showUnsent')}
                </Button>
            )}
        </Flex>
    );
};

export { SettleUpQueuedHint };
