# Neon Rush ⚡

A cyberpunk arcade survival game built with React, Vite, JavaScript, Canvas, and CSS.

## Features

- Real-time Canvas rendering and keyboard controls
- WASD / arrow key movement
- Dodge rotating neon hazards
- Collect cyan energy orbs and chain combos
- Three lives, collision effects, particles, and increasing difficulty
- Optional synthesized sound effects
- Local high-score persistence via `localStorage`
- Responsive layout with pointer/touch movement

## Requirements

- Node.js 18+ (Node.js 20+ recommended)
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

## Controls

- `W A S D` or arrow keys: move
- `Enter` or `Space`: start / replay
- `Escape`: pause / resume
- Mouse or touch: move the ship by pointing inside the arena
- Sound toggle: enable or disable synthesized sound effects

## Production build

```bash
npm run build
npm run preview
```

## Project structure

```text
neon-rush/
├── index.html
├── package.json
├── README.md
└── src/
    ├── main.jsx
    ├── App.jsx
    └── style.css
```

## Learning challenges

1. Add a shield power-up that blocks one collision.
2. Add difficulty levels and a start menu selector.
3. Add a leaderboard API using Node.js and MongoDB.
4. Add a pause overlay and make sure the simulation freezes perfectly.
5. Deploy the static build to GitHub Pages, Netlify, or AWS S3 + CloudFront.
