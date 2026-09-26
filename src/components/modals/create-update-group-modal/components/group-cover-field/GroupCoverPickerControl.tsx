import { LucideImageUp } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@radix-ui/themes';

import { IMAGE_FILE_ACCEPT } from 'helpers/imageFile';

import { CoverPickerLabel, HiddenFileInput } from './styled';

interface Props {
    isOverlay?: boolean;
    isSaving: boolean;
    onCoverChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

const GroupCoverPickerControl = ({
    isOverlay = false,
    isSaving,
    onCoverChange,
}: Props) => {
    const { t } = useTranslation('group');

    return (
        <IconButton
            asChild
            variant="surface"
            color="gray"
            size="2"
        >
            <CoverPickerLabel
                $isDisabled={isSaving}
                $isOverlay={isOverlay}
                title={t('modal.cover.action')}
            >
                <LucideImageUp size={20} aria-hidden />
                <HiddenFileInput
                    type="file"
                    accept={IMAGE_FILE_ACCEPT}
                    aria-label={t('modal.cover.pickerLabel')}
                    disabled={isSaving}
                    onChange={onCoverChange}
                />
            </CoverPickerLabel>
        </IconButton>
    );
};

export default GroupCoverPickerControl;
