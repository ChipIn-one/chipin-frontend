// HomePage.tsx
import Footer from 'components/Footer';
import CtaSection from 'features/landing/CtaSection';
import FeaturesSection from 'features/landing/FeaturesSection';
import HeroSection from 'features/landing/HeroSection';
import HowItWorksSection from 'features/landing/HowItWorksSection';
import ShowcaseSections from 'features/landing/ShowcaseSections';

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
