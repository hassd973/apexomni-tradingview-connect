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
        className="text-5xl sm:text-6xl font-bold mb-6 text-brand"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        ApexOmni Trading
      </motion.h1>
      <motion.p
        className="text-2xl sm:text-3xl font-semibold mb-4 leading-relaxed"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        Automate your strategies and monitor markets with real-time TradingView integration.
      </motion.p>
      <motion.button
        className="bg-brand text-black rounded-2xl px-8 py-4 shadow-lg transition hover:shadow-[0_0_12px_var(--green)]"
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
