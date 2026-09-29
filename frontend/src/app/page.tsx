import { Navbar } from "@/components/site/navbar";
import { ScrollProgressBar } from "@/components/site/scroll-progress-bar";
import { HeroSection } from "@/components/site/hero-section";
import { StackStrip } from "@/components/site/stack-strip";
import { WhyChooseSection } from "@/components/site/why-choose-section";
import { HowItWorksSection } from "@/components/site/how-it-works-section";
import { IntegrationsSection } from "@/components/site/integrations-section";
import { ProductShowcaseSection } from "@/components/site/product-showcase-section";
import { StatsBand } from "@/components/site/stats-band";
import { TestimonialsSection } from "@/components/site/testimonials-section";
import { FinalCtaSection } from "@/components/site/final-cta-section";
import { Footer } from "@/components/site/footer";

export default function Home() {
  return (
    <div className="landing relative flex flex-1 flex-col bg-(--flow-cream)">
      <ScrollProgressBar />
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <StackStrip />
        <WhyChooseSection />
        <HowItWorksSection />
        <IntegrationsSection />
        <ProductShowcaseSection />
        <StatsBand />
        <TestimonialsSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
