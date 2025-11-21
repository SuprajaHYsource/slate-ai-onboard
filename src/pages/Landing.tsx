import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import Modules from "@/components/landing/Modules";
import WhyHinfinity from "@/components/landing/WhyHinfinity";
import Footer from "@/components/landing/Footer";

const Landing = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <Modules />
      <WhyHinfinity />
      <Footer />
    </div>
  );
};

export default Landing;
