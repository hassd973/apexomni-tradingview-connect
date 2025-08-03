import { motion } from 'framer-motion';
import TradingViewChart from './TradingViewChart';
import ApexLiveMetrics from './ApexLiveMetrics';
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
      <motion.h1
        className={styles.heading}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        ApexOmni Trading
      </motion.h1>
      <motion.p
        className={styles.subheading}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        Automate your strategies and monitor markets with real-time TradingView integration.
      </motion.p>
      <motion.button
        className={styles.cta}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        Get Started
      </motion.button>
      <div className={styles.content}>
        <ApexLiveMetrics />
        <TradingViewChart />
      </div>
    </motion.section>
  );
};

export default Hero;
