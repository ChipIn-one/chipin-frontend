import { useState } from 'react';
import { Link } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import reactLogo from 'assets/react.svg';
import PWABadge from 'basics/PWABadge';

import viteLogo from '/vite.svg';

const HomePage = () => {
    const [count, setCount] = useState(0);

    return (
        <>
            <div>
                <a href="https://vite.dev" target="_blank">
                    <img src={viteLogo} className="logo" alt="Vite logo" />
                </a>
                <a href="https://react.dev" target="_blank">
                    <img src={reactLogo} className="logo react" alt="React logo" />
                </a>
            </div>
            <h1>Vite + React</h1>
            <div className="card">
                <button onClick={() => setCount(count => count + 1)}>count is {count}</button>
                <Link to={ROUTES.LOG_IN}>Login page</Link>
            </div>
            <PWABadge />
        </>
    );
};

export default HomePage;
