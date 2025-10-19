import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Play, Pause, RotateCcw, Trophy, Volume2, VolumeX, X } from 'lucide-react';

// Types
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type FoodType = 'apple' | 'money' | 'rising' | 'dropping' | 'bonus';

interface Food extends Position { type: FoodType; label: string }
interface Obstacle { x: number; y: number; width: number; height: number; element: HTMLElement }
interface DOMSnakeGameProps { onClose?: () => void }

// Config
const CELL_SIZE = 12;
const DEFAULT_INTERVAL = 120; // ms
const ACCEL_STEP = 10; // ms faster per accel tick
const MIN_INTERVAL = 30; // fastest
const TRAIL_LENGTH = 15;
const PLAY_AREA_RATIO = 0.38; // top portion only

const STOCK_TICKERS = ['AAPL','SBUX','TSLA','MSFT','AMZN','GOOGL','META','NVDA','NFLX','AMD'];
const MONEY_BAGS = ['💰','💵','💸','💎','🏆'];

const clamp = (v:number,a:number,b:number) => Math.max(a, Math.min(b, v));

export function DOMSnakeGame({ onClose }: DOMSnakeGameProps) {
  // Refs and canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Game state
  const [grid, setGrid] = useState<{width:number;height:number}>({ width: 40, height: 20 });
  const [snake, setSnake] = useState<Position[]>([]);
  const nextDirection = useRef<Direction>('RIGHT');
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [food, setFood] = useState<Food | null>(null);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [intervalMs, setIntervalMs] = useState<number>(DEFAULT_INTERVAL);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [trail, setTrail] = useState<Position[]>([]);

  // Acceleration state
  const accelRef = useRef<boolean>(false);
  const accelTimerRef = useRef<number | null>(null);

  // Hedgehog
  const [hedgehog, setHedgehog] = useState<{ pos: Position; active: boolean } | null>(null);
  const hedgehogTimerRef = useRef<number | null>(null);

  // CSS class to reduce hover effects on obstacles
  const DISABLE_HOVER_CLASS = 'dom-snake-disable-hover';

  // --- Grid setup and DOM scanning ---
  const updateGrid = useCallback(() => {
    const width = Math.max(10, Math.floor(window.innerWidth / CELL_SIZE));
    const playablePx = Math.floor(window.innerHeight * PLAY_AREA_RATIO);
    const height = Math.max(6, Math.floor(playablePx / CELL_SIZE));
    setGrid({ width, height });
  }, []);

  const scanDOMForObstacles = useCallback(() => {
    const selectors = ['header','nav','img','button','a','.gamify-card','h1','h2','h3','footer','[class*="Card"]','[class*="Badge"]'];
    const found: Obstacle[] = [];
    const playHeightPx = Math.floor(window.innerHeight * PLAY_AREA_RATIO);

    selectors.forEach((sel: string) => {
      document.querySelectorAll(sel).forEach((el) => {
        const html = el as HTMLElement;
        if (html.closest('#dom-snake-overlay')) return;
        const r = html.getBoundingClientRect();
        if (r.width > 20 && r.height > 20 && r.top < playHeightPx) {
          found.push({
            x: Math.floor((r.left + window.scrollX) / CELL_SIZE),
            y: Math.floor((r.top + window.scrollY) / CELL_SIZE),
            width: Math.ceil(r.width / CELL_SIZE),
            height: Math.ceil(r.height / CELL_SIZE),
            element: html,
          });
        }
      });
    });

    setObstacles(found);
  }, []);

  useEffect(() => {
    updateGrid();
    scanDOMForObstacles();
    window.addEventListener('resize', updateGrid);
    window.addEventListener('resize', scanDOMForObstacles);
    return () => {
      window.removeEventListener('resize', updateGrid);
      window.removeEventListener('resize', scanDOMForObstacles);
    };
  }, [updateGrid, scanDOMForObstacles]);

  // High score
  useEffect(() => { const s = localStorage.getItem('domSnakeHighScore'); if (s) setHighScore(parseInt(s, 10)); }, []);
  useEffect(() => { if (score > highScore) { setHighScore(score); localStorage.setItem('domSnakeHighScore', String(score)); } }, [score, highScore]);

  // --- Helpers ---
  const isInsideObstacle = useCallback((p: Position) => {
    return obstacles.some((o: Obstacle) => p.x >= o.x && p.x < o.x + o.width && p.y >= o.y && p.y < o.y + o.height);
  }, [obstacles]);

  const findSafePosition = useCallback((avoid: Position[] = []): Position | null => {
    for (let i = 0; i < 300; i++) {
      const x = Math.floor(Math.random() * grid.width);
      // ensure food/spawn only in the play area (0..grid.height-1)
      const y = Math.floor(Math.random() * grid.height);
      if (avoid.some((a: Position) => a.x === x && a.y === y)) continue;
      if (isInsideObstacle({ x, y })) continue;
      return { x, y };
    }
    return null;
  }, [grid.width, grid.height, isInsideObstacle]);

  // Food generation with weighted types
  const generateFood = useCallback((currentSnake: Position[]): Food | null => {
    const p = findSafePosition(currentSnake);
    if (!p) return null;
    const r = Math.random();
    if (r < 0.6) return { ...p, type: 'apple', label: '🍎' };
    if (r < 0.8) return { ...p, type: 'money', label: MONEY_BAGS[Math.floor(Math.random() * MONEY_BAGS.length)] };
    if (r < 0.92) return { ...p, type: 'rising', label: STOCK_TICKERS[Math.floor(Math.random() * STOCK_TICKERS.length)] };
    if (r < 0.98) return { ...p, type: 'dropping', label: STOCK_TICKERS[Math.floor(Math.random() * STOCK_TICKERS.length)] };
    return { ...p, type: 'bonus', label: '💎' };
  }, [findSafePosition]);

  // Minimal sound helper
  const playSound = useCallback((freq: number, dur: number) => {
    if (!soundEnabled) return;
    try {
      const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination); o.frequency.value = freq; o.type = 'square'; g.gain.setValueAtTime(0.06, ac.currentTime); o.start(); o.stop(ac.currentTime + dur);
    } catch (e) { /* ignore */ }
  }, [soundEnabled]);

  // --- Hedgehog ---
  const spawnHedgehog = useCallback(() => {
    const p = findSafePosition(snake) || { x: 0, y: 0 };
    setHedgehog({ pos: p, active: true });
  }, [findSafePosition, snake]);

  useEffect(() => {
    if (!isPlaying) return;
    hedgehogTimerRef.current = window.setInterval(() => {
      if (Math.random() < 0.12 && !hedgehog) spawnHedgehog();
    }, 4500);
    return () => { if (hedgehogTimerRef.current) clearInterval(hedgehogTimerRef.current); hedgehogTimerRef.current = null; };
  }, [isPlaying, hedgehog, spawnHedgehog]);

  // --- Game loop (tick) ---
  const tickRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isPlaying || isPaused || gameOver) return;
    tickRef.current = window.setInterval(() => {
      setSnake((prev: Position[]) => {
        if (prev.length === 0) return prev;
        const head = prev[0];
        const dir = nextDirection.current;
        let newHead: Position = { x: head.x, y: head.y };
        if (dir === 'UP') newHead = { x: head.x, y: head.y - 1 };
        if (dir === 'DOWN') newHead = { x: head.x, y: head.y + 1 };
        if (dir === 'LEFT') newHead = { x: head.x - 1, y: head.y };
        if (dir === 'RIGHT') newHead = { x: head.x + 1, y: head.y };

        // Wrap-around
        newHead.x = (newHead.x + grid.width) % grid.width;
        newHead.y = (newHead.y + grid.height) % grid.height;

        // No DOM bumping: obstacles are non-blocking and won't be modified
        // (Previously we animated element transforms here; removed to prevent shaking toolbars/icons.)

        // Self-collision only
        if (prev.some((seg: Position, idx: number) => idx > 0 && seg.x === newHead.x && seg.y === newHead.y)) {
          setGameOver(true); setIsPlaying(false); playSound(200, 0.35); return prev;
        }

        const newSnake = [newHead, ...prev];

        // Trail
        setTrail((t: Position[]) => [head, ...t].slice(0, TRAIL_LENGTH));

        // Food detection (improved): accept within 1 cell
        if (food) {
          const dx = Math.abs(newHead.x - food.x);
          const dy = Math.abs(newHead.y - food.y);
          if (dx <= 1 && dy <= 1) {
            let pts = 0;
            switch (food.type) {
              case 'apple': pts = 1; break;
              case 'money': pts = 2; break;
              case 'rising': pts = 10; break;
              case 'dropping': pts = -15; break;
              case 'bonus': pts = 20; break;
            }
            setScore((s: number) => Math.max(0, s + pts));
            setFood(generateFood(newSnake));
            playSound(food.type === 'bonus' ? 900 : 700, 0.1);
            setIntervalMs((i: number) => clamp(i - 8, MIN_INTERVAL, DEFAULT_INTERVAL));
            // grow (do not pop)
          } else {
            newSnake.pop();
          }
        } else {
          newSnake.pop();
        }

        // Hedgehog movement (chase)
        if (hedgehog && hedgehog.active) {
          const h = hedgehog.pos;
          const dx = Math.sign(newSnake[0].x - h.x);
          const dy = Math.sign(newSnake[0].y - h.y);
          const newHp = { x: (h.x + dx + grid.width) % grid.width, y: (h.y + dy + grid.height) % grid.height };
          setHedgehog({ pos: newHp, active: true });
          if (newHp.x === newSnake[0].x && newHp.y === newSnake[0].y) {
            setGameOver(true); setIsPlaying(false); playSound(120, 0.5);
          }
        }

        return newSnake;
      });
    }, intervalMs);

    return () => { if (tickRef.current) clearInterval(tickRef.current); tickRef.current = null; };
  }, [isPlaying, isPaused, gameOver, grid.width, grid.height, obstacles, food, hedgehog, generateFood, playSound, intervalMs]);

  // --- Keyboard handling: direction queue + hold-to-accelerate ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // When playing, prevent arrow keys/space from scrolling the page
      if (isPlaying && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space',' '].includes(e.code || e.key)) {
        try { e.preventDefault(); } catch {}
      }
      if (e.code === 'Escape') { e.preventDefault(); onClose?.(); return; }
      if (gameOver) return;
      if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); if (isPlaying) setIsPaused((p: boolean) => !p); else startGame(); return; }

      const key = e.key.toLowerCase();
      let nd: Direction | null = null;
      if (key === 'arrowup' || key === 'w') nd = 'UP';
      if (key === 'arrowdown' || key === 's') nd = 'DOWN';
      if (key === 'arrowleft' || key === 'a') nd = 'LEFT';
      if (key === 'arrowright' || key === 'd') nd = 'RIGHT';

      if (nd) {
        // queue direction (prevents immediate reverse)
        const cur = direction;
        if (!(cur === 'UP' && nd === 'DOWN') && !(cur === 'DOWN' && nd === 'UP') && !(cur === 'LEFT' && nd === 'RIGHT') && !(cur === 'RIGHT' && nd === 'LEFT')) {
          nextDirection.current = nd;
        }

        // acceleration while holding
        accelRef.current = true;
        if (accelTimerRef.current) window.clearInterval(accelTimerRef.current as number);
        accelTimerRef.current = window.setInterval(() => {
          setIntervalMs((i: number) => clamp(i - ACCEL_STEP, MIN_INTERVAL, DEFAULT_INTERVAL));
        }, 120) as unknown as number;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(key)) {
        // prevent one-off scrolls when key is released
        if (isPlaying) try { e.preventDefault(); } catch {}
        accelRef.current = false;
        if (accelTimerRef.current) { clearInterval(accelTimerRef.current); accelTimerRef.current = null; }
        setIntervalMs((i: number) => clamp(i + ACCEL_STEP, MIN_INTERVAL, DEFAULT_INTERVAL));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [direction, isPlaying, isPaused, gameOver, onClose]);

  // Apply queued direction between ticks
  useEffect(() => {
    const id = window.setInterval(() => {
      setDirection((d: Direction) => {
          const nd = nextDirection.current as Direction;
          if (d === 'UP' && nd === 'DOWN') return d;
          if (d === 'DOWN' && nd === 'UP') return d;
          if (d === 'LEFT' && nd === 'RIGHT') return d;
          if (d === 'RIGHT' && nd === 'LEFT') return d;
          return nd;
        });
    }, Math.max(30, intervalMs));
    return () => clearInterval(id);
  }, [intervalMs]);

  // --- Start / Stop / Helpers exposed for potential external triggers (eg. "hiss") ---
  const startGame = useCallback(() => {
    scanDOMForObstacles();
    const start = { x: Math.floor(grid.width / 2), y: Math.max(0, grid.height - 2) };
    setSnake([start]);
    setTrail([]);
    setDirection('RIGHT');
    nextDirection.current = 'RIGHT';
    // Try to generate food; fallback to center if none found to ensure food always appears
    const f = generateFood([start]);
  if (f) { console.debug('[DOMSnake] spawn food on start', f); setFood(f); }
  else { const fallback: Food = { x: Math.floor(grid.width / 2), y: Math.floor(grid.height / 2), type: 'apple', label: '🍎' }; console.debug('[DOMSnake] spawn fallback food on start', fallback); setFood(fallback); }
    setScore(0);
    setIntervalMs(DEFAULT_INTERVAL);
    setIsPlaying(true);
    setIsPaused(false);
    setGameOver(false);
    setHedgehog(null);
  }, [grid.width, grid.height, generateFood, scanDOMForObstacles]);

  // Expose startGame on window so existing "hiss" activation elsewhere can call it
  useEffect(() => { (window as any).startDOMSnake = startGame; return () => { try { delete (window as any).startDOMSnake; } catch {} }; }, [startGame]);

  // --- Draw ---
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
    // Compute play area pixel sizes
    const playH = Math.floor(window.innerHeight * PLAY_AREA_RATIO);
    const widthPx = Math.floor(grid.width * CELL_SIZE);
    const dpr = window.devicePixelRatio || 1;

    // Set the displayed size (CSS) and internal buffer (pixels)
    canvas.style.width = `${widthPx}px`;
    canvas.style.height = `${playH}px`;
    canvas.width = Math.max(1, Math.floor(widthPx * dpr));
    canvas.height = Math.max(1, Math.floor(playH * dpr));
    // Reset transform to devicePixelRatio so drawing uses CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clip to play area
    ctx.clearRect(0, 0, widthPx, playH);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, widthPx, playH); ctx.clip();

    // No visible borders or overlays: canvas blends into the page
    if (isPlaying) { ctx.fillStyle = 'rgba(0,0,0,0.01)'; ctx.fillRect(0, 0, widthPx, playH); }

    // trail
    for (let i = 0; i < trail.length; i++) {
      const s = trail[i]; const alpha = (1 - i / TRAIL_LENGTH) * 0.3; ctx.fillStyle = `rgba(167,139,250,${alpha})`; ctx.fillRect(s.x * CELL_SIZE + 2, s.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    }

    // snake
    for (let i = 0; i < snake.length; i++) {
      const s = snake[i]; ctx.save(); if (i === 0) { ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 18; const g = ctx.createLinearGradient(s.x * CELL_SIZE, s.y * CELL_SIZE, s.x * CELL_SIZE + CELL_SIZE, s.y * CELL_SIZE + CELL_SIZE); g.addColorStop(0, '#e0d5ff'); g.addColorStop(1, '#a78bfa'); ctx.fillStyle = g; } else { const op = 1 - (i / snake.length) * 0.4; ctx.fillStyle = `rgba(196,181,253,${op})`; } ctx.fillRect(s.x * CELL_SIZE + 1, s.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2); ctx.restore();
    }

    // food (draw high-contrast background circle then label)
    if (food) {
      const cx = food.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = food.y * CELL_SIZE + CELL_SIZE / 2;
      ctx.save();
      // background circle
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(6, CELL_SIZE * 0.45), 0, Math.PI * 2);
      if (food.type === 'dropping') ctx.fillStyle = '#7f1d1d';
      else if (food.type === 'rising') ctx.fillStyle = '#064e3b';
      else ctx.fillStyle = '#111827';
      ctx.fill();
      // label
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; if (food.type === 'rising' || food.type === 'dropping') { ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#ffffff'; ctx.fillText(food.label, cx, cy); } else { ctx.font = 'bold 18px serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(food.label, cx, cy); }
      ctx.restore();
    }

  // hedgehog
    if (hedgehog && hedgehog.active) { const h = hedgehog.pos; ctx.save(); ctx.fillStyle = '#8b5cf6'; ctx.fillRect(h.x * CELL_SIZE + 2, h.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4); ctx.restore(); }

    ctx.restore();
  }, [snake, trail, food, isPlaying, hedgehog]);

  // Ensure food exists periodically if none present
  useEffect(() => {
    if (!isPlaying) return;
    if (!food) {
      const f = generateFood(snake);
      if (f) setFood(f);
      else {
        // fallback: place food at center of play area
        setFood({ x: Math.floor(grid.width / 2), y: Math.floor(grid.height / 2), type: 'apple', label: '🍎' });
      }
    }
    const id = window.setInterval(() => {
      if (!food) {
        const f = generateFood(snake);
        if (f) setFood(f);
      }
    }, 1500);
    return () => clearInterval(id);
  }, [isPlaying, food, generateFood, grid.width, grid.height, snake]);

  // Disable hover transitions on obstacle elements (non-destructive CSS class)
  useEffect(() => {
    // Inject CSS once
    const styleId = 'dom-snake-disable-hover-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style'); style.id = styleId; style.innerHTML = `.${DISABLE_HOVER_CLASS}:hover{ transition:none !important; transform:none !important; box-shadow:none !important; filter:none !important; }`;
      document.head.appendChild(style);
    }
    obstacles.forEach((o: Obstacle) => { try { o.element.classList.add(DISABLE_HOVER_CLASS); } catch {} });
    return () => { obstacles.forEach((o: Obstacle) => { try { o.element.classList.remove(DISABLE_HOVER_CLASS); } catch {} }); };
  }, [obstacles]);

  // Minimal UI and controls
  return (
    <div id="dom-snake-overlay" ref={overlayRef} className="fixed inset-0 z-[9999] pointer-events-none">
  {/* No dimming overlay; canvas should sit naturally in the top section */}
  <canvas ref={canvasRef} className="absolute top-0 left-0 pointer-events-none" style={{ width: '100%', height: `${Math.floor(window.innerHeight * PLAY_AREA_RATIO)}px` }} />

      <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-3 pointer-events-auto">
        <div className="flex items-center gap-3 px-6 py-3 rounded-xl backdrop-blur-xl bg-black/60 border border-purple-500/30 shadow-2xl shadow-purple-500/20">
          <Badge className="bg-gradient-to-r from-purple-600 to-purple-500 px-3 py-1 shadow-lg shadow-purple-500/50">Score: {score}</Badge>
          <Badge variant="outline" className="border-purple-400/50 text-purple-300 px-3 py-1 backdrop-blur-sm bg-purple-500/10"><Trophy className="w-3 h-3 mr-1" />Best: {highScore}</Badge>
          <div className="flex items-center gap-2 ml-2">
            <Button variant="ghost" size="sm" onClick={() => setSoundEnabled((s:boolean) => !s)} className="text-purple-300 hover:text-purple-200 hover:bg-white/10 h-8 w-8 p-0">{soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}</Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-purple-300 hover:text-purple-200 hover:bg-white/10 h-8 w-8 p-0"><X className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] pointer-events-auto">
        <div className="flex items-center gap-3 px-6 py-3 rounded-xl backdrop-blur-xl bg-black/60 border border-purple-500/30 shadow-2xl shadow-purple-500/20">
          {!isPlaying || gameOver ? (
            <Button onClick={() => startGame()} className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 shadow-lg shadow-purple-500/50"><Play className="w-4 h-4 mr-2" />{gameOver ? 'Restart' : 'Start Game'}</Button>
          ) : (
            <Button onClick={() => setIsPaused((p:boolean) => !p)} variant="outline" className="border-purple-400/50 text-purple-300 hover:bg-white/10">{isPaused ? <><Play className="w-4 h-4 mr-2" />Resume</> : <><Pause className="w-4 h-4 mr-2" />Pause</>}</Button>
          )}
          <div className="text-xs text-purple-300/80 ml-2">{isPlaying ? 'Hold arrow to speed • 🍎 +1 • 💰 +2 • 📈 +10 • 📉 -15' : 'Arrow keys or WASD to move'}</div>
        </div>
      </div>

      {gameOver && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center pointer-events-auto">
          <div className="backdrop-blur-2xl bg-black/80 border border-purple-500/50 rounded-3xl p-10 shadow-2xl shadow-purple-500/30 max-w-md mx-4">
            <h2 className="text-purple-300 mb-4 text-center">💥 Game Over!</h2>
            <p className="text-purple-200 mb-2 text-center">Final Score: {score}</p>
            {score === highScore && score > 0 && (<p className="text-yellow-400 text-sm mb-6 text-center">🏆 New High Score!</p>)}
            <Button onClick={() => startGame()} className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 shadow-lg shadow-purple-500/50"><RotateCcw className="w-5 h-5 mr-2" />Play Again</Button>
            <Button onClick={onClose} variant="outline" className="w-full mt-3 border-purple-400/50 text-purple-300 hover:bg-white/10">Exit Game</Button>
          </div>
        </div>
      )}
    </div>
  );
}
