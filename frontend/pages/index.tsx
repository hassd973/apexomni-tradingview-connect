import Head from 'next/head';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import AlertModule from '../components/AlertModule';
import WebhookForm from '../components/WebhookForm';
import WalletConnect from '../components/WalletConnect';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <>
      <Head>
        <title>APEX Omni Trading</title>
        <meta name="description" content="Next-gen trading dashboard" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Roboto:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Navbar />
      <main className="overflow-y-auto">
        <Hero />
        <AlertModule />
        <WebhookForm />
        <WalletConnect />
      </main>
      <Footer />
    </>
  );
}
