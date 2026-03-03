import { Link } from 'react-router-dom';
import styled from 'styled-components';

const StyledLink = styled(Link)`
    text-decoration: none;
    color: inherit;
`;

interface EmptyRouteLinkProps {
    to: string;
    children: React.ReactNode;
    className?: string;
}

export const EmptyRouteLink = ({ to, children, className }: EmptyRouteLinkProps) => {
    return (
        <StyledLink to={to} className={className}>
            {children}
        </StyledLink>
    );
};
