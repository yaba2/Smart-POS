# Progressive Web App (PWA) Setup

Your Smart POS is now configured as a Progressive Web App (PWA). This allows you to:

- Install the app on your desktop (Windows/Mac/Linux)
- Install on mobile devices (iOS/Android)
- Use offline capabilities
- Launch from an app icon like a native application
- Receive faster load times with service worker caching

## How to Install

### On Desktop (Chrome/Edge)
1. Open the POS in your browser
2. Look for the install icon in the address bar (looks like a computer with a down arrow)
3. Click "Install Smart POS"
4. The app will open in its own window and appear in your Start Menu/Desktop

### On Mobile (Android)
1. Open the POS in Chrome
2. Tap the menu (3 dots) → "Add to Home screen"
3. The app icon will appear on your home screen

### On iOS (Safari)
1. Open the POS in Safari
2. Tap Share button → "Add to Home Screen"
3. The app icon will appear on your home screen

## Files Added/Modified

- `next.config.js` - Added next-pwa configuration
- `public/manifest.json` - PWA manifest with app metadata
- `public/icons/` - App icons in multiple sizes
- `src/app/layout.tsx` - Added manifest and theme-color metadata
- `src/components/pwa-install.tsx` - Install prompt component
- `src/app/admin/layout.tsx` - Added install prompt
- `src/app/pos/layout.tsx` - Added install prompt

## Troubleshooting

If icons don't appear, regenerate them:
```bash
node scripts/generate-icons.js
```

To test PWA locally:
```bash
npm run build
npm start
```
Then open `http://localhost:3000` in Chrome/Edge and look for the install button.
