# PokeSim TCG

A lightweight web app to play Pokemon TCG on a phone/tablet during casual events, with multilingual card catalog support and a free-play tabletop mode.

The goal is not to enforce all game rules. Players manually manage actions (draw, discard, marker placement, board positioning), like on a physical table.

Play online: https://coeyn.github.io/pokesim_tcg/

## Features

- Card catalog powered by [TCGdex API](https://www.tcgdex.net/)
- Multi-language support (French, English, Spanish)
- Deck builder (60 cards, max 4 copies per card, basic energy support)
- Game mode for free placement of cards on a snapping grid
- Draw pile / hand / discard interactions
- Marker bag (burn, poison, damage markers)
- User profile with Firebase Auth (email/password + Google)
- Cloud save with Firestore (decks + last game state)
- Offline support via Service Worker + manual cache button

## Tech Stack

- Vanilla HTML/CSS/JavaScript (ES modules)
- Firebase Authentication + Firestore
- GitHub Pages for hosting

## Project Structure

```text
.
├── index.html / app.js           # Catalog + deck building
├── game.html / game.js           # Play mode
├── profile.html / profile.js     # Auth/profile page
├── styles.css / game.css / profile.css
├── catalog/constants.js
├── game/constants.js
├── firebase/
│   ├── config.js                 # Firebase project config
│   └── storage.js                # Auth + Firestore helpers
├── offline/offline.js            # Manual offline caching helpers
├── sw.js                         # Service worker
└── .github/workflows/pages.yml   # GitHub Pages deployment
```

## Run Locally

Use any static server (do not open files directly with `file://`):

```bash
python -m http.server 8080
```

Then open:

`http://localhost:8080`

## Firebase Setup

1. Create a Firebase project.
2. Enable Authentication:
   - Email/Password
   - Google (optional but supported by the UI)
3. Enable Firestore database.
4. Put your web app config in `firebase/config.js`:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "...",
};
```

If Firebase is not configured, the app still works locally with `localStorage` fallback.

## Offline Mode

- The app registers `sw.js` automatically.
- Click the **Offline mode** button (catalog or game start screen) to pre-cache:
  - app pages/scripts/styles
  - known card images (from current decks and saved game state)

For event usage:
1. Open the app online once.
2. Open the decks/cards you need.
3. Click **Offline mode**.
4. You can then continue without internet (for cached content).

## Deployment (GitHub Pages)

This repo includes a Pages workflow at `.github/workflows/pages.yml`.

On push to `main`, GitHub Actions deploys the static site automatically.

## Notes

- Card data and images come from TCGdex and require network unless already cached.
- This project is intentionally a flexible simulator, not a strict tournament rules engine.
