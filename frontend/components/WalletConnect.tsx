import { motion } from 'framer-motion';
import styles from './WalletConnect.module.css';

const WalletConnect = () => (
  <motion.section
    id="wallet"
    className={styles.wallet}
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6 }}
  >
    <h2 className={styles.title}>Wallet</h2>
    <button className={styles.button}>Connect Wallet</button>
  </motion.section>
);

export default WalletConnect;
