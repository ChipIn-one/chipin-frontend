import styled, { css } from 'styled-components';

import { GROUP_COVER_RATIO } from 'constants/groupCover';
import { themeColor } from 'helpers/colors';

import Image from 'basics/Image';

const CoverPreview = styled.div`
    position: relative;
    overflow: hidden;
    width: 100%;
    aspect-ratio: ${GROUP_COVER_RATIO};
    border: 1px solid ${themeColor('gray6')};
    border-radius: var(--radius-4);
    background-color: ${themeColor('gray3')};
`;

const CoverPreviewImage = styled(Image)`
    display: block;

    && {
        object-fit: cover;
    }
`;

const CoverPickerLabel = styled.label<{ $isDisabled: boolean; $isOverlay: boolean }>`
    flex: none;
    cursor: ${({ $isDisabled }) => ($isDisabled ? 'default' : 'pointer')};
    opacity: ${({ $isDisabled }) => ($isDisabled ? 0.65 : 1)};

    ${({ $isOverlay }) =>
        $isOverlay &&
        css`
            position: absolute;
            top: var(--space-3);
            right: var(--space-3);
        `}

    &:focus-within {
        box-shadow: inset 0 0 0 2px ${themeColor('jade8')};
    }
`;

const HiddenFileInput = styled.input`
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
`;

export {
    CoverPickerLabel,
    CoverPreview,
    CoverPreviewImage,
    HiddenFileInput,
};
