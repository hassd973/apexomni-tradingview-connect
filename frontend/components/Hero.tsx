import { motion } from 'framer-motion';
import TradingViewChart from './TradingViewChart';
import styles from './Hero.module.css';

const Hero = () => {
  return (
    <motion.section
      className={styles.hero}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <h1 className={styles.heading}>ApexOmni Trading</h1>
      <p className={styles.subheading}>
        Automate your strategies and monitor markets with real-time TradingView integration.
      </p>
      <button className={styles.cta}>Get Started</button>
      <TradingViewChart />
    </motion.section>
  );
};

export default Hero;
