import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowUpRight, Gamepad2, Heart, Pause, Play, RotateCcw, Sparkles, Trophy, Zap } from 'lucide-react';

const W = 900;
const H = 540;
const PLAYER_SIZE = 15;
const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function App() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const keysRef = useRef(new Set());
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const [status, setStatus] = useState('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem('neon-rush-best') || 0));
  const [health, setHealth] = useState(3);
  const [soundOn, setSoundOn] = useState(false);
  const [mutedLabel, setMutedLabel] = useState('Sound off');
  const audioRef = useRef(null);

  const initGame = useCallback(() => {
    gameRef.current = {
      player: { x: W / 2, y: H - 95, invulnerable: 0 },
      obstacles: [],
      orbs: [],
      particles: [],
      score: 0,
      elapsed: 0,
      spawnTimer: 0,
      orbTimer: 0,
      health: 3,
      combo: 0,
      comboTimer: 0,
      shake: 0,
      flash: 0,
      paused: false,
      lastOrbAt: 0,
    };
    setScore(0);
    setHealth(3);
  }, []);

  const beep = useCallback((frequency = 440, duration = 0.08, type = 'sine') => {
    if (!soundOn) return;
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioRef.current;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.045, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration);
    } catch { /* Audio is optional; gameplay still works without it. */ }
  }, [soundOn]);

  const burst = (game, x, y, color, count = 12) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(45, 210);
      game.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: rand(0.25, 0.7), maxLife: 0.7, size: rand(1.5, 4), color
      });
    }
  };

  const startGame = useCallback(() => {
    initGame();
    setStatus('playing');
    lastTimeRef.current = 0;
  }, [initGame]);

  const endGame = useCallback((game) => {
    setStatus('over');
    const finalScore = Math.floor(game.score);
    setScore(finalScore);
    setBest(old => {
      const next = Math.max(old, finalScore);
      localStorage.setItem('neon-rush-best', String(next));
      return next;
    });
    beep(130, 0.22, 'sawtooth');
  }, [beep]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const draw = (now) => {
      const dt = Math.min((now - (lastTimeRef.current || now)) / 1000, 0.033);
      lastTimeRef.current = now;
      const game = gameRef.current;
      ctx.clearRect(0, 0, W, H);

      // Background grid and drifting stars.
      ctx.fillStyle = '#09091a';
      ctx.fillRect(0, 0, W, H);
      const drift = (now * 0.018) % 36;
      ctx.strokeStyle = 'rgba(65, 87, 160, 0.16)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 36) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = -36; y <= H + 36; y += 36) {
        ctx.beginPath(); ctx.moveTo(0, y + drift); ctx.lineTo(W, y + drift); ctx.stroke();
      }
      for (let i = 0; i < 50; i++) {
        const x = (i * 173 + 29) % W;
        const y = (i * 97 + now * (0.008 + (i % 4) * 0.003)) % H;
        ctx.fillStyle = `rgba(180, 215, 255, ${0.18 + (i % 4) * 0.1})`;
        ctx.fillRect(x, y, 2, 2);
      }

      if (game && status === 'playing' && !game.paused) {
        game.elapsed += dt;
        game.score += dt * 10;
        game.spawnTimer -= dt;
        game.orbTimer -= dt;
        game.comboTimer -= dt;
        game.shake = Math.max(0, game.shake - dt * 18);
        game.flash = Math.max(0, game.flash - dt * 2.5);
        if (game.player.invulnerable > 0) game.player.invulnerable -= dt;

        const speed = 205 + Math.min(game.elapsed * 4.2, 210);
        const keys = keysRef.current;
        let dx = 0, dy = 0;
        if (keys.has('ArrowLeft') || keys.has('a')) dx--;
        if (keys.has('ArrowRight') || keys.has('d')) dx++;
        if (keys.has('ArrowUp') || keys.has('w')) dy--;
        if (keys.has('ArrowDown') || keys.has('s')) dy++;
        const magnitude = Math.hypot(dx, dy) || 1;
        game.player.x = clamp(game.player.x + (dx / magnitude) * speed * dt, 20, W - 20);
        game.player.y = clamp(game.player.y + (dy / magnitude) * speed * dt, 20, H - 20);

        if (game.spawnTimer <= 0) {
          const size = rand(13, 26);
          game.obstacles.push({
            x: rand(size, W - size), y: -size, size,
            speed: rand(145, 220) + Math.min(game.elapsed * 3, 170),
            drift: rand(-32, 32), angle: rand(0, Math.PI), spin: rand(-2.5, 2.5),
            color: Math.random() > 0.5 ? '#ff3e9d' : '#ff684a'
          });
          game.spawnTimer = Math.max(0.22, rand(0.45, 0.9) - game.elapsed * 0.004);
        }
        if (game.orbTimer <= 0) {
          game.orbs.push({ x: rand(28, W - 28), y: -20, r: 8, speed: rand(120, 180), phase: rand(0, 6) });
          game.orbTimer = rand(1.3, 2.1);
        }

        game.obstacles.forEach(o => {
          o.y += o.speed * dt;
          o.x += o.drift * dt;
          o.angle += o.spin * dt;
          if (o.x < o.size || o.x > W - o.size) o.drift *= -1;
          const dist = Math.hypot(o.x - game.player.x, o.y - game.player.y);
          if (dist < o.size + PLAYER_SIZE * 0.7 && game.player.invulnerable <= 0) {
            game.health--;
            game.shake = 9;
            game.flash = 0.75;
            game.player.invulnerable = 1.35;
            burst(game, game.player.x, game.player.y, '#ff4f9a', 20);
            beep(180, 0.15, 'square');
            setHealth(game.health);
            if (game.health <= 0) endGame(game);
          }
        });
        game.obstacles = game.obstacles.filter(o => o.y < H + 50);

        game.orbs.forEach(orb => {
          orb.y += orb.speed * dt;
          orb.phase += dt * 5;
          if (Math.hypot(orb.x - game.player.x, orb.y - game.player.y) < orb.r + PLAYER_SIZE + 3) {
            orb.collected = true;
            game.combo = game.comboTimer > 0 ? game.combo + 1 : 1;
            game.comboTimer = 2.1;
            game.score += 35 + Math.min(game.combo, 10) * 5;
            game.lastOrbAt = now;
            burst(game, orb.x, orb.y, '#38f8e0', 14);
            beep(620 + Math.min(game.combo, 10) * 35, 0.07, 'sine');
          }
        });
        game.orbs = game.orbs.filter(o => !o.collected && o.y < H + 30);

        game.particles.forEach(p => {
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vx *= 0.97; p.vy *= 0.97; p.life -= dt;
        });
        game.particles = game.particles.filter(p => p.life > 0);
        setScore(Math.floor(game.score));
      } else if (game) {
        game.particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
        game.particles = game.particles.filter(p => p.life > 0);
      }

      const g = gameRef.current;
      ctx.save();
      if (g?.shake > 0) ctx.translate(rand(-g.shake, g.shake), rand(-g.shake, g.shake));

      if (g) {
        // Collectibles
        g.orbs.forEach(o => {
          ctx.save();
          ctx.shadowBlur = 22; ctx.shadowColor = '#38f8e0';
          ctx.strokeStyle = '#38f8e0'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(o.x, o.y, o.r + Math.sin(o.phase) * 2, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(56,248,224,.2)';
          ctx.beginPath(); ctx.arc(o.x, o.y, o.r - 2, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        });
        // Obstacles
        g.obstacles.forEach(o => {
          ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.angle);
          ctx.shadowBlur = 18; ctx.shadowColor = o.color;
          ctx.fillStyle = 'rgba(255, 62, 157, 0.15)';
          ctx.strokeStyle = o.color; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, -o.size); ctx.lineTo(o.size * 0.9, 0);
          ctx.lineTo(0, o.size); ctx.lineTo(-o.size * 0.9, 0); ctx.closePath();
          ctx.fill(); ctx.stroke(); ctx.restore();
        });
        // Particles
        g.particles.forEach(p => {
          ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
          ctx.fillStyle = p.color; ctx.shadowBlur = 12; ctx.shadowColor = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        });
        ctx.globalAlpha = 1;
        // Player ship
        const p = g.player;
        if (status === 'playing' && (p.invulnerable <= 0 || Math.floor(now / 90) % 2 === 0)) {
          ctx.save(); ctx.translate(p.x, p.y);
          ctx.shadowBlur = 24; ctx.shadowColor = '#39e8ff';
          ctx.fillStyle = '#39e8ff'; ctx.strokeStyle = '#d7fcff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(14, 13); ctx.lineTo(0, 8); ctx.lineTo(-14, 13); ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 1, 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ff3e9d'; ctx.shadowColor = '#ff3e9d';
          ctx.beginPath(); ctx.moveTo(-5, 13); ctx.lineTo(0, rand(19, 27)); ctx.lineTo(5, 13); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();

      if (g?.flash > 0) {
        ctx.fillStyle = `rgba(255, 40, 110, ${g.flash * 0.2})`;
        ctx.fillRect(0, 0, W, H);
      }
      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [status, endGame]);

  useEffect(() => {
    const down = (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) e.preventDefault();
      keysRef.current.add(key);
      if (key === 'Escape' && status === 'playing') setStatus('paused');
      else if (key === 'Escape' && status === 'paused') setStatus('playing');
      if ((key === 'Enter' || key === ' ') && (status === 'ready' || status === 'over')) startGame();
    };
    const up = (e) => keysRef.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [status, startGame]);

  const handlePointer = (e) => {
    if (status !== 'playing' || !gameRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    gameRef.current.player.x = clamp((e.clientX - rect.left) * scaleX, 20, W - 20);
    gameRef.current.player.y = clamp((e.clientY - rect.top) * scaleY, 20, H - 20);
  };

  const toggleSound = () => {
    setSoundOn(v => !v);
    setMutedLabel(soundOn ? 'Sound off' : 'Sound on');
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Neon Rush home">
          <span className="brand-mark"><Zap size={19} fill="currentColor" /></span>
          <span>NEON<span className="brand-accent">RUSH</span></span>
        </a>
        <div className="top-status"><span className="live-dot" /> ARCADE SYSTEM ONLINE</div>
        <button className="sound-button" onClick={toggleSound} title={mutedLabel}>
          <Activity size={16} /> {mutedLabel}
        </button>
      </header>

      <section className="hero">
        <div className="eyebrow"><Sparkles size={14} /> THE CITY NEVER SLEEPS</div>
        <h1>Stay sharp.<br /><span>Stay alive.</span></h1>
        <p className="hero-copy">Dodge the chaos. Grab the energy. How long can you survive?</p>
      </section>

      <section className="game-layout">
        <div className="game-panel">
          <div className="game-toolbar">
            <div className="game-name"><span className="tiny-live" /> LIVE SIMULATION <span className="divider-dot">/</span> SECTOR 07</div>
            <div className="toolbar-right"><span className="difficulty"><span /> {status === 'playing' ? 'IN PROGRESS' : status === 'paused' ? 'PAUSED' : 'ENDLESS MODE'}</span></div>
          </div>
          <div className="canvas-wrap">
            <canvas ref={canvasRef} width={W} height={H} onPointerDown={handlePointer} onPointerMove={(e) => { if (e.buttons === 1) handlePointer(e); }} aria-label="Neon Rush game arena" />
            {status !== 'playing' && (
              <div className="game-overlay">
                <div className="overlay-card">
                  <div className="overlay-icon">{status === 'over' ? <Trophy size={27} /> : status === 'paused' ? <Pause size={27} /> : <Gamepad2 size={28} />}</div>
                  <div className="overlay-kicker">{status === 'over' ? 'RUN COMPLETE' : status === 'paused' ? 'TAKE A BREATHER' : 'READY, RUNNER?'}</div>
                  <h2>{status === 'over' ? 'You got this.' : status === 'paused' ? 'Game paused.' : 'Enter the grid.'}</h2>
                  <p>{status === 'over' ? `You scored ${score.toLocaleString()} points. One more run?` : status === 'paused' ? 'The city can wait. Press resume when ready.' : 'Collect cyan energy orbs. Avoid the pink hazards. Don’t stop moving.'}</p>
                  <button className="primary-button" onClick={status === 'paused' ? () => setStatus('playing') : startGame}>
                    {status === 'paused' ? <Play size={16} fill="currentColor" /> : status === 'over' ? <RotateCcw size={16} /> : <Play size={16} fill="currentColor" />}
                    {status === 'paused' ? 'RESUME RUN' : status === 'over' ? 'PLAY AGAIN' : 'START RUN'}
                    <ArrowUpRight size={16} />
                  </button>
                  <span className="enter-hint">OR PRESS ENTER ↵</span>
                </div>
              </div>
            )}
            {status === 'playing' && (
              <button className="pause-button" onClick={() => setStatus('paused')} aria-label="Pause game"><Pause size={17} /></button>
            )}
            <div className="canvas-corner corner-tl" /><div className="canvas-corner corner-tr" />
            <div className="canvas-corner corner-bl" /><div className="canvas-corner corner-br" />
          </div>
          <div className="game-footer">
            <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> <span className="muted">to move</span></span>
            <span className="muted">Touch / drag supported</span>
          </div>
        </div>

        <aside className="sidebar">
          <div className="stat-card score-card">
            <div className="stat-heading">CURRENT SCORE <Zap size={15} /></div>
            <div className="score-value">{score.toLocaleString().padStart(5, '0')}</div>
            <div className="score-bottom"><span className="score-bar"><i style={{ width: `${Math.min(score % 1000 / 10, 100)}%` }} /></span><span>PTS</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-heading">PERSONAL BEST <Trophy size={15} /></div>
            <div className="best-value">{best.toLocaleString().padStart(5, '0')}</div>
            <div className="stat-caption">Your record. Beat it.</div>
          </div>
          <div className="stat-card">
            <div className="stat-heading">SHIELD INTEGRITY <Heart size={15} /></div>
            <div className="hearts" aria-label={`${health} lives remaining`}>
              {[0, 1, 2].map(i => <Heart key={i} size={21} fill={i < health ? 'currentColor' : 'transparent'} className={i < health ? 'heart-active' : 'heart-empty'} />)}
            </div>
            <div className="stat-caption">{health === 3 ? 'All systems stable' : health === 2 ? 'Minor damage detected' : health === 1 ? 'Critical — stay sharp!' : 'System offline'}</div>
          </div>
          <div className="tip-card">
            <div className="tip-icon"><Sparkles size={17} /></div>
            <div><strong>RUNNER TIP</strong><p>Cyan orbs give bonus points. Chain collections for a combo bonus.</p></div>
          </div>
          <button className="reset-button" onClick={startGame}><RotateCcw size={15} /> RESET SIMULATION</button>
        </aside>
      </section>

      <section className="bottom-strip">
        <div className="feature"><span className="feature-icon cyan"><Zap size={17} /></span><div><strong>QUICK REFLEXES</strong><p>React fast. Think faster.</p></div></div>
        <div className="feature"><span className="feature-icon pink"><Activity size={17} /></span><div><strong>RISING INTENSITY</strong><p>The longer you last, the harder it gets.</p></div></div>
        <div className="feature"><span className="feature-icon purple"><Trophy size={17} /></span><div><strong>CHASE THE RECORD</strong><p>Your best score saves on this device.</p></div></div>
      </section>
      <footer><span>NEONRUSH <span className="muted">/ BUILD 1.0.0</span></span><span>MADE FOR THE LOVE OF THE GAME <span className="footer-heart">♥</span></span></footer>
    </main>
  );
}

export default App;
