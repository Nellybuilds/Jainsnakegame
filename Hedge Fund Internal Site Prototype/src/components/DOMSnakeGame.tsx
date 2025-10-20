import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Play, Pause, RotateCcw, Trophy, Volume2, VolumeX, X } from 'lucide-react';

// Types
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type FoodType = 'apple' | 'money' | 'rising' | 'dropping' | 'bonus';

// Food item with animation + movement metadata
interface Food extends Position { id: string; type: FoodType; label: string; spawnAt: number; lastMoveAt: number; target?: Position; moveStart?: number; moveDuration?: number; consumedAt?: number }
interface Obstacle { x: number; y: number; width: number; height: number; element: HTMLElement }
interface DOMSnakeGameProps { onClose?: () => void }

// Config
const CELL_SIZE = 12;
const DEFAULT_INTERVAL = 120; // ms
const ACCEL_STEP = 10; // ms faster per accel tick
const MIN_INTERVAL = 30; // fastest
const TRAIL_LENGTH = 15;
// Use the full viewport height for the play area (unconditional full-page mode)
const PLAY_AREA_RATIO = 1.0;

const STOCK_TICKERS = ['AAPL','SBUX','TSLA','MSFT','AMZN','GOOGL','META','NVDA','NFLX','AMD'];
const MONEY_BAGS = ['💰','💵','💸','💎','🏆'];

const clamp = (v:number,a:number,b:number) => Math.max(a, Math.min(b, v));

// Visual tuning constants (easy to tweak)
// Increase snake visibility: reduce inset so painted segment fills more of the cell.
const SNAKE_DRAW_INSET = 0.25; // smaller inset -> larger visible snake in cell
// Make the snake visually integrate with the page: green (invasive) palette
const SNAKE_OUTLINE_COLOR = '#08320a'; // dark green outline
const SNAKE_BRIGHT_GRADIENT_START = '#eaffea';
const SNAKE_BRIGHT_GRADIENT_END = '#2ecc71';
// HEAD_SCALE controls the radius used for hit detection (visual-to-hit mapping)
const HEAD_SCALE = 1.0; // use full-cell visual size for head collision
// Make foods (stocks) smaller than the snake head by lowering the factor
const FOOD_RADIUS_FACTOR = 0.26; // multiply by CELL_SIZE (smaller than before)
const FOOD_RADIUS_MIN = 3;

