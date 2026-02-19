import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'TranscriptGrab',
    description: 'Grab YouTube transcripts instantly',
    permissions: ['cookies', 'storage'],
    host_permissions: [
      'https://transcriptgrab-vxgi.vercel.app/*',
      'http://localhost:3000/*',
      'https://api.groq.com/*',
    ],
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    action: {
      default_title: 'TranscriptGrab',
    },
  },
});
