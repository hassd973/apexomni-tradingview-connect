import { motion } from 'framer-motion';

interface Props {
  text: string;
}

const KineticText = ({ text }: Props) => {
  const words = text.split(' ');
  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };
  const child = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 120 }
    }
  };

  return (
    <motion.h2
      className="my-16 text-3xl font-bold text-center text-accent"
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {words.map((word, i) => (
        <motion.span key={i} variants={child} className="inline-block">
          {word}&nbsp;
        </motion.span>
      ))}
    </motion.h2>
  );
};

export default KineticText;
