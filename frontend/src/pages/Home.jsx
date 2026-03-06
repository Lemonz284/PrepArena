import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import HowItWorks from '../components/HowItWorks';
import FeaturesSection from '../components/FeaturesSection';
import Testimonials from '../components/Testimonials';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <HowItWorks />
        <FeaturesSection />
        <Testimonials />
      </main>
      <Footer />
    </>
  );
}
