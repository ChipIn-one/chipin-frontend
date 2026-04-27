import { Container } from '@radix-ui/themes';

import MobileNavBar from 'components/Navs/MobileNavBar';
import Activity from 'features/activity';

const ActivityPage = () => {
    return (
        <Container size="2" pb={{ initial: '9', sm: '6' }}>
            <Activity context="full" />

            <MobileNavBar />
        </Container>
    );
};

export default ActivityPage;
