import styled from 'styled-components';

import { Card, Flex, Text } from '@radix-ui/themes';

const DetailsCard = styled(Card)`
    position: sticky;
    top: calc(var(--space-6) + var(--space-4));
`;

const MobileDetails = styled.details`
    width: 100%;
`;

const MobileSummary = styled.summary`
    list-style: none;
    cursor: pointer;

    &::-webkit-details-marker {
        display: none;
    }
`;

const SummarySurface = styled(Card)`
    width: 100%;
`;

const DetailRow = styled(Flex)`
    border-top: 1px solid var(--gray-a4);
`;

const ParticipantRow = styled(Flex)`
    border-top: 1px solid var(--gray-a3);
`;

const DetailLabel = styled(Text)`
    min-width: 7rem;
`;

export {
    DetailLabel,
    DetailRow,
    DetailsCard,
    MobileDetails,
    MobileSummary,
    ParticipantRow,
    SummarySurface,
};
