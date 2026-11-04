import { useEffect } from 'react';

import {
    CtaSection,
    FeaturesSection,
    HeroSection,
    HowItWorksSection,
    ShowcaseSections,
} from 'features/landing';
import { useLandingStatsStore } from 'store/landing-stats-store';

import Footer from 'components/Footer';

const HomePage = () => {
    const fetchSetStats = useLandingStatsStore(state => state.fetchSetStats);

    useEffect(() => {
        void fetchSetStats();
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
