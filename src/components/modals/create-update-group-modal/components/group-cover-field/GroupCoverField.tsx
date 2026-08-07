import { LucideCircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Callout, Flex, Text } from '@radix-ui/themes';

import type { ImageFileValidationError } from 'helpers/imageFile';

import { ProgressBar } from 'components/progress-bar';

import { CoverPreview, CoverPreviewImage } from './styled';

interface Props {
    coverUrl?: string | null;
    coverValidationError: ImageFileValidationError | null;
    isUploadingCover: boolean;
    pickerControl?: ReactNode;
    uploadProgress: number;
}

const GroupCoverField = ({
    coverUrl,
    coverValidationError,
    isUploadingCover,
    pickerControl,
    uploadProgress,
}: Props) => {
    const { t } = useTranslation('group');

    if (!coverUrl && !coverValidationError && !isUploadingCover) {
        return null;
    }

    return (
        <Flex direction="column" gap="2">
            {coverUrl && (
                <CoverPreview>
                    <CoverPreviewImage
                        src={coverUrl}
                        alt={t('modal.cover.previewLabel')}
                        width="100%"
                        height="100%"
                    />
                    {pickerControl}
                </CoverPreview>
            )}

            {coverValidationError && (
                <Callout.Root color="red" role="alert" size="1">
                    <Callout.Icon>
                        <LucideCircleAlert />
                    </Callout.Icon>
                    <Callout.Text>
                        {t(`modal.cover.errors.${coverValidationError}`)}
                    </Callout.Text>
                </Callout.Root>
            )}

            {isUploadingCover && (
                <Flex direction="column" gap="2">
                    <Flex justify="between" align="center">
                        <Text size="2" weight="medium">
                            {t('modal.cover.uploading')}
                        </Text>
                        <Text size="2" color="gray">
                            {t('modal.cover.progress', { progress: uploadProgress })}
                        </Text>
                    </Flex>
                    <ProgressBar
                        value={uploadProgress}
                        size="3"
                        aria-label={t('modal.cover.progressLabel')}
                    />
                </Flex>
            )}
        </Flex>
    );
};

export default GroupCoverField;
