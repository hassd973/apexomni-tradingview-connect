import { motion } from 'framer-motion';
import styles from './AlertModule.module.css';

interface Alert {
  id: number;
  message: string;
}

const sampleAlerts: Alert[] = [
  { id: 1, message: 'BTCUSDT crossed above MA50' },
  { id: 2, message: 'ETHUSDT price spike detected' },
];

const AlertModule = () => (
  <motion.section
    id="alerts"
    className={styles.alerts}
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6 }}
  >
    <h2 className={styles.title}>Alerts</h2>
    <ul>
      {sampleAlerts.map((alert) => (
        <li key={alert.id} className={styles.item}>{alert.message}</li>
      ))}
    </ul>
  </motion.section>
);

export default AlertModule;
