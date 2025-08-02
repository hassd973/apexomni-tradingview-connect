import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Card {
  id: number;
  title: string;
  className: string;
}

const initialCards: Card[] = [
  { id: 1, title: 'Realtime Alerts', className: 'col-span-2 row-span-1' },
  { id: 2, title: '3D Insights', className: 'row-span-2' },
  { id: 3, title: 'Secure Wallets', className: '' },
  { id: 4, title: 'Smart Routing', className: 'col-span-2' },
];

const BentoGrid = () => {
  const [cards, setCards] = useState(initialCards);

  useEffect(() => {
    const shuffle = () =>
      setCards((prev) => [...prev].sort(() => Math.random() - 0.5));
    const handleResize = () => shuffle();
    const interval = setInterval(shuffle, 8000);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="p-4">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 auto-rows-[120px]">
        {cards.map((card) => (
          <motion.div
            key={card.id}
            layout
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className={`flex items-center justify-center bg-carbon rounded-xl text-white p-4 ${card.className}`}
            aria-label={card.title}
          >
            <h3 className="text-lg font-semibold">{card.title}</h3>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default BentoGrid;
