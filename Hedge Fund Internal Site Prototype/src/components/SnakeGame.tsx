import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Play, Pause, RotateCcw, Trophy, Volume2, VolumeX, X } from 'lucide-react';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type FoodType = 'normal' | 'bonus';

interface Food extends Position {
  type: FoodType;
}

interface SnakeGameProps {
  onClose?: () => void;
}

const INITIAL_SPEED = 150;
const SPEED_INCREMENT = 5;
const MAX_SPEED = 50;

export function SnakeGame({ onClose }: SnakeGameProps) {
  const canvasRef = useRef(null as HTMLCanvasElement | null);
  const containerRef = useRef(null as HTMLDivElement | null);
  const [gridSize, setGridSize] = useState({ width: 40, height: 30 });
  const [cellSize, setCellSize] = useState(20);
  const [snake, setSnake] = useState([{ x: 10, y: 10 }] as Position[]);
  const [direction, setDirection] = useState('RIGHT' as Direction);
  const [nextDirection, setNextDirection] = useState('RIGHT' as Direction);
  const [food, setFood] = useState({ x: 15, y: 15, type: 'normal' } as Food);
  const [score, setScore] = useState(0 as number);
  const [highScore, setHighScore] = useState(0 as number);
  const [isPlaying, setIsPlaying] = useState(false as boolean);
  const [isPaused, setIsPaused] = useState(false as boolean);
  const [gameOver, setGameOver] = useState(false as boolean);
  const [speed, setSpeed] = useState(INITIAL_SPEED as number);
  const [soundEnabled, setSoundEnabled] = useState(false as boolean);
  const gameLoopRef = useRef(null as number | null);
  // buffer for activation sequence 'hiss'
  const typedBufferRef = useRef('');
  const HISS_SEQUENCE = 'hiss';

  // Calculate grid size based on viewport
  useEffect(() => {
    const calculateGridSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      // Target cell size based on screen size
      const targetCellSize = Math.max(15, Math.min(25, Math.floor(Math.min(width, height) / 30)));

      // Leave a bottom gap so the bottom row is hidden and there is open space
      const bottomGapPx = Math.round((window.innerHeight * 0.10)); // ~10vh

      const cols = Math.floor(width / targetCellSize);
      const rows = Math.floor((height - bottomGapPx) / targetCellSize); // Account for UI elements and bottom gap
      
      setGridSize({ width: cols, height: rows });
      setCellSize(targetCellSize);
      
      // Reset snake position to center
      setSnake([{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }]);
    };
    
    calculateGridSize();
    window.addEventListener('resize', calculateGridSize);
    return () => window.removeEventListener('resize', calculateGridSize);
  }, []);

  // Load high score from localStorage
  useEffect(() => {
    const savedHighScore = localStorage.getItem('snakeHighScore');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
  }, []);

  // Save high score to localStorage
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snakeHighScore', score.toString());
    }
  }, [score, highScore]);

  // Generate random food position
  const generateFood = useCallback((currentSnake: Position[]): Food => {
    let newFood: Food;
    do {
      newFood = {
        x: Math.floor(Math.random() * gridSize.width),
        y: Math.floor(Math.random() * gridSize.height),
        type: Math.random() > 0.8 ? 'bonus' : 'normal',
      };
    } while (
      currentSnake.some((segment) => segment.x === newFood.x && segment.y === newFood.y)
    );
    return newFood;
  }, [gridSize]);

  // Play sound effect
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
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
      // Silently fail if audio not supported
    }
  }, [soundEnabled]);

  // Check collision
  const checkCollision = useCallback((head: Position, body: Position[]): boolean => {
    // Only self-collision kills the snake. Walls are wrapped instead.
    return body.some((segment) => segment.x === head.x && segment.y === head.y);
  }, [gridSize]);

  // Game loop
  const gameLoop = useCallback(() => {
    setSnake((prevSnake: Position[]) => {
      const head = prevSnake[0];
      let newHead: Position = { x: head.x, y: head.y };

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

      // Wrap edges: move seamlessly from one edge to the opposite
      newHead.x = (newHead.x + gridSize.width) % gridSize.width;
      newHead.y = (newHead.y + gridSize.height) % gridSize.height;

      // Check collision (self only)
      if (checkCollision(newHead, prevSnake)) {
        setGameOver(true);
        setIsPlaying(false);
        playSound(200, 0.3);
        return prevSnake;
      }

  const newSnake = [newHead, ...prevSnake];

      // Check if food is eaten
      if (newHead.x === food.x && newHead.y === food.y) {
        const points = food.type === 'bonus' ? 10 : 1;
  setScore((prev: number) => prev + points);
        setFood(generateFood(newSnake));
        playSound(food.type === 'bonus' ? 800 : 600, 0.1);
        
        // Increase speed
  setSpeed((prev: number) => Math.max(MAX_SPEED, prev - SPEED_INCREMENT));
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

  // Update direction at the start of each game loop
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

      // If game over, allow typed activation sequence to restart
      if (gameOver) {
        const k = e.key.toLowerCase();
        if (/^[a-z]$/.test(k)) {
          typedBufferRef.current += k;
          if (typedBufferRef.current.length > HISS_SEQUENCE.length) {
            typedBufferRef.current = typedBufferRef.current.slice(-HISS_SEQUENCE.length);
          }
          if (typedBufferRef.current === HISS_SEQUENCE) {
            startGame();
            typedBufferRef.current = '';
          }
        }
        return;
      }

      // Space should only pause/resume if the game is playing; do not start via space
      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) {
          setIsPaused((prev: boolean) => !prev);
        }
        return;
      }

      // If not playing, listen for the activation word 'hiss'
      if (!isPlaying) {
        const k = e.key.toLowerCase();
        if (/^[a-z]$/.test(k)) {
          typedBufferRef.current += k;
          if (typedBufferRef.current.length > HISS_SEQUENCE.length) {
            typedBufferRef.current = typedBufferRef.current.slice(-HISS_SEQUENCE.length);
          }
          if (typedBufferRef.current === HISS_SEQUENCE) {
            startGame();
            typedBufferRef.current = '';
          }
        }
        return;
      }

  if (isPaused) return;

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

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Do NOT draw grid lines or visible walls — keep the play area clean

    // Draw snake
  snake.forEach((segment: Position, index: number) => {
      if (index === 0) {
        // Head - brighter
        const gradient = ctx.createRadialGradient(
          segment.x * cellSize + cellSize / 2,
          segment.y * cellSize + cellSize / 2,
          0,
          segment.x * cellSize + cellSize / 2,
          segment.y * cellSize + cellSize / 2,
          cellSize / 2
        );
        gradient.addColorStop(0, '#c4b5fd');
        gradient.addColorStop(1, '#a78bfa');
        ctx.fillStyle = gradient;
      } else {
        // Body - gradient fade
        const opacity = 1 - (index / snake.length) * 0.4;
        ctx.fillStyle = `rgba(167, 139, 250, ${opacity})`;
      }
      
      ctx.fillRect(
        segment.x * cellSize + 2,
        segment.y * cellSize + 2,
        cellSize - 4,
        cellSize - 4
      );
      
      // Add highlight
      if (index === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(
          segment.x * cellSize + 3,
          segment.y * cellSize + 3,
          cellSize / 3,
          cellSize / 3
        );
      }
    });

    // Draw food
    const foodGradient = ctx.createRadialGradient(
      food.x * cellSize + cellSize / 2,
      food.y * cellSize + cellSize / 2,
      0,
      food.x * cellSize + cellSize / 2,
      food.y * cellSize + cellSize / 2,
      cellSize / 2
    );
    
    if (food.type === 'bonus') {
      foodGradient.addColorStop(0, '#fde047');
      foodGradient.addColorStop(1, '#fbbf24');
      
      // Pulsing glow effect for bonus food
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 15;
    } else {
      foodGradient.addColorStop(0, '#6ee7b7');
      foodGradient.addColorStop(1, '#34d399');
    }
    
    ctx.fillStyle = foodGradient;
    ctx.beginPath();
    ctx.arc(
      food.x * cellSize + cellSize / 2,
      food.y * cellSize + cellSize / 2,
      cellSize / 2 - 3,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [snake, food, gridSize, cellSize]);

  const startGame = () => {
    const startPos = { x: Math.floor(gridSize.width / 2), y: Math.floor(gridSize.height / 2) };
    setSnake([startPos]);
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
  setIsPaused((prev: boolean) => !prev);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at top, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.1) 50%, transparent 100%), radial-gradient(ellipse at bottom, rgba(236, 72, 153, 0.15) 0%, rgba(99, 102, 241, 0.1) 50%, transparent 100%)',
        backgroundColor: 'rgba(10, 10, 15, 0.95)',
      }}
    >
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />
      </div>

      {/* Glass container */}
      <div className="relative z-10 flex flex-col items-center gap-6 w-full h-full p-6">
        {/* Header - Frosted glass effect */}
  <div className="flex items-center justify-between w-full max-w-7xl px-8 py-4 rounded-2xl backdrop-blur-xl bg-white/5 shadow-2xl">
          <div className="flex items-center gap-6">
            <Badge className="bg-gradient-to-r from-purple-600 to-purple-500 px-4 py-2 shadow-lg shadow-purple-500/50">
              Score: {score}
            </Badge>
            <Badge variant="outline" className="border-purple-400/50 text-purple-300 px-4 py-2 backdrop-blur-sm bg-purple-500/10">
              <Trophy className="w-4 h-4 mr-2" />
              Best: {highScore}
            </Badge>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="text-purple-300"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-purple-300"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Game Canvas - Liquid glass background */}
        <div className="relative flex-1 flex items-center justify-center w-full">
          <div className="relative rounded-3xl backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent shadow-2xl p-8">
            <canvas
              ref={canvasRef}
              width={gridSize.width * cellSize}
              height={gridSize.height * cellSize}
              className="rounded-xl shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 27, 75, 0.6) 100%)',
                border: 'none',
              }}
            />
            
            {/* Game Over Overlay */}
            {gameOver && (
              <div className="absolute inset-0 backdrop-blur-xl bg-black/60 flex flex-col items-center justify-center rounded-xl">
                <div className="backdrop-blur-2xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
                  <h2 className="text-purple-300 mb-4 text-center">Game Over!</h2>
                  <p className="text-purple-200 mb-6 text-center">Final Score: {score}</p>
                  <Button onClick={startGame} className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 shadow-lg shadow-purple-500/50">
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Play Again
                  </Button>
                </div>
              </div>
            )}
            
            {/* Pause Overlay */}
            {isPaused && !gameOver && (
              <div className="absolute inset-0 backdrop-blur-xl bg-black/60 flex flex-col items-center justify-center rounded-xl">
                <div className="backdrop-blur-2xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
                  <h2 className="text-purple-300 mb-4 text-center">Paused</h2>
                  <p className="text-purple-200 text-center">Press SPACE to continue</p>
                </div>
              </div>
            )}
            
            {/* Start Screen - passive; instruct to type 'hiss' to start. Button kept optional. */}
            {!isPlaying && !gameOver && (
              <div className="absolute inset-0 backdrop-blur-xl bg-black/60 flex flex-col items-center justify-center rounded-xl">
                <div className="backdrop-blur-2xl bg-white/10 rounded-2xl p-10 shadow-2xl max-w-md">
                  <h2 className="text-purple-300 mb-6 text-center">🐍 Retro Snake Game</h2>
                  <div className="text-purple-200 text-sm mb-8 text-center space-y-2">
                    <p>Type <strong className="text-white">hiss</strong> to activate the game</p>
                    <p>Use <kbd className="px-2 py-1 bg-white/20 rounded">Arrow Keys</kbd> or <kbd className="px-2 py-1 bg-white/20 rounded">WASD</kbd> to move</p>
                    <p>Press <kbd className="px-2 py-1 bg-white/20 rounded">SPACE</kbd> to pause</p>
                    <p>Press <kbd className="px-2 py-1 bg-white/20 rounded">ESC</kbd> to exit</p>
                  </div>
                  <Button onClick={startGame} className="w-full bg-gradient-to-r from-purple-600 to-purple-500 shadow-lg shadow-purple-500/50">
                    <Play className="w-5 h-5 mr-2" />
                    Start (or type 'hiss')
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls & Info - Frosted glass */}
        <div className="flex items-center justify-between w-full max-w-7xl px-8 py-4 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl">
          <div className="flex items-center gap-4">
            {!isPlaying || gameOver ? (
              <Button onClick={startGame} className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 shadow-lg shadow-purple-500/50">
                <Play className="w-4 h-4 mr-2" />
                {gameOver ? 'Restart' : 'Start'}
              </Button>
            ) : (
              <Button onClick={togglePause} variant="outline" className="border-purple-400/50 text-purple-300 hover:bg-white/10 backdrop-blur-sm">
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
          </div>

          {/* Instructions */}
          <div className="text-xs text-purple-300/80 text-center">
            <p>🟢 Normal food: +1 point • ⭐ Bonus food: +10 points • Speed increases as you grow!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
