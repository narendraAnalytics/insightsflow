import { Navbar } from "@/components/site/navbar";
import { HeroSection } from "@/components/site/hero-section";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-(--flow-cream)">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
      </main>
    </div>
  );
}
