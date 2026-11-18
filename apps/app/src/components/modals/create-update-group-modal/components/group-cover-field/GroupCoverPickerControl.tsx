import { IconButton } from '@radix-ui/themes';
import { ImageUpIcon } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { ONLINE_ONLY_ACTIONS } from 'constants/onlineOnlyActions';
import { IMAGE_FILE_ACCEPT } from 'helpers/imageFile';
import { useRequiresOnline } from 'hooks/useRequiresOnline';

import { CoverPickerLabel, HiddenFileInput } from './styled';

interface Props {
    isOverlay?: boolean;
    isSaving: boolean;
    onCoverChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

const GroupCoverPickerControl = ({ isOverlay = false, isSaving, onCoverChange }: Props) => {
    const { t } = useTranslation('group');
    // §2.9: a cover upload is never done offline (the form may stay open while the network drops).
    const isDisabled = useRequiresOnline(ONLINE_ONLY_ACTIONS.groupCover) || isSaving;

    return (
        <IconButton asChild variant="surface" color="gray" size="2">
            <CoverPickerLabel
                $isDisabled={isDisabled}
                $isOverlay={isOverlay}
                title={t('modal.cover.action')}
            >
                <ImageUpIcon size={20} aria-hidden />
                <HiddenFileInput
                    type="file"
                    accept={IMAGE_FILE_ACCEPT}
                    aria-label={t('modal.cover.pickerLabel')}
                    disabled={isDisabled}
                    onChange={onCoverChange}
                />
            </CoverPickerLabel>
        </IconButton>
    );
};

export default GroupCoverPickerControl;
