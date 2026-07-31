const AVATAR_FILE_VALIDATION_ERROR = {
    unsupportedType: 'unsupportedType',
    tooLarge: 'tooLarge',
} as const;

const AVATAR_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const AVATAR_FILE_ACCEPT = AVATAR_ALLOWED_MIME_TYPES.join(',');
const AVATAR_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type AvatarFileValidationError =
    (typeof AVATAR_FILE_VALIDATION_ERROR)[keyof typeof AVATAR_FILE_VALIDATION_ERROR];

export {
    AVATAR_ALLOWED_MIME_TYPES,
    AVATAR_FILE_ACCEPT,
    AVATAR_FILE_VALIDATION_ERROR,
    AVATAR_MAX_FILE_SIZE_BYTES,
};
export type { AvatarFileValidationError };
