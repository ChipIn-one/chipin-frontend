import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { HEAD_META } from 'constants/routes';

export const useRoutesMeta = () => {
    const location = useLocation();

    useEffect(() => {
        const meta = HEAD_META[location.pathname];

        if (meta) {
            document.title = meta.title;

            if (meta.description) {
                let element = document.querySelector<HTMLMetaElement>('meta[name="description"]');

                if (!element) {
                    element = document.createElement('meta');
                    element.setAttribute('name', 'description');
                    document.head.appendChild(element);
                }

                element.setAttribute('content', meta.description);
            }
        }
    }, [location]);
};
