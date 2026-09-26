import { useEffect } from 'react';

import { useLandingStatsStore } from 'store/landing-stats-store';

import Footer from 'components/Footer';
import {
    CtaSection,
    FeaturesSection,
    HeroSection,
    HowItWorksSection,
    ShowcaseSections,
} from 'features/landing';

const HomePage = () => {
    const fetchSetStats = useLandingStatsStore(state => state.fetchSetStats);

    useEffect(() => {
        fetchSetStats();
    }, [fetchSetStats]);

    return (
        <>
            <HeroSection />
            <FeaturesSection />

            <ShowcaseSections />
            <HowItWorksSection />
            <CtaSection />
            <Footer />
        </>
    );
};

export default HomePage;
