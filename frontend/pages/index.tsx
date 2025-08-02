import Head from 'next/head';
import Hero from '../components/Hero';
import BentoGrid from '../components/BentoGrid';
import KineticText from '../components/KineticText';
import ThemeToggle from '../components/ThemeToggle';

export default function Home() {
  return (
    <>
      <Head>
        <title>APEX Omni Trading</title>
        <meta name="description" content="Next-gen trading dashboard" />
      </Head>
      <ThemeToggle />
      <main className="min-h-screen bg-navy text-white">
        
        <Hero />
        <KineticText text='Automate Your Strategy' />
        <BentoGrid />
      </main>
    </>
  );
}
