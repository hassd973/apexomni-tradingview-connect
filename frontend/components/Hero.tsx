import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import HeroCanvas from './HeroCanvas';

gsap.registerPlugin(ScrollTrigger);

const Hero = () => {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (titleRef.current) {
      gsap.fromTo(
        titleRef.current,
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: 'power3.out' }
      );
    }
  }, []);

  return (
    <section className="relative flex flex-col items-center justify-center h-screen overflow-hidden">
      <HeroCanvas />
      <h1
        ref={titleRef}
        className="mt-8 text-5xl font-extrabold text-center text-accent"
      >
        APEX Omni Trading
      </h1>
    </section>
  );
};

export default Hero;
