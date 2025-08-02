import { motion } from 'framer-motion';

interface Props {
  text: string;
}

const KineticText = ({ text }: Props) => (
  <motion.h2
    className="my-16 text-3xl font-bold text-center text-accent"
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6 }}
    viewport={{ once: true }}
  >
    {text}
  </motion.h2>
);

export default KineticText;
