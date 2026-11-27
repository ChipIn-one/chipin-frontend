import { Callout, Flex, Text } from '@radix-ui/themes';
import { CircleAlertIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { GROUP_COVER_RATIO } from 'constants/groupCover';
import type { ImageFileValidationError } from 'helpers/imageFile';

import { Image } from 'basics/Image';
import { ProgressBar } from 'basics/progress-bar/ProgressBar';

import styles from './GroupCoverField.module.css';

// The ratio constant reaches the module as a local custom property (one source with the group page).
const COVER_RATIO_STYLE: CSSProperties & Record<'--_cover-ratio', string> = {
    '--_cover-ratio': String(GROUP_COVER_RATIO),
};

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
                <div className={styles.preview} style={COVER_RATIO_STYLE}>
                    <Image
                        className={styles.image}
                        src={coverUrl}
                        alt={t('modal.cover.previewLabel')}
                        width="100%"
                        height="100%"
                    />
                    {pickerControl}
                </div>
            )}

            {coverValidationError && (
                <Callout.Root color="red" role="alert" size="1">
                    <Callout.Icon>
                        <CircleAlertIcon />
                    </Callout.Icon>
                    <Callout.Text>{t(`modal.cover.errors.${coverValidationError}`)}</Callout.Text>
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

export { GroupCoverField };
