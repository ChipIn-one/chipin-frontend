// HomePage.tsx
import Footer from 'components/Footer';
import {
    CtaSection,
    FeaturesSection,
    HeroSection,
    HowItWorksSection,
    ShowcaseSections,
} from 'features/landing';

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
