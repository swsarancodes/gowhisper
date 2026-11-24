import { useEffect } from "react";
import { Hero } from "./components/Hero";
import { Download, Everywhere, Footer, HowItWorks, Marquee, Nav, Private, Race } from "./components/Sections";
import { startVoice } from "./lib/voice";

export default function App() {
  useEffect(() => startVoice(), []);
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <HowItWorks />
        <Race />
        <Everywhere />
        <Private />
        <Download />
      </main>
      <Footer />
    </>
  );
}
