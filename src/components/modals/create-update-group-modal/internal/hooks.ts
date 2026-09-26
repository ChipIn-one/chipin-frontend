import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import {
    type ImageFileValidationError,
    validateImageFile,
} from 'helpers/imageFile';

interface GroupCoverDraft {
    coverPreviewUrl?: string;
    coverValidationError: ImageFileValidationError | null;
    selectedCoverFile?: File;
    uploadProgress: number;
    onCoverChange: (event: ChangeEvent<HTMLInputElement>) => void;
    setUploadProgress: (progress: number) => void;
}

const useGroupCoverDraft = (isSaving: boolean): GroupCoverDraft => {
    const [selectedCoverFile, setSelectedCoverFile] = useState<File>();
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string>();
    const coverPreviewUrlRef = useRef<string | undefined>(undefined);
    const [coverValidationError, setCoverValidationError] =
        useState<ImageFileValidationError | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    useEffect(() => {
        return () => {
            if (coverPreviewUrlRef.current) {
                URL.revokeObjectURL(coverPreviewUrlRef.current);
            }
        };
    }, []);

    const onCoverChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file || isSaving) {
            return;
        }

        const validationError = validateImageFile(file);

        if (coverPreviewUrlRef.current) {
            URL.revokeObjectURL(coverPreviewUrlRef.current);
            coverPreviewUrlRef.current = undefined;
        }

        setCoverValidationError(validationError);
        setSelectedCoverFile(validationError ? undefined : file);
        setCoverPreviewUrl(undefined);
        setUploadProgress(0);

        if (validationError) {
            return;
        }

        const nextPreviewUrl = URL.createObjectURL(file);
        coverPreviewUrlRef.current = nextPreviewUrl;
        setCoverPreviewUrl(nextPreviewUrl);
    };

    return {
        coverPreviewUrl,
        coverValidationError,
        selectedCoverFile,
        uploadProgress,
        onCoverChange,
        setUploadProgress,
    };
};

export { useGroupCoverDraft };
