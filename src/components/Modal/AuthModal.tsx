import AuthButtons from 'components/AuthButtons';

import BaseModal from './Modal';

interface Props {
    triggerElement: React.ReactNode;
}

const AuthModal = ({ triggerElement }: Props) => {
    return <BaseModal triggerElement={triggerElement} content={<AuthButtons />} />;
};

export default AuthModal;
