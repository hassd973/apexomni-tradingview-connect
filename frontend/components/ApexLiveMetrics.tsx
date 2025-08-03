import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import styles from './ApexLiveMetrics.module.css';
import { useLiveMetrics } from './LiveMetricsContext';

const CountUp = ({ value }: { value: number }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, latest => Number(latest.toFixed(2)));
  useEffect(() => {
    const controls = animate(count, value, { duration: 0.8 });
    return controls.stop;
  }, [value, count]);
  return <motion.span>{rounded}</motion.span>;
};

const ApexLiveMetrics = () => {
  const { metrics, error } = useLiveMetrics();

  if (error) {
    return (
      <div className={styles.error} role="alert">
        {error}
      </div>
    );
  }

  if (!metrics) {
    return <div className={styles.loading}>Loading...</div>;
  }

  const items = [
    { label: 'Total Equity Value', value: metrics.totalEquityValue },
    { label: 'Available Balance', value: metrics.availableBalance },
    { label: 'Realized PnL', value: metrics.realizedPnl, isPnl: true },
    { label: 'Unrealized PnL', value: metrics.unrealizedPnl, isPnl: true },
    { label: 'Maintenance Margin', value: metrics.maintenanceMargin },
    { label: 'Initial Margin', value: metrics.initialMargin },
    { label: 'Total Risk', value: metrics.totalRisk },
  ];

  return (
    <section className={styles.container} aria-labelledby="live-metrics-heading" aria-live="polite">
      <h2 id="live-metrics-heading" className={styles.heading}>
        Live Metrics
      </h2>
      <div className={styles.grid}>
        {items.map(({ label, value, isPnl }) => (
          <motion.div
            key={label}
            className={styles.card}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            title={label}
          >
            <span className={styles.label}>{label}</span>
            <span
              className={`${styles.value} ${
                isPnl ? (value >= 0 ? styles.positive : styles.negative) : ''
              }`}
            >
              <CountUp value={value} />
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default ApexLiveMetrics;

