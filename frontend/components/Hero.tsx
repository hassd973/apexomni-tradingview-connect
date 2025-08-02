import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import HeroCanvas from './HeroCanvas';

gsap.registerPlugin(ScrollTrigger);

const Hero = () => {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (titleRef.current) {
      gsap.fromTo(
        titleRef.current,
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: { trigger: titleRef.current, start: 'top 80%' }
        }
      );
      gsap.to(titleRef.current, {
        y: -80,
        scrollTrigger: { trigger: titleRef.current, start: 'top top', end: 'bottom top', scrub: true }
      });
    }

    if (canvasRef.current) {
      gsap.to(canvasRef.current, {
        yPercent: -20,
        scrollTrigger: { trigger: canvasRef.current, start: 'top top', end: 'bottom top', scrub: true }
      });
    }
  }, []);

  return (
    <section className="relative flex flex-col items-center justify-center h-screen overflow-hidden">
      <HeroCanvas onCanvasRef={(el) => (canvasRef.current = el)} />
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
