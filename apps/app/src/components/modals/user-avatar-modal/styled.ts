import styled, { css } from 'styled-components';

import { themeColor } from 'helpers/colors';

const PreviewBackdrop = styled.div`
    display: grid;
    place-items: center;
    padding: var(--space-1);
    border-radius: 50%;
    background: linear-gradient(135deg, ${themeColor('jade7')}, ${themeColor('mint7')});
`;

const FileDropZone = styled.label<{ $hasError: boolean; $isDisabled: boolean }>`
    position: relative;
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: var(--space-4);
    border: 1px dashed ${themeColor('jade7')};
    border-radius: var(--radius-4);
    background-color: ${themeColor('jadeA2')};
    cursor: pointer;

    &:focus-within {
        border-color: ${themeColor('jade9')};
        background-color: ${themeColor('jadeA3')};
    }

    ${({ $hasError }) =>
        $hasError &&
        css`
            border-color: ${themeColor('red8')};
            background-color: ${themeColor('redA2')};
        `}

    ${({ $isDisabled }) =>
        $isDisabled &&
        css`
            cursor: default;
            opacity: 0.65;
        `}
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

export { FileDropZone, HiddenFileInput, PreviewBackdrop };
