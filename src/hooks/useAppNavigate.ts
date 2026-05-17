import type { NavigateOptions, To } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

export function useAppNavigate() {
    const navigate = useNavigate();

    return (to: To, options?: NavigateOptions) => {
        navigate(to, options);
    };
}
