import styles from './Footer.module.css';

const Footer = () => (
  <footer className={styles.footer}>
    <nav className={styles.links} aria-label="Footer Navigation">
      <a href="#" className={styles.link}>Home</a>
      <a href="#" className={styles.link}>Docs</a>
    </nav>
    <div className={styles.social}>
      <a href="https://twitter.com" className={styles.link} aria-label="Twitter">Twitter</a>
      <a href="https://github.com" className={styles.link} aria-label="GitHub">GitHub</a>
    </div>
    <small>&copy; {new Date().getFullYear()} ApexOmni</small>
  </footer>
);

export default Footer;
