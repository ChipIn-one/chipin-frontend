import type { AvatarFileValidationError } from './constants';
import {
    AVATAR_ALLOWED_MIME_TYPES,
    AVATAR_FILE_VALIDATION_ERROR,
    AVATAR_MAX_FILE_SIZE_BYTES,
} from './constants';

const validateAvatarFile = (file: File): AvatarFileValidationError | null => {
    const isAllowedType = AVATAR_ALLOWED_MIME_TYPES.some(mimeType => mimeType === file.type);

    if (!isAllowedType) {
        return AVATAR_FILE_VALIDATION_ERROR.unsupportedType;
    }

    if (file.size > AVATAR_MAX_FILE_SIZE_BYTES) {
        return AVATAR_FILE_VALIDATION_ERROR.tooLarge;
    }

    return null;
};

export { validateAvatarFile };
