import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import HowItWorks from '../components/HowItWorks';
import FeaturesSection from '../components/FeaturesSection';
import Testimonials from '../components/Testimonials';
import Footer from '../components/Footer';
import LoginModal from '../components/LoginModal';

export default function Home() {
  const location = useLocation();
  const [showLogin, setShowLogin] = useState(false);
  const [signupMode, setSignupMode] = useState(false);

  useEffect(() => {
    if (location.hash === '#about') {
      const section = document.getElementById('about');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [location.hash]);

  const openLogin = () => { setSignupMode(false); setShowLogin(true); };
  const openSignup = () => { setSignupMode(true); setShowLogin(true); };
  const closeModal = () => setShowLogin(false);

  return (
    <>
      <Navbar onOpenLogin={openLogin} onOpenSignup={openSignup} />
      <main>
        <HeroSection onOpenSignup={openSignup} />
        <HowItWorks />
        <FeaturesSection />
        <Testimonials />
      </main>
      <Footer onOpenSignup={openSignup} />

      <LoginModal
        isOpen={showLogin}
        onClose={closeModal}
        startInSignup={signupMode}
      />
    </>
  );
}