export function DOMSnakeGame({ onClose }: DOMSnakeGameProps) {
  // Refs and canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Game state
  const [grid, setGrid] = useState<{width:number;height:number}>({ width: 40, height: 20 });
  const [snake, setSnake] = useState<Position[]>([]);
  const nextDirection = useRef<Direction>('RIGHT');
  const [direction, setDirection] = useState<Direction>('RIGHT');
  // multiple foods on screen (max 5)
  const [foods, setFoods] = useState<Food[]>([]);
  const foodsRef = useRef<Food[]>([]);
  useEffect(() => { foodsRef.current = foods; }, [foods]);
  const [animTime, setAnimTime] = useState<number>(0);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const totalEatenRef = useRef<number>(0);
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
  // food spawn counters for hedgehog events
  const foodSpawnCounterRef = useRef<number>(0);
  // schedule hedgehog after 5-6 spawns to reduce aggressiveness
  const nextHedgehogAtRef = useRef<number>(Math.floor(Math.random() * 2) + 5); // 5-6
  const rafRef = useRef<number | null>(null);
  // growth queue: number of extra ticks to keep tail (snake grows by avoiding pops)
  const growRef = useRef<number>(0);
  // hedgehog chase timeout (ms)
  const HEDGEHOG_CHASE_TIMEOUT = 4000; // shorter chase
  const HEDGEHOG_MOVE_INTERVAL = 400; // slower movement

  // Stock lifespan: auto-remove unconsumed stock items after this many ms
  const STOCK_LIFESPAN_MS = 15000; // 15 seconds

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

  const findSafePosition = useCallback((avoid: Position[] = [], margin = 2): Position | null => {
    // avoid edges by margin cells
    const minX = margin; const maxX = Math.max(minX, grid.width - 1 - margin);
    const minY = margin; const maxY = Math.max(minY, grid.height - 1 - margin);
    for (let i = 0; i < 500; i++) {
      const x = Math.floor(Math.random() * (maxX - minX + 1)) + minX;
      const y = Math.floor(Math.random() * (maxY - minY + 1)) + minY;
      if (avoid.some((a: Position) => a.x === x && a.y === y)) continue;
      if (isInsideObstacle({ x, y })) continue;
      return { x, y };
    }
    return null;
  }, [grid.width, grid.height, isInsideObstacle]);

  // Food generation with weighted types
  // Generate a single Food item (with id + timestamps)
  const generateFood = useCallback((currentSnake: Position[], forcedType?: FoodType): Food | null => {
    const p = findSafePosition(currentSnake, 2);
    if (!p) return null;
    const r = Math.random();
    let type: FoodType;
    if (forcedType) type = forcedType;
    // Adjusted spawn weights: increase the chance of stock items (rising/dropping)
    // so players encounter them more often. Tuned to keep randomness while
    // boosting stocks relative to neutral foods.
    // Distribution (example): apple 45% | money 20% | rising 25% | dropping 10%
    else if (r < 0.45) type = 'apple';
    else if (r < 0.65) type = 'money';
    else if (r < 0.90) type = 'rising';
    else type = 'dropping';

    let label = '🍎';
    if (type === 'money') label = MONEY_BAGS[Math.floor(Math.random() * MONEY_BAGS.length)];
    if (type === 'rising' || type === 'dropping') label = STOCK_TICKERS[Math.floor(Math.random() * STOCK_TICKERS.length)];

    const now = Date.now();
    return { id: `${now}-${Math.floor(Math.random() * 9999)}`, x: p.x, y: p.y, type, label, spawnAt: now, lastMoveAt: now };
  }, [findSafePosition]);

  // Spawn a food into foods[] with caps and rules (cap lower for cleaner gameplay)
  const spawnFood = useCallback((forcedType?: FoodType) => {
    setFoods((prev) => {
      const cap = 3; // max visible foods
      if (prev.length >= cap) return prev;
      const occupied = prev.map(f => ({ x: f.x, y: f.y }));
      // bias: prefer neutral spawn if too few neutrals
      const neutrals = prev.filter(p => p.type === 'apple' || p.type === 'money');
      // Reduce neutral preference so stocks have a better chance to appear.
      // Previously this heavily favored neutral items (70%); lower to 50%.
      let preferNeutral = neutrals.length === 0 || Math.random() < 0.5;
      if (forcedType) preferNeutral = (forcedType === 'apple' || forcedType === 'money');
      const f = generateFood(occupied as Position[], preferNeutral ? 'apple' : undefined);
      if (!f) return prev;
      return [...prev, f];
    });
  }, [generateFood]);

  // RAF loop: drives animations and schedules movement for high-value foods
  useEffect(() => {
    let mounted = true;
  // Base interval for high-value stocks to re-position. We slow this down so
  // 'rising' and 'dropping' stocks move more slowly across the board.
  const moveInterval = 4500; // ms base for high-value repositions (slower)
    const loop = () => {
      if (!mounted) return;
      const now = Date.now();
      setAnimTime(now);

      // Schedule occasional reposition for rising/dropping foods
      setFoods((prev) => {
        let changed = false;
        const out = prev.map((f) => {
          if ((f.type === 'rising' || f.type === 'dropping')) {
            if (!f.target && now - f.lastMoveAt > moveInterval + Math.random() * 2000) {
              // Choose a safe target and set a move duration based on type.
              // Stocks (rising/dropping) should move slowly; high-value stocks get
              // slightly longer, smoother moves so players can react.
              const target = findSafePosition(prev.map(p => ({ x: p.x, y: p.y })), 2) || { x: f.x, y: f.y };
              changed = true;
              const baseDur = f.type === 'rising' || f.type === 'dropping' ? 1400 : 900;
              const extra = f.type === 'rising' ? 800 : 500; // give rising a slightly longer glide
              return { ...f, target, moveStart: now, moveDuration: baseDur + Math.floor(Math.random() * extra) } as Food;
            }
            // if it has a target and moveStart completed, finalize
            if (f.target && f.moveStart && f.moveDuration && now - f.moveStart >= f.moveDuration) {
              changed = true;
              return { ...f, x: f.target.x, y: f.target.y, target: undefined, moveStart: undefined, moveDuration: undefined, lastMoveAt: now } as Food;
            }
          }
          return f;
        });
        // Remove any unconsumed stock that lived longer than STOCK_LIFESPAN_MS
        const filtered = out.filter((f) => {
          if (f.consumedAt) return true; // keep consumed items until animation completes
          return Date.now() - f.spawnAt <= STOCK_LIFESPAN_MS;
        });
        return changed || filtered.length !== prev.length ? filtered : prev;
      });

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { mounted = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
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
    // Spawn hedgehog at a safe location; attach a timestamp for limited chase
    const p = findSafePosition(snake) || { x: 0, y: 0 };
    setHedgehog({ pos: p, active: true });
    // stop hedgehog after timeout
    window.setTimeout(() => { setHedgehog((h) => h ? { ...h, active: false } : h); }, HEDGEHOG_CHASE_TIMEOUT);
  }, [findSafePosition, snake]);

  // Hedgehog background spawner (keeps minimal frequency but also respects food-based scheduling)
  useEffect(() => {
    if (!isPlaying) return;
    hedgehogTimerRef.current = window.setInterval(() => {
      // Rare background spawn (safety net)
      if (Math.random() < 0.04 && !hedgehog) spawnHedgehog();
    }, 8000);
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

  // Food detection: use circle-based hit test between head center and food center.
  // We treat the snake head and the food as circles (pixels) so the hitbox matches
  // the visual sizes (SNAKE_DRAW_INSET, HEAD_SCALE, FOOD_RADIUS_FACTOR).
  // When a hit is detected we:
  //  1. mark the food with `consumedAt` (keeps it available for a short consume animation),
  //  2. schedule removal after a short delay (so the eat animation plays),
  //  3. award points and growth immediately, and
  //  4. schedule a replacement spawn.
  // This keeps animations (pulsing/movement) intact until the food is visually removed.
  let ateAny = false;
  setFoods((prevFoods) => {
          const headCx = newHead.x * CELL_SIZE + CELL_SIZE / 2;
          const headCy = newHead.y * CELL_SIZE + CELL_SIZE / 2;
          // head radius in pixels (approximate based on visual head scale and inset)
          // We subtract SNAKE_DRAW_INSET so the radius corresponds to the painted segment area.
          const headRadius = Math.max(2, (CELL_SIZE * HEAD_SCALE) / 2 - SNAKE_DRAW_INSET);

          for (const f of prevFoods) {
            const foodCx = f.x * CELL_SIZE + CELL_SIZE / 2;
            const foodCy = f.y * CELL_SIZE + CELL_SIZE / 2;
            // food base radius (conservative, ignore spawn pulse here)
            const foodRadius = Math.max(FOOD_RADIUS_MIN, CELL_SIZE * FOOD_RADIUS_FACTOR);
            const dx = headCx - foodCx; const dy = headCy - foodCy;
            const dist2 = dx * dx + dy * dy;
            const hitRadius = headRadius + foodRadius;
            // If the squared distance between centers is less than squared hit radius => collision
            if (dist2 <= hitRadius * hitRadius) {
              // Scoring: define points per food type. Rising stocks are high-value.
              let pts = 0;
              switch (f.type) {
                case 'apple': pts = 1; break; // simple +1
                case 'money': pts = 2; break; // small bonus
                case 'rising': pts = 10; break; // high-value stock
                case 'dropping': pts = -15; break; // negative stock
                case 'bonus': pts = 20; break; // rare large bonus
              }
              // Growth logic: how many segments the snake should grow when eating
              // - apple/money: +1
              // - rising (high-value): +2
              // - dropping (negative): 0 (no growth)
              let growth = 0;
              if (f.type === 'apple' || f.type === 'money') growth = 1;
              if (f.type === 'rising') growth = 2;
              if (f.type === 'dropping') growth = 0;
              growRef.current = (growRef.current || 0) + growth;
              setScore((s: number) => Math.max(0, s + pts));
              playSound(f.type === 'bonus' ? 900 : 700, 0.1);
              setIntervalMs((i: number) => clamp(i - 8, MIN_INTERVAL, DEFAULT_INTERVAL));

              // Mark the food as consumed (store timestamp) so the draw loop can play a
              // short shrink/fade animation. We still keep the item in `foods` until
              // the removal timeout completes so movement/pulse continue until it's gone.
              const now = Date.now();
              const marked = prevFoods.map(p => p.id === f.id ? { ...p, consumedAt: now } : p);
              // Remove the consumed food after a short delay (260ms) to allow the
              // consumption animation to play and to avoid instantaneous disappearance.
              setTimeout(() => { setFoods((later) => later.filter(p => p.id !== f.id)); }, 260);
              setTimeout(() => spawnFood(), 150);
              foodSpawnCounterRef.current = (foodSpawnCounterRef.current || 0) + 1;
              totalEatenRef.current = (totalEatenRef.current || 0) + 1;
              const newLevel = Math.floor(totalEatenRef.current / 5) + 1;
              if (newLevel > level) {
                setLevel(newLevel);
                setIntervalMs((i: number) => clamp(i - 8, MIN_INTERVAL, DEFAULT_INTERVAL));
              }
              if ((foodSpawnCounterRef.current || 0) >= (nextHedgehogAtRef.current || 5)) {
                spawnHedgehog();
                foodSpawnCounterRef.current = 0;
                nextHedgehogAtRef.current = Math.floor(Math.random() * 2) + 5;
              }
              ateAny = true;
              return marked;
            }
          }
          return prevFoods;
        });

        // Apply growth: if growRef > 0, do not pop tail (grow by retaining tail)
        if (!ateAny) {
          if (growRef.current && growRef.current > 0) {
            // consume one growth unit, i.e., keep tail for this tick
            growRef.current = Math.max(0, growRef.current - 1);
          } else {
            newSnake.pop();
          }
        }

        // Hedgehog movement (chase) - use a slower movement cadence
        if (hedgehog && hedgehog.active) {
          // perform movement only on a slower interval relative to snake tick
          const now = Date.now();
          const lastMove = (hedgehog as any).lastMoveAt || 0;
          if (now - lastMove > HEDGEHOG_MOVE_INTERVAL) {
            const h = hedgehog.pos;
            const dx = Math.sign(newSnake[0].x - h.x);
            const dy = Math.sign(newSnake[0].y - h.y);
            const newHp = { x: (h.x + dx + grid.width) % grid.width, y: (h.y + dy + grid.height) % grid.height };
            setHedgehog({ pos: newHp, active: true, lastMoveAt: now } as any);
            if (newHp.x === newSnake[0].x && newHp.y === newSnake[0].y) {
              setGameOver(true); setIsPlaying(false); playSound(120, 0.5);
            }
          }
        }

        return newSnake;
      });
    }, intervalMs);

    return () => { if (tickRef.current) clearInterval(tickRef.current); tickRef.current = null; };
    }, [isPlaying, isPaused, gameOver, grid.width, grid.height, obstacles, foods, hedgehog, generateFood, playSound, intervalMs]);

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
    // Clear and spawn a couple of initial foods (ensures at least one neutral)
    setFoods([]);
    // spawn neutral first (apple) then a secondary
    spawnFood('apple');
    setTimeout(() => spawnFood(), 60);
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

    // snake (draw larger, brighter body with subtle outline)
    for (let i = 0; i < snake.length; i++) {
      const s = snake[i]; ctx.save();
      const inset = SNAKE_DRAW_INSET;
      const x = s.x * CELL_SIZE + inset;
      const y = s.y * CELL_SIZE + inset;
      const w = CELL_SIZE - inset * 2;
      const h = CELL_SIZE - inset * 2;
      if (i === 0) {
        // head: make it bright green and give it a subtle bite/mouth when consuming
        ctx.shadowColor = 'rgba(34,139,34,0.25)'; ctx.shadowBlur = 14;
        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, SNAKE_BRIGHT_GRADIENT_START); g.addColorStop(1, SNAKE_BRIGHT_GRADIENT_END);
        ctx.fillStyle = g;
        ctx.lineWidth = 1.2; ctx.strokeStyle = SNAKE_OUTLINE_COLOR;
        // head shape with mouth: draw rounded rect then a triangular mouth when recently ate
        const radius = 3;
        ctx.beginPath(); ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // mouth animation: if the first food in foods was just consumed (recent pulse) show mouth
        const recentEat = foods.some(f => f.consumedAt && (animTime - f.consumedAt) < 260);
        if (recentEat) {
          ctx.save(); ctx.fillStyle = '#08320a';
          // simple triangular mouth pointing in movement direction
          const cx = x + w/2; const cy = y + h/2;
          ctx.beginPath();
          if (direction === 'LEFT') { ctx.moveTo(x+4, cy); ctx.lineTo(x+8, cy-6); ctx.lineTo(x+8, cy+6); }
          else if (direction === 'RIGHT') { ctx.moveTo(x+w-4, cy); ctx.lineTo(x+w-8, cy-6); ctx.lineTo(x+w-8, cy+6); }
          else if (direction === 'UP') { ctx.moveTo(cx, y+4); ctx.lineTo(cx-6, y+8); ctx.lineTo(cx+6, y+8); }
          else { ctx.moveTo(cx, y+h-4); ctx.lineTo(cx-6, y+h-8); ctx.lineTo(cx+6, y+h-8); }
          ctx.closePath(); ctx.fill(); ctx.restore();
        }
      } else {
        const op = 1 - (i / snake.length) * 0.45; ctx.fillStyle = `rgba(46,139,87,${op})`;
        ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        const radius = 2.5;
        ctx.beginPath(); ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    // foods (draw each with spawn animation and optional movement interpolation)
    for (let fi = 0; fi < foods.length; fi++) {
      const foodItem = foods[fi];
      // compute animation scale (spawn bounce)
      const age = Math.max(0, animTime - foodItem.spawnAt);
      const spawnScale = Math.min(1, age / 220);

      // compute interpolated position if moving
      let fx = foodItem.x;
      let fy = foodItem.y;
      if (foodItem.target && foodItem.moveStart && foodItem.moveDuration) {
        const t = clamp((animTime - foodItem.moveStart) / foodItem.moveDuration, 0, 1);
        fx = Math.round(foodItem.x * (1 - t) + foodItem.target.x * t);
        fy = Math.round(foodItem.y * (1 - t) + foodItem.target.y * t);
      }

      const cx = fx * CELL_SIZE + CELL_SIZE / 2;
      const cy = fy * CELL_SIZE + CELL_SIZE / 2;
      ctx.save();
      // pulse for high-value
      const pulse = ((Math.sin(animTime / 250 + fi) + 1) / 2) * 0.08 + 0.96;
  // Base radius for the food (before spawn pulse and/or consumed animation)
  const baseRadius = Math.max(FOOD_RADIUS_MIN, CELL_SIZE * FOOD_RADIUS_FACTOR);
  // If the food was just consumed, animate a quick shrink+fade. Keep it visually
  // present for a short moment (consumedFadeMs) to make the eat action more clear.
  const consumedFadeMs = 220;
  // Stocks should have a stronger pulse to attract attention.
  const isStock = foodItem.type === 'rising' || foodItem.type === 'dropping';
  const stockPulseAmpl = isStock ? 1.18 : 1.0;
  let radius = baseRadius * spawnScale * pulse * stockPulseAmpl;
  let alpha = 0.98;
  if (foodItem.consumedAt) {
    const since = Math.max(0, animTime - foodItem.consumedAt);
    const t = clamp(since / consumedFadeMs, 0, 1);
    // shrink and fade out over the consumedFadeMs window
    radius = radius * (1 - t);
    alpha = 0.98 * (1 - t);
  }
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.5, radius), 0, Math.PI * 2);
  // Use Jain Global brand-like bright colors for stocks
  if (foodItem.type === 'dropping') ctx.fillStyle = '#F44336'; // bright red for falling
  else if (foodItem.type === 'rising') ctx.fillStyle = '#4CAF50'; // bright green for rising
  else ctx.fillStyle = '#111827';
      ctx.globalAlpha = alpha;
      ctx.fill();
      // label
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (foodItem.type === 'rising' || foodItem.type === 'dropping') { ctx.font = `${Math.round(10 * (0.9 + spawnScale))}px monospace`; ctx.fillStyle = '#ffffff'; ctx.fillText(foodItem.label, cx, cy); }
      else { ctx.font = `${Math.round(12 * (0.9 + spawnScale))}px serif`; ctx.fillStyle = '#ffffff'; ctx.fillText(foodItem.label, cx, cy); }
      ctx.restore();
    }

  // hedgehog
    if (hedgehog && hedgehog.active) { const h = hedgehog.pos; ctx.save(); ctx.fillStyle = '#8b5cf6'; ctx.fillRect(h.x * CELL_SIZE + 2, h.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4); ctx.restore(); }

    ctx.restore();
  }, [snake, trail, foods, isPlaying, hedgehog, animTime]);

  // Ensure at least one neutral food exists and periodically try to spawn new items
  useEffect(() => {
    if (!isPlaying) return;
    // ensure at least one neutral exists
    const neutral = foods.find(f => f.type === 'apple' || f.type === 'money');
    if (!neutral) spawnFood('apple');
    const id = window.setInterval(() => {
      // occasionally attempt to spawn (keeps play lively)
  if ((foodsRef.current || []).length < 5) {
        // Slightly bias the interval-based spawns toward stocks.
        // r < 0.55: neutral spawn | 0.55-0.75: money | 0.75-0.92: rising | else: dropping
        const r = Math.random();
        if (r < 0.55) spawnFood();
        else if (r < 0.75) spawnFood('money');
        else if (r < 0.92) spawnFood('rising');
        else spawnFood('dropping');
      }
    }, 1400 + Math.floor(Math.random() * 800));
    return () => clearInterval(id);
  }, [isPlaying, foods, spawnFood]);

    // Disable/hide hover transitions and reduce visual clutter for obstacle elements
    // inside the play area to keep the game area immersive. We add a lightweight
    // class to candidate elements and apply styles that remove hover transforms,
    // reduce opacity, and disable pointer events so the UI doesn't get in the way
    // while the game is playing. This is intentionally destructive while the
    // overlay is active; tweak to suit your needs.
  useEffect(() => {
    // Inject CSS once
    const styleId = 'dom-snake-disable-hover-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style'); style.id = styleId;
      // Make obstacle adjustments non-destructive: remove hover transforms but keep interactions.
      style.innerHTML = `.${DISABLE_HOVER_CLASS}:hover{ transition:none !important; transform:none !important; box-shadow:none !important; filter:none !important; }
      /* reduce visual clutter in the play area while preserving interactions */
      .${DISABLE_HOVER_CLASS} { opacity: 0.98 !important; pointer-events: auto !important; user-select: auto !important; }
      `;
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
          <Badge variant="secondary" className="text-purple-200 px-3 py-1">Lvl: {level}</Badge>
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
