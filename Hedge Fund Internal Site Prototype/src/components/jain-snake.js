/*
  Jain Snake - Standalone JavaScript game for landing page

  Features implemented to match requirements:
  - No visible borders or walls on the canvas
  - Screen wrapping (move seamlessly from one edge to opposite)
  - Death only occurs when the snake bites itself
  - Food, score, growth, levels (speed increases), and sound effects
  - Game activates only after the user types the sequence: `hiss`
  - Canvas layout keeps a bottom gap so the bottom row is effectively hidden
  - Minimal CSS hooks are provided in `snake-landing.css` (create/import in landing page)

  Usage:
  - Include this script on your landing page (defer or at end of body), or import and call `JainSnake.init()`.
  - The script will create a fixed canvas overlay. To remove it, call `JainSnake.destroy()`.

  Notes:
  - This is plain JavaScript with no external dependencies.
  - Tweak `CELL_SIZE`, `BOTTOM_GAP_VH`, and other constants below to customize.
*/

(function (global) {
  const JainSnake = {};

  // ---- Configuration ----
  const CELL_SIZE = 20; // pixels per cell (adjust for different density)
  const INITIAL_SPEED = 150; // ms per tick
  const SPEED_DECREMENT = 8; // ms faster per food (lower is faster)
  const MIN_SPEED = 40; // cap for speed (lower bound)
  const BOTTOM_GAP_VH = 10; // hide bottom ~10vh to create open space
  const HISS_SEQUENCE = 'hiss'; // activation sequence

  // ---- Internal state ----
  let canvas, ctx, widthPx, heightPx, cols, rows;
  let snake = []; // array of {x,y}, head at index 0
  let dir = { x: 1, y: 0 }; // initial moving right
  let nextDir = { x: 1, y: 0 };
  let food = null;
  let score = 0;
  let highScore = 0;
  let speed = INITIAL_SPEED;
  let playing = false;
  let gameOver = false;
  let tickTimer = null;
  let typedBuffer = '';
  let soundEnabled = true;

  // ---- Utilities ----
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Initialize canvas and layout
  function createCanvas() {
    canvas = document.createElement('canvas');
    canvas.id = 'jain-snake-canvas';
    // fixed overlay but leave bottom gap for page layout
    canvas.style.position = 'fixed';
    canvas.style.left = '50%';
    canvas.style.top = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
    canvas.style.zIndex = '9999';
    canvas.style.background = 'transparent';
    canvas.style.border = 'none';
    canvas.style.outline = 'none';
    canvas.style.pointerEvents = 'auto';
    // disable image hover effects around the game area if any
    canvas.className = 'jain-snake-canvas';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  // Remove canvas and listeners
  JainSnake.destroy = function () {
    stopGameLoop();
    window.removeEventListener('keydown', keyHandler);
    window.removeEventListener('resize', resizeCanvas);
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;
  };

  // Compute grid size and adjust canvas pixel dimensions
  function resizeCanvas() {
    // compute available height leaving bottom gap
    const gapPx = Math.round((window.innerHeight * BOTTOM_GAP_VH) / 100);
    widthPx = window.innerWidth;
    heightPx = window.innerHeight - gapPx;

    cols = Math.floor(widthPx / CELL_SIZE);
    rows = Math.floor(heightPx / CELL_SIZE);

    // ensure at least a small playable area
    cols = Math.max(10, cols);
    rows = Math.max(8, rows);

    canvas.width = cols * CELL_SIZE;
    canvas.height = rows * CELL_SIZE;

    // match CSS size so canvas stays centered
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
  }

  // Start/reset the game state
  function startGame() {
    // center the snake
    const startX = Math.floor(cols / 2);
    const startY = Math.floor(rows / 2);
    snake = [{ x: startX, y: startY }];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    speed = INITIAL_SPEED;
    score = 0;
    gameOver = false;
    food = spawnFood();
    playing = true;
    stopGameLoop();
    tickTimer = setInterval(tick, speed);
    draw();
  }

  // Spawn food not on the snake
  function spawnFood() {
    let tries = 0;
    while (tries++ < 1000) {
      const f = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows), type: Math.random() > 0.85 ? 'bonus' : 'normal' };
      if (!snake.some(s => s.x === f.x && s.y === f.y)) return f;
    }
    // fallback
    return { x: 0, y: 0, type: 'normal' };
  }

  // Stop interval if running
  function stopGameLoop() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  // Game tick: move snake, handle food, collisions
  function tick() {
    if (!playing || gameOver) return;

    // commit nextDir to dir (prevent 180 turns)
    if ((nextDir.x !== -dir.x || nextDir.y !== -dir.y)) {
      dir = nextDir;
    }

    // compute new head with wrapping
    const head = snake[0];
    let nx = head.x + dir.x;
    let ny = head.y + dir.y;

    // wrap horizontally
    if (nx < 0) nx = cols - 1;
    if (nx >= cols) nx = 0;
    // wrap vertically
    if (ny < 0) ny = rows - 1;
    if (ny >= rows) ny = 0;

    const newHead = { x: nx, y: ny };

    // check self-collision (only way to die)
    if (snake.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
      gameOver = true;
      playing = false;
      playTone(200, 0.3);
      // update high score
      highScore = Math.max(highScore, score);
      try { localStorage.setItem('jainSnakeHigh', String(highScore)); } catch (e) {}
      draw();
      return;
    }

    // move snake
    snake.unshift(newHead);

    // eat food
    if (newHead.x === food.x && newHead.y === food.y) {
      score += (food.type === 'bonus' ? 10 : 1);
      playTone(food.type === 'bonus' ? 880 : 600, 0.08);
      food = spawnFood();
      // increase speed
      speed = Math.max(MIN_SPEED, speed - SPEED_DECREMENT);
      if (tickTimer) { clearInterval(tickTimer); tickTimer = setInterval(tick, speed); }
    } else {
      // normal move: remove tail
      snake.pop();
    }

    draw();
  }

  // Draw everything (no gridlines or borders)
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // background fill (subtle)
    ctx.fillStyle = 'rgba(10,10,15,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw food (circular)
    if (food) {
      const cx = food.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = food.y * CELL_SIZE + CELL_SIZE / 2;
      const r = CELL_SIZE / 2 - 2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      if (food.type === 'bonus') {
        grad.addColorStop(0, '#fde047');
        grad.addColorStop(1, '#f59e0b');
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
      } else {
        grad.addColorStop(0, '#6ee7b7');
        grad.addColorStop(1, '#10b981');
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // draw snake (head brighter)
    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i];
      const x = seg.x * CELL_SIZE + 2;
      const y = seg.y * CELL_SIZE + 2;
      const size = CELL_SIZE - 4;
      if (i === 0) {
        // head
        const cx = seg.x * CELL_SIZE + CELL_SIZE / 2;
        const cy = seg.y * CELL_SIZE + CELL_SIZE / 2;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, CELL_SIZE / 2);
        g.addColorStop(0, '#c4b5fd');
        g.addColorStop(1, '#7c3aed');
        ctx.fillStyle = g;
      } else {
        const opacity = 1 - (i / snake.length) * 0.6;
        ctx.fillStyle = `rgba(124,58,237,${opacity})`;
      }
      ctx.fillRect(x, y, size, size);
    }

    // draw score/top info (small, unobtrusive)
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '14px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}  Best: ${highScore}`, 8, 18);

    // if game over, show overlay text
    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, canvas.height / 2 - 40, canvas.width, 80);
      ctx.fillStyle = '#f3f4f6';
      ctx.textAlign = 'center';
      ctx.font = '24px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillText(`Game Over — Score: ${score}`, canvas.width / 2, canvas.height / 2 + 8);
      ctx.font = '14px system-ui';
      ctx.fillText(`Type '${HISS_SEQUENCE}' to play again`, canvas.width / 2, canvas.height / 2 + 32);
    }
  }

  // Simple tone using WebAudio
  function playTone(freq, duration) {
    if (!soundEnabled) return;
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ac.destination);
      g.gain.setValueAtTime(0.08, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      o.start();
      o.stop(ac.currentTime + duration);
    } catch (e) {
      // ignore
    }
  }

  // Keyboard handler: movement when playing; sequence detection otherwise
  function keyHandler(e) {
    const key = e.key.toLowerCase();

    // movement keys
    if (playing && !gameOver) {
      if (key === 'arrowup' || key === 'w') {
        if (dir.y !== 1) nextDir = { x: 0, y: -1 };
      } else if (key === 'arrowdown' || key === 's') {
        if (dir.y !== -1) nextDir = { x: 0, y: 1 };
      } else if (key === 'arrowleft' || key === 'a') {
        if (dir.x !== 1) nextDir = { x: -1, y: 0 };
      } else if (key === 'arrowright' || key === 'd') {
        if (dir.x !== -1) nextDir = { x: 1, y: 0 };
      } else if (key === ' ') {
        // space toggles pause
        e.preventDefault();
        playing = !playing;
        if (playing && !gameOver) {
          stopGameLoop();
          tickTimer = setInterval(tick, speed);
        } else {
          stopGameLoop();
        }
      }
      return;
    }

    // If not playing (start screen or game over), collect typed keys for 'hiss'
    if (/^[a-z]$/.test(key)) {
      typedBuffer += key;
      if (typedBuffer.length > HISS_SEQUENCE.length) {
        typedBuffer = typedBuffer.slice(-HISS_SEQUENCE.length);
      }
      if (typedBuffer === HISS_SEQUENCE) {
        // activate
        startGame();
        typedBuffer = '';
      }
    }
  }

  // Load high score from localStorage if available
  function loadHighScore() {
    try {
      const v = localStorage.getItem('jainSnakeHigh');
      if (v) highScore = parseInt(v, 10) || 0;
    } catch (e) {}
  }

  // Public init function
  JainSnake.init = function (opts = {}) {
    if (opts.sound === false) soundEnabled = false;
    if (opts.cellSize && Number.isFinite(opts.cellSize)) {
      // caution: this will not resize canvas automatically for simplicity
    }
    createCanvas();
    loadHighScore();
    // only respond to typed 'hiss' until activation
    window.addEventListener('keydown', keyHandler);
    // initial draw to show passive canvas
    // draw instructions directly on canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(10,10,15,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f3f4f6';
    ctx.textAlign = 'center';
    ctx.font = '20px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.fillText("Type 'hiss' to awaken the snake", canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = '12px system-ui';
    ctx.fillText('Use Arrow Keys or WASD to move • Space to pause', canvas.width / 2, canvas.height / 2 + 14);
  };

  // Expose to global
  global.JainSnake = JainSnake;

})(window);
