const IMAGE_FILE_VALIDATION_ERROR = {
    unsupportedType: 'unsupportedType',
    tooLarge: 'tooLarge',
} as const;

const IMAGE_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const IMAGE_FILE_ACCEPT = IMAGE_ALLOWED_MIME_TYPES.join(',');
const IMAGE_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type ImageFileValidationError =
    (typeof IMAGE_FILE_VALIDATION_ERROR)[keyof typeof IMAGE_FILE_VALIDATION_ERROR];

const validateImageFile = (file: File): ImageFileValidationError | null => {
    const isAllowedType = IMAGE_ALLOWED_MIME_TYPES.some(mimeType => mimeType === file.type);

    if (!isAllowedType) {
        return IMAGE_FILE_VALIDATION_ERROR.unsupportedType;
    }

    if (file.size > IMAGE_MAX_FILE_SIZE_BYTES) {
        return IMAGE_FILE_VALIDATION_ERROR.tooLarge;
    }

    return null;
};

export { IMAGE_FILE_ACCEPT, validateImageFile };
export type { ImageFileValidationError };
