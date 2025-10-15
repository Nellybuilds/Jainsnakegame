import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Play, Pause, RotateCcw, Trophy, Volume2, VolumeX, X } from 'lucide-react';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type FoodType = 'normal' | 'bonus';

interface Food extends Position {
  type: FoodType;
  label: string;
}

interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  element: HTMLElement;
}

interface DOMSnakeGameProps {
  onClose?: () => void;
}

const CELL_SIZE = 12; // Smaller cells for more granular movement
const INITIAL_SPEED = 120;
const SPEED_INCREMENT = 3;
const MAX_SPEED = 40;
const TRAIL_LENGTH = 15;

const STOCK_TICKERS = ['AAPL', 'SBUX', 'TSLA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'NVDA', 'NFLX', 'AMD'];
const MONEY_BAGS = ['💰', '💵', '💸', '💎', '🏆'];

export function DOMSnakeGame({ onClose }: DOMSnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [gridSize, setGridSize] = useState({ width: 100, height: 100 });
  const [snake, setSnake] = useState<Position[]>([]);
  const [trail, setTrail] = useState<Position[]>([]);
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [nextDirection, setNextDirection] = useState<Direction>('RIGHT');
  const [food, setFood] = useState<Food | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const gameLoopRef = useRef<number>();
  const [nearFood, setNearFood] = useState(false);

  // Scan DOM for obstacles
  const scanDOMForObstacles = useCallback(() => {
    const newObstacles: Obstacle[] = [];
    
    // Get all significant elements (headers, images, cards, buttons, nav, etc.)
    const selectors = [
      'header',
      'nav',
      'img',
      'button',
      'a',
      '.gamify-card',
      'h1', 'h2', 'h3',
      'footer',
      '[class*="Card"]',
      '[class*="Badge"]',
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const htmlEl = el as HTMLElement;
        // Skip the game overlay itself and hidden elements
        if (htmlEl.closest('#dom-snake-overlay')) return;
        
        const rect = htmlEl.getBoundingClientRect();
        // Only include visible elements with meaningful size
        if (rect.width > 20 && rect.height > 20) {
          newObstacles.push({
            x: Math.floor((rect.left + window.scrollX) / CELL_SIZE),
            y: Math.floor((rect.top + window.scrollY) / CELL_SIZE),
            width: Math.ceil(rect.width / CELL_SIZE),
            height: Math.ceil(rect.height / CELL_SIZE),
            element: htmlEl,
          });
        }
      });
    });
    
    setObstacles(newObstacles);
  }, []);

  // Initialize game
  useEffect(() => {
    const updateGridSize = () => {
      const width = Math.floor((window.innerWidth + window.scrollX) / CELL_SIZE);
      const height = Math.floor((document.documentElement.scrollHeight) / CELL_SIZE);
      setGridSize({ width, height });
    };
    
    updateGridSize();
    scanDOMForObstacles();
    
    window.addEventListener('resize', updateGridSize);
    window.addEventListener('resize', scanDOMForObstacles);
    
    return () => {
      window.removeEventListener('resize', updateGridSize);
      window.removeEventListener('resize', scanDOMForObstacles);
    };
  }, [scanDOMForObstacles]);

  // Load high score
  useEffect(() => {
    const savedHighScore = localStorage.getItem('domSnakeHighScore');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
  }, []);

  // Save high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('domSnakeHighScore', score.toString());
    }
  }, [score, highScore]);

  // Find safe starting position
  const findSafePosition = useCallback((avoidPositions: Position[] = []): Position | null => {
    const maxAttempts = 100;
    for (let i = 0; i < maxAttempts; i++) {
      const x = Math.floor(Math.random() * gridSize.width);
      const y = Math.floor(Math.random() * (Math.min(gridSize.height, Math.floor(window.innerHeight / CELL_SIZE))));
      
      // Check if position is safe
      const isSafe = !obstacles.some(obs => 
        x >= obs.x && x < obs.x + obs.width &&
        y >= obs.y && y < obs.y + obs.height
      ) && !avoidPositions.some(pos => pos.x === x && pos.y === y);
      
      if (isSafe) return { x, y };
    }
    return null;
  }, [obstacles, gridSize]);

  // Generate food
  const generateFood = useCallback((currentSnake: Position[]): Food | null => {
    const safePos = findSafePosition(currentSnake);
    if (!safePos) return null;
    
    const isBonus = Math.random() > 0.85;
    const label = isBonus 
      ? MONEY_BAGS[Math.floor(Math.random() * MONEY_BAGS.length)]
      : STOCK_TICKERS[Math.floor(Math.random() * STOCK_TICKERS.length)];
    
    return {
      ...safePos,
      type: isBonus ? 'bonus' : 'normal',
      label,
    };
  }, [findSafePosition]);

  // Play sound
  const playSound = useCallback((frequency: number, duration: number) => {
    if (!soundEnabled) return;
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'square';
      
      gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
      // Silently fail
    }
  }, [soundEnabled]);

  // Check collision with obstacles
  const checkCollision = useCallback((head: Position, body: Position[]): boolean => {
    // Wall collision
    if (head.x < 0 || head.x >= gridSize.width || head.y < 0 || head.y >= gridSize.height) {
      return true;
    }
    
    // Self collision
    if (body.some(segment => segment.x === head.x && segment.y === head.y)) {
      return true;
    }
    
    // Obstacle collision
    return obstacles.some(obs => 
      head.x >= obs.x && head.x < obs.x + obs.width &&
      head.y >= obs.y && head.y < obs.y + obs.height
    );
  }, [obstacles, gridSize]);

  // Check if near food
  useEffect(() => {
    if (!food || snake.length === 0) {
      setNearFood(false);
      return;
    }
    
    const head = snake[0];
    const distance = Math.sqrt(Math.pow(head.x - food.x, 2) + Math.pow(head.y - food.y, 2));
    setNearFood(distance < 5);
    
    // Highlight food element when near
    if (distance < 3 && food.type === 'bonus') {
      // Visual feedback could be added here
    }
  }, [snake, food]);

  // Game loop
  const gameLoop = useCallback(() => {
    setSnake((prevSnake) => {
      if (prevSnake.length === 0) return prevSnake;
      
      const head = prevSnake[0];
      let newHead: Position;

      switch (direction) {
        case 'UP':
          newHead = { x: head.x, y: head.y - 1 };
          break;
        case 'DOWN':
          newHead = { x: head.x, y: head.y + 1 };
          break;
        case 'LEFT':
          newHead = { x: head.x - 1, y: head.y };
          break;
        case 'RIGHT':
          newHead = { x: head.x + 1, y: head.y };
          break;
      }

      // Check collision
      if (checkCollision(newHead, prevSnake)) {
        setGameOver(true);
        setIsPlaying(false);
        playSound(200, 0.3);
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Update trail
      setTrail(prev => {
        const newTrail = [head, ...prev];
        return newTrail.slice(0, TRAIL_LENGTH);
      });

      // Check if food is eaten
      if (food && newHead.x === food.x && newHead.y === food.y) {
        const points = food.type === 'bonus' ? 10 : 1;
        setScore((prev) => prev + points);
        setFood(generateFood(newSnake));
        playSound(food.type === 'bonus' ? 900 : 700, 0.1);
        
        // Increase speed
        setSpeed((prev) => Math.max(MAX_SPEED, prev - SPEED_INCREMENT));
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, food, checkCollision, generateFood, playSound]);

  // Start game loop
  useEffect(() => {
    if (isPlaying && !isPaused && !gameOver) {
      gameLoopRef.current = window.setInterval(gameLoop, speed);
      return () => {
        if (gameLoopRef.current) {
          clearInterval(gameLoopRef.current);
        }
      };
    }
  }, [isPlaying, isPaused, gameOver, gameLoop, speed]);

  // Update direction
  useEffect(() => {
    if (isPlaying && !isPaused) {
      setDirection(nextDirection);
    }
  }, [snake, nextDirection, isPlaying, isPaused]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }

      if (gameOver) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) {
          setIsPaused((prev) => !prev);
        } else {
          startGame();
        }
        return;
      }

      if (!isPlaying || isPaused) return;

      const key = e.key.toLowerCase();
      
      switch (key) {
        case 'arrowup':
        case 'w':
          e.preventDefault();
          if (direction !== 'DOWN') setNextDirection('UP');
          break;
        case 'arrowdown':
        case 's':
          e.preventDefault();
          if (direction !== 'UP') setNextDirection('DOWN');
          break;
        case 'arrowleft':
        case 'a':
          e.preventDefault();
          if (direction !== 'RIGHT') setNextDirection('LEFT');
          break;
        case 'arrowright':
        case 'd':
          e.preventDefault();
          if (direction !== 'LEFT') setNextDirection('RIGHT');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [direction, isPlaying, isPaused, gameOver, onClose]);

  // Draw game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to document size
    canvas.width = window.innerWidth;
    canvas.height = Math.max(window.innerHeight, document.documentElement.scrollHeight);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw subtle grid for reference (non-blocking)
    if (isPlaying) {
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.05)';
      ctx.lineWidth = 1;
      
      // Draw vertical lines every 5 cells
      for (let i = 0; i <= gridSize.width; i += 5) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, canvas.height);
        ctx.stroke();
      }
      
      // Draw horizontal lines every 5 cells
      for (let i = 0; i <= gridSize.height; i += 5) {
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(canvas.width, i * CELL_SIZE);
        ctx.stroke();
      }
      
      // Draw CRT scanlines
      ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
      for (let i = 0; i < canvas.height; i += 3) {
        ctx.fillRect(0, i, canvas.width, 1);
      }
    }

    // Draw trail
    trail.forEach((segment, index) => {
      const opacity = (1 - index / TRAIL_LENGTH) * 0.3;
      ctx.fillStyle = `rgba(167, 139, 250, ${opacity})`;
      ctx.fillRect(
        segment.x * CELL_SIZE + 2,
        segment.y * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4
      );
    });

    // Draw snake with glow effect
    snake.forEach((segment, index) => {
      ctx.save();
      
      if (index === 0) {
        // Head - neon glow
        ctx.shadowColor = '#a78bfa';
        ctx.shadowBlur = 20;
        
        const gradient = ctx.createRadialGradient(
          segment.x * CELL_SIZE + CELL_SIZE / 2,
          segment.y * CELL_SIZE + CELL_SIZE / 2,
          0,
          segment.x * CELL_SIZE + CELL_SIZE / 2,
          segment.y * CELL_SIZE + CELL_SIZE / 2,
          CELL_SIZE
        );
        gradient.addColorStop(0, '#e0d5ff');
        gradient.addColorStop(0.5, '#c4b5fd');
        gradient.addColorStop(1, '#a78bfa');
        ctx.fillStyle = gradient;
      } else {
        // Body - neon segments
        const opacity = 1 - (index / snake.length) * 0.3;
        ctx.shadowColor = `rgba(167, 139, 250, ${opacity})`;
        ctx.shadowBlur = 15;
        ctx.fillStyle = `rgba(196, 181, 253, ${opacity})`;
      }
      
      ctx.fillRect(
        segment.x * CELL_SIZE + 1,
        segment.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2
      );
      
      // Highlight on head
      if (index === 0) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(
          segment.x * CELL_SIZE + 3,
          segment.y * CELL_SIZE + 3,
          CELL_SIZE / 3,
          CELL_SIZE / 3
        );
      }
      
      ctx.restore();
    });

    // Draw food as text blocks (stock tickers or money emojis)
    if (food) {
      ctx.save();
      
      const pulseScale = 1 + Math.sin(Date.now() / 300) * 0.1;
      const padding = 8;
      const boxWidth = food.type === 'bonus' ? 40 : 50;
      const boxHeight = 28;
      
      const centerX = food.x * CELL_SIZE + CELL_SIZE / 2;
      const centerY = food.y * CELL_SIZE + CELL_SIZE / 2;
      
      // Draw background box with glow
      if (food.type === 'bonus') {
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 20 * pulseScale;
        
        // Golden gradient background
        const gradient = ctx.createLinearGradient(
          centerX - boxWidth / 2,
          centerY - boxHeight / 2,
          centerX + boxWidth / 2,
          centerY + boxHeight / 2
        );
        gradient.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
        gradient.addColorStop(1, 'rgba(251, 191, 36, 0.95)');
        ctx.fillStyle = gradient;
        
        // Border
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
      } else {
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 15 * pulseScale;
        
        // Green gradient background
        const gradient = ctx.createLinearGradient(
          centerX - boxWidth / 2,
          centerY - boxHeight / 2,
          centerX + boxWidth / 2,
          centerY + boxHeight / 2
        );
        gradient.addColorStop(0, 'rgba(167, 243, 208, 0.95)');
        gradient.addColorStop(1, 'rgba(52, 211, 153, 0.95)');
        ctx.fillStyle = gradient;
        
        // Border
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
      }
      
      // Draw rounded rectangle
      const radius = 6;
      ctx.beginPath();
      ctx.moveTo(centerX - boxWidth / 2 + radius, centerY - boxHeight / 2);
      ctx.lineTo(centerX + boxWidth / 2 - radius, centerY - boxHeight / 2);
      ctx.quadraticCurveTo(centerX + boxWidth / 2, centerY - boxHeight / 2, centerX + boxWidth / 2, centerY - boxHeight / 2 + radius);
      ctx.lineTo(centerX + boxWidth / 2, centerY + boxHeight / 2 - radius);
      ctx.quadraticCurveTo(centerX + boxWidth / 2, centerY + boxHeight / 2, centerX + boxWidth / 2 - radius, centerY + boxHeight / 2);
      ctx.lineTo(centerX - boxWidth / 2 + radius, centerY + boxHeight / 2);
      ctx.quadraticCurveTo(centerX - boxWidth / 2, centerY + boxHeight / 2, centerX - boxWidth / 2, centerY + boxHeight / 2 - radius);
      ctx.lineTo(centerX - boxWidth / 2, centerY - boxHeight / 2 + radius);
      ctx.quadraticCurveTo(centerX - boxWidth / 2, centerY - boxHeight / 2, centerX - boxWidth / 2 + radius, centerY - boxHeight / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.shadowBlur = 0;
      
      // Draw text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      if (food.type === 'bonus') {
        // Money emoji
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = '#78350f';
        ctx.fillText(food.label, centerX, centerY);
      } else {
        // Stock ticker
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#064e3b';
        ctx.fillText(food.label, centerX, centerY);
      }
      
      // Outer glow ring when near
      if (nearFood) {
        ctx.shadowColor = food.type === 'bonus' ? '#fbbf24' : '#34d399';
        ctx.shadowBlur = 30;
        ctx.strokeStyle = food.type === 'bonus' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(52, 211, 153, 0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, boxWidth * 0.8, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.restore();
    }

    // Draw obstacle outlines when near
    if (isPlaying && !isPaused && snake.length > 0) {
      const head = snake[0];
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.lineWidth = 2;
      
      obstacles.forEach(obs => {
        const distance = Math.min(
          Math.abs(head.x - obs.x),
          Math.abs(head.x - (obs.x + obs.width)),
          Math.abs(head.y - obs.y),
          Math.abs(head.y - (obs.y + obs.height))
        );
        
        if (distance < 3) {
          ctx.strokeRect(
            obs.x * CELL_SIZE,
            obs.y * CELL_SIZE,
            obs.width * CELL_SIZE,
            obs.height * CELL_SIZE
          );
        }
      });
    }
  }, [snake, food, trail, obstacles, isPlaying, isPaused, nearFood]);

  const startGame = () => {
    scanDOMForObstacles();
    
    const startPos = findSafePosition();
    if (!startPos) {
      console.error('Could not find safe starting position');
      return;
    }
    
    setSnake([startPos]);
    setTrail([]);
    setDirection('RIGHT');
    setNextDirection('RIGHT');
    setFood(generateFood([startPos]));
    setScore(0);
    setSpeed(INITIAL_SPEED);
    setIsPlaying(true);
    setIsPaused(false);
    setGameOver(false);
  };

  const togglePause = () => {
    if (isPlaying && !gameOver) {
      setIsPaused((prev) => !prev);
    }
  };

  return (
    <div
      id="dom-snake-overlay"
      ref={overlayRef}
      className="fixed inset-0 z-[9999] pointer-events-none"
      style={{
        width: '100vw',
        height: `${Math.max(window.innerHeight, document.documentElement.scrollHeight)}px`,
      }}
    >
      {/* Dimming overlay */}
      {isPlaying && (
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-none"
          style={{
            mixBlendMode: 'multiply',
          }}
        />
      )}
      
      {/* Canvas for snake */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 pointer-events-none"
      />

      {/* HUD - Fixed position */}
      <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-3 pointer-events-auto">
        <div className="flex items-center gap-3 px-6 py-3 rounded-xl backdrop-blur-xl bg-black/60 border border-purple-500/30 shadow-2xl shadow-purple-500/20">
          <Badge className="bg-gradient-to-r from-purple-600 to-purple-500 px-3 py-1 shadow-lg shadow-purple-500/50">
            Score: {score}
          </Badge>
          <Badge variant="outline" className="border-purple-400/50 text-purple-300 px-3 py-1 backdrop-blur-sm bg-purple-500/10">
            <Trophy className="w-3 h-3 mr-1" />
            Best: {highScore}
          </Badge>
          <div className="flex items-center gap-2 ml-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="text-purple-300 hover:text-purple-200 hover:bg-white/10 h-8 w-8 p-0"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-purple-300 hover:text-purple-200 hover:bg-white/10 h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Controls - Fixed bottom */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] pointer-events-auto">
        <div className="flex items-center gap-3 px-6 py-3 rounded-xl backdrop-blur-xl bg-black/60 border border-purple-500/30 shadow-2xl shadow-purple-500/20">
          {!isPlaying || gameOver ? (
            <Button 
              onClick={startGame} 
              className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 shadow-lg shadow-purple-500/50"
            >
              <Play className="w-4 h-4 mr-2" />
              {gameOver ? 'Restart' : 'Start Game'}
            </Button>
          ) : (
            <Button 
              onClick={togglePause} 
              variant="outline" 
              className="border-purple-400/50 text-purple-300 hover:bg-white/10"
            >
              {isPaused ? (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </>
              )}
            </Button>
          )}
          <div className="text-xs text-purple-300/80 ml-2">
            {isPlaying ? '📈 Stocks: +1 • 💰 Money: +10' : 'Arrow keys or WASD to move'}
          </div>
        </div>
      </div>

      {/* Game Over Modal */}
      {gameOver && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center pointer-events-auto">
          <div className="backdrop-blur-2xl bg-black/80 border border-purple-500/50 rounded-3xl p-10 shadow-2xl shadow-purple-500/30 max-w-md mx-4">
            <h2 className="text-purple-300 mb-4 text-center">💥 Game Over!</h2>
            <p className="text-purple-200 mb-2 text-center">Final Score: {score}</p>
            {score === highScore && score > 0 && (
              <p className="text-yellow-400 text-sm mb-6 text-center">🏆 New High Score!</p>
            )}
            <Button 
              onClick={startGame} 
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 shadow-lg shadow-purple-500/50"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Play Again
            </Button>
            <Button 
              onClick={onClose}
              variant="outline"
              className="w-full mt-3 border-purple-400/50 text-purple-300 hover:bg-white/10"
            >
              Exit Game
            </Button>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {isPaused && !gameOver && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center pointer-events-auto">
          <div className="backdrop-blur-2xl bg-black/80 border border-purple-500/50 rounded-3xl p-10 shadow-2xl shadow-purple-500/30">
            <h2 className="text-purple-300 mb-4 text-center">⏸️ Paused</h2>
            <p className="text-purple-200 text-center mb-6">Press SPACE to continue</p>
            <Button 
              onClick={togglePause}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 shadow-lg shadow-purple-500/50"
            >
              <Play className="w-5 h-5 mr-2" />
              Resume Game
            </Button>
          </div>
        </div>
      )}

      {/* Start Instructions */}
      {!isPlaying && !gameOver && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center pointer-events-auto">
          <div className="backdrop-blur-2xl bg-black/80 border border-purple-500/50 rounded-3xl p-10 shadow-2xl shadow-purple-500/30 max-w-lg mx-4">
            <h2 className="text-purple-300 mb-6 text-center">🐍 DOM Snake</h2>
            <div className="text-purple-200 text-sm mb-8 space-y-3">
              <p className="text-center">Navigate the snake through the actual website!</p>
              <div className="bg-purple-900/20 rounded-lg p-4 space-y-2">
                <p>🎮 Use <kbd className="px-2 py-1 bg-purple-600/30 rounded text-xs">Arrow Keys</kbd> or <kbd className="px-2 py-1 bg-purple-600/30 rounded text-xs">WASD</kbd> to move</p>
                <p>📈 Collect stock tickers (+1 point)</p>
                <p>💰 Collect money bags (+10 points)</p>
                <p>🚫 Avoid website elements (headers, images, cards, buttons)</p>
                <p>⏸️ Press <kbd className="px-2 py-1 bg-purple-600/30 rounded text-xs">SPACE</kbd> to pause</p>
                <p>❌ Press <kbd className="px-2 py-1 bg-purple-600/30 rounded text-xs">ESC</kbd> to exit</p>
              </div>
            </div>
            <Button 
              onClick={startGame} 
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 shadow-lg shadow-purple-500/50"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Game
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
