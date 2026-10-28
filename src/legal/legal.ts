// Shared by the privacy policy and terms pages: same fonts, tokens and sunset background as the app.
import '@fontsource/zilla-slab/600.css';
import '@fontsource/zilla-slab/700.css';
import '@fontsource-variable/atkinson-hyperlegible-next';
import '../styles.css';
import './legal.css';

// Follow the Light/Dark choice from the app's Settings; "system" leaves it to the device.
try {
  const saved = localStorage.getItem('ranchradar:theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
} catch { /* storage blocked: follow the device */ }
