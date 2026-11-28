import { PROP_COLOR } from '@chipin/tokens/theme';
import { IconButton, Tooltip } from '@radix-ui/themes';
import { ImageUpIcon } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { ONLINE_ONLY_ACTIONS } from 'constants/onlineOnlyActions';
import { IMAGE_FILE_ACCEPT } from 'helpers/imageFile';
import { useRequiresOnline } from 'hooks/useRequiresOnline';

import styles from './GroupCoverPickerControl.module.css';

interface Props {
    isOverlay?: boolean;
    isSaving: boolean;
    onCoverChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

const GroupCoverPickerControl = ({ isOverlay = false, isSaving, onCoverChange }: Props) => {
    const { t } = useTranslation('group');
    // §2.9: a cover upload is never done offline (the form may stay open while the network drops).
    const isBlocked = useRequiresOnline(ONLINE_ONLY_ACTIONS.groupCover);
    const isDisabled = isBlocked || isSaving;

    const picker = (
        <IconButton asChild variant="surface" color={PROP_COLOR.neutral} size="2">
            <label
                className={styles.root}
                data-unavailable={isDisabled}
                data-overlay={isOverlay}
                // KB NET-006: blocked, the tooltip says why (no native title next to it).
                title={isBlocked ? undefined : t('modal.cover.action')}
                // Blocked, the file input is disabled: the label takes focus for the tooltip.
                tabIndex={isBlocked ? 0 : undefined}
                data-online-only={isBlocked ? ONLINE_ONLY_ACTIONS.groupCover : undefined}
            >
                <ImageUpIcon size={20} aria-hidden />
                <input
                    className={styles.hiddenInput}
                    type="file"
                    accept={IMAGE_FILE_ACCEPT}
                    aria-label={t('modal.cover.pickerLabel')}
                    disabled={isDisabled}
                    onChange={onCoverChange}
                />
            </label>
        </IconButton>
    );

    return isBlocked ? (
        <Tooltip content={t('common:outbox.onlineRequired')}>{picker}</Tooltip>
    ) : (
        picker
    );
};

export { GroupCoverPickerControl };
