import styled from 'styled-components';

import { themeColor } from 'helpers/colors';

const RadioMarker = styled.span`
    display: inline-flex;
    width: 18px;
    height: 18px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    border: 2px solid ${themeColor('gray8')};
    border-radius: 50%;

    &::after {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: ${themeColor('jade9')};
        content: '';
        opacity: 0;
    }

    [data-state='checked'] & {
        border-color: ${themeColor('jade9')};
    }

    [data-state='checked'] &::after {
        opacity: 1;
    }
`;

export { RadioMarker };
