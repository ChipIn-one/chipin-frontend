import { createContext } from 'react';

// The server supplies the static build year; hydration reuses that exact value.
const PublicBuildYearContext = createContext<number | null>(null);

export { PublicBuildYearContext };
