import { useEffect, useId, useRef, useState } from 'react';
import { UserAvatar } from 'basics';
import { LucideCircleAlert, LucideImageUp } from 'lucide-react';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Avatar, Box, Button, Callout, Dialog, Flex, Text } from '@radix-ui/themes';

import {
    IMAGE_FILE_ACCEPT,
    type ImageFileValidationError,
    validateImageFile,
} from 'helpers/imageFile';
import { selectUserAvatarUploading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import { ProgressBar } from 'components/progress-bar';

import { BaseModal } from '../base-modal';
import { OverlayBody, OverlayFooter } from '../components';

import { FileDropZone, HiddenFileInput, PreviewBackdrop } from './styled';

interface Props {
    children: ReactNode;
}

const UserAvatarModal = ({ children }: Props) => {
    const { t } = useTranslation('settings');
    const user = useUsersStore(state => state.user);
    const uploadUserAvatar = useUsersStore(state => state.uploadUserAvatar);
    const isUploading = useLoadingStore(selectUserAvatarUploading);
    const pickerHintId = useId();
    const [isOpened, setIsOpened] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File>();
    const [previewUrl, setPreviewUrl] = useState<string>();
    const previewUrlRef = useRef<string | undefined>(undefined);
    const [validationError, setValidationError] = useState<ImageFileValidationError | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    useEffect(() => {
        return () => {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
            }
        };
    }, []);

    const onResetUploadDraft = () => {
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = undefined;
        }

        setSelectedFile(undefined);
        setPreviewUrl(undefined);
        setValidationError(null);
        setUploadProgress(0);
    };

    const onOpenChange = (isOpen: boolean) => {
        if (!isOpen && isUploading) {
            return;
        }

        if (!isOpen) {
            onResetUploadDraft();
        }

        setIsOpened(isOpen);
    };

    const onSelectFile = (file?: File) => {
        if (!file || isUploading) {
            return;
        }

        const nextValidationError = validateImageFile(file);

        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = undefined;
        }

        setValidationError(nextValidationError);
        setSelectedFile(nextValidationError ? undefined : file);
        setUploadProgress(0);

        if (nextValidationError) {
            setPreviewUrl(undefined);
            return;
        }

        const nextPreviewUrl = URL.createObjectURL(file);
        previewUrlRef.current = nextPreviewUrl;
        setPreviewUrl(nextPreviewUrl);
    };

    const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        onSelectFile(event.target.files?.[0]);
        event.target.value = '';
    };

    const onDragOver = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
    };

    const onDrop = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        onSelectFile(event.dataTransfer.files[0]);
    };

    const onUpload = () => {
        if (!selectedFile || isUploading) {
            return;
        }

        setUploadProgress(0);

        uploadUserAvatar({ file: selectedFile, onProgress: setUploadProgress })
            .then(() => {
                toast.success(t('toasts:settings.avatarUpdated'));
                onResetUploadDraft();
                setIsOpened(false);
            })
            .catch(() => {
                setUploadProgress(0);
            });
    };

    const resolvedPreviewUrl = previewUrl ?? user?.picture ?? '';

    return (
        <BaseModal
            isOpened={isOpened}
            setIsOpened={onOpenChange}
            isCloseDisabled={isUploading}
            triggerElement={children}
            title={t('avatarModal.title')}
            accessibleDescription={t('avatarModal.description')}
            content={
                <>
                    <OverlayBody>
                        <Flex direction="column" align="center" gap="5">
                            <PreviewBackdrop
                                role="img"
                                aria-label={t('avatarModal.previewLabel')}
                            >
                                <UserAvatar
                                    user={user ?? undefined}
                                    src={resolvedPreviewUrl}
                                    size="8"
                                    variant="solid"
                                />
                            </PreviewBackdrop>

                            <FileDropZone
                                $hasError={validationError !== null}
                                $isDisabled={isUploading}
                                onDragOver={onDragOver}
                                onDrop={onDrop}
                            >
                                <HiddenFileInput
                                    type="file"
                                    accept={IMAGE_FILE_ACCEPT}
                                    aria-label={t('avatarModal.pickerLabel')}
                                    aria-describedby={pickerHintId}
                                    disabled={isUploading}
                                    onChange={onFileChange}
                                />

                                <Flex align="center" gap="3" minWidth="0">
                                    <Avatar
                                        size="3"
                                        radius="full"
                                        variant="soft"
                                        color="jade"
                                        fallback={<LucideImageUp size={20} />}
                                    />
                                    <Flex direction="column" gap="1" minWidth="0">
                                        <Text weight="medium" truncate>
                                            {selectedFile?.name ?? t('avatarModal.pickerTitle')}
                                        </Text>
                                        <Text id={pickerHintId} size="2" color="gray">
                                            {t('avatarModal.pickerHint')}
                                        </Text>
                                    </Flex>
                                </Flex>
                            </FileDropZone>

                            {validationError && (
                                <Box width="100%">
                                    <Callout.Root color="red" role="alert" size="1">
                                        <Callout.Icon>
                                            <LucideCircleAlert />
                                        </Callout.Icon>
                                        <Callout.Text>
                                            {t(`avatarModal.errors.${validationError}`)}
                                        </Callout.Text>
                                    </Callout.Root>
                                </Box>
                            )}

                            {isUploading && (
                                <Flex direction="column" gap="2" width="100%">
                                    <Flex justify="between" align="center">
                                        <Text size="2" weight="medium">
                                            {t('avatarModal.uploading')}
                                        </Text>
                                        <Text size="2" color="gray">
                                            {t('avatarModal.progress', {
                                                progress: uploadProgress,
                                            })}
                                        </Text>
                                    </Flex>
                                    <ProgressBar
                                        value={uploadProgress}
                                        size="3"
                                        aria-label={t('avatarModal.progressLabel')}
                                    />
                                </Flex>
                            )}
                        </Flex>
                    </OverlayBody>

                    <OverlayFooter
                        cancelAction={
                            <Dialog.Close>
                                <Button
                                    size="3"
                                    variant="soft"
                                    color="gray"
                                    disabled={isUploading}
                                >
                                    {t('common:buttons.cancel')}
                                </Button>
                            </Dialog.Close>
                        }
                        primaryAction={
                            <Button
                                type="button"
                                size="3"
                                disabled={!selectedFile || isUploading}
                                loading={isUploading}
                                onClick={onUpload}
                            >
                                {t('avatarModal.actions.upload')}
                            </Button>
                        }
                    />
                </>
            }
        />
    );
};

export default UserAvatarModal;
