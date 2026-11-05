import {
    CtaSection,
    FeaturesSection,
    HeroSection,
    HowItWorksSection,
    ShowcaseSections,
} from 'features/landing';

import Footer from 'components/Footer';

const HomePage = () => {
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
