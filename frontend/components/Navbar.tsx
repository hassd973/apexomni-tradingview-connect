import Link from 'next/link';
import styles from './Navbar.module.css';
import { motion } from 'framer-motion';

const Navbar = () => {
  return (
    <motion.header
      className={styles.navbar}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.logo}>ApexOmni</div>
      <nav className={styles.navlinks} aria-label="Main Navigation">
        <Link href="#alerts" className={styles.link}>Alerts</Link>
        <Link href="#webhook" className={styles.link}>Webhook</Link>
        <Link href="#wallet" className={styles.link}>Wallet</Link>
      </nav>
    </motion.header>
  );
};

export default Navbar;
