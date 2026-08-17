import styled from 'styled-components';

import { themeColor } from 'helpers/colors';

const Placeholder = styled.div`
    width: 100%;
    min-height: 420px;
    border-radius: var(--radius-4);
    background-color: ${themeColor('gray2')};
    border: 1px solid ${themeColor('gray6')};
    display: grid;
    place-items: center;
    color: ${themeColor('gray11')};
    font-size: 14px;
`;

export { Placeholder };
