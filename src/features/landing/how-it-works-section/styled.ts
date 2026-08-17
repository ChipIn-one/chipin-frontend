import styled from 'styled-components';

import { themeColor } from 'helpers/colors';

const TimelineWrap = styled.div`
    position: relative;
    max-width: 560px;
    margin: 0 auto;
`;

const StepLine = styled.div`
    width: 2px;
    flex: 1;
    min-height: var(--space-9);
    background-color: ${themeColor('green6')};
    margin-top: var(--space-2);
    margin-bottom: var(--space-2);
`;

export { StepLine, TimelineWrap };
