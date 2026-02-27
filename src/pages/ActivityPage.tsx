import { Container } from '@radix-ui/themes';

import ActivityTemplate from 'components/ActivityTemplate';
import MobileNavBar from 'components/Navs/MobileNavBar';

const ActivityPage = () => {
    return (
        <Container size="2" pb={{ initial: '9', sm: '6' }}>
            <ActivityTemplate />

            <MobileNavBar />
        </Container>
    );
};

export default ActivityPage;
