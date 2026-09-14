import { Navbar } from "@/components/site/navbar";
import { ScrollProgressBar } from "@/components/site/scroll-progress-bar";
import { HeroSection } from "@/components/site/hero-section";
import { WhyChooseSection } from "@/components/site/why-choose-section";
import { HowItWorksSection } from "@/components/site/how-it-works-section";
import { IntegrationsSection } from "@/components/site/integrations-section";
import { ProductShowcaseSection } from "@/components/site/product-showcase-section";
import { TestimonialsSection } from "@/components/site/testimonials-section";
import { FinalCtaSection } from "@/components/site/final-cta-section";
import { Footer } from "@/components/site/footer";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col bg-(--flow-cream)">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[100vh] -z-30 h-[220vh] bg-cover bg-top opacity-[0.14]"
        style={{
          backgroundImage:
            "url(https://res.cloudinary.com/dkqbzwicr/image/upload/v1789388140/backgroundImage_aapupr.png)",
        }}
      />
      <ScrollProgressBar />
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <WhyChooseSection />
        <HowItWorksSection />
        <IntegrationsSection />
        <ProductShowcaseSection />
        <TestimonialsSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
