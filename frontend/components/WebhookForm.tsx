import { FormEvent } from 'react';
import { motion } from 'framer-motion';
import styles from './WebhookForm.module.css';

const WebhookForm = () => {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // TODO: integrate API call
  };

  return (
    <motion.section
      id="webhook"
      className={styles.formSection}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <h2>Webhook</h2>
      <form onSubmit={handleSubmit}>
        <label className={styles.label}>
          URL
          <input type="url" required className={styles.input} />
        </label>
        <label className={styles.label}>
          Payload
          <textarea rows={4} className={styles.textarea}></textarea>
        </label>
        <button type="submit" className={styles.button}>Send</button>
      </form>
    </motion.section>
  );
};

export default WebhookForm;
