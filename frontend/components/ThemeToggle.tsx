import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const ThemeToggle = () => {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const current = theme === 'system' ? systemTheme : theme;
  return (
    <button
      aria-label="Toggle Theme"
      onClick={() => setTheme(current === 'dark' ? 'light' : 'dark')}
      className="fixed top-4 right-4 z-50 p-2 rounded-md bg-carbon/60 backdrop-blur-md text-accent"
    >
      {current === 'dark' ? '◐' : '◑'}
    </button>
  );
};

export default ThemeToggle;
