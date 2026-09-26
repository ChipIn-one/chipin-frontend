import { GroupSettleUpFlow, SettlementForm } from './components';
import type { SettleUpModalProps } from './types';

const SettleUpModal = (props: SettleUpModalProps) => {
    if (props.source === 'group') {
        return <GroupSettleUpFlow {...props} />;
    }

    return <SettlementForm {...props} />;
};

export default SettleUpModal;
