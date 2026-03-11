import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import HowItWorks from '../components/HowItWorks';
import FeaturesSection from '../components/FeaturesSection';
import Testimonials from '../components/Testimonials';
import Footer from '../components/Footer';

export default function Home() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#about') {
      const section = document.getElementById('about');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [location.hash]);

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
