import '../styles/theme.css';
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { ThemeProvider } from 'next-themes';
import { LiveMetricsProvider } from '../components/LiveMetricsContext';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LiveMetricsProvider>
        <Component {...pageProps} />
      </LiveMetricsProvider>
    </ThemeProvider>
  );
}

export default MyApp;
