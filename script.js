const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const SCORE_TABLE = [0, 100, 300, 500, 800];
const COLORS = {
  I: "#20c7e6",
  J: "#4f7ff0",
  L: "#f29a2e",
  O: "#f2d94e",
  S: "#50d66a",
  T: "#b56cf2",
  Z: "#ef5f6c",
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const boardCanvas = document.querySelector("#board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.querySelector("#next");
const nextCtx = nextCanvas.getContext("2d");
const holdCanvas = document.querySelector("#hold");
const holdCtx = holdCanvas.getContext("2d");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const scoreEl = document.querySelector("#score");
const bestScoreEl = document.querySelector("#best-score");
const linesEl = document.querySelector("#lines");
const levelEl = document.querySelector("#level");
const ghostToggle = document.querySelector("#ghost-toggle");
const soundToggle = document.querySelector("#sound-toggle");

let board;
let current;
let next;
let hold = null;
let canHold = true;
let bag = [];
let score = 0;
let bestScore = Number(localStorage.getItem("classic-tetris-best") || 0);
let lines = 0;
let level = 1;
let dropCounter = 0;
let lockCounter = 0;
let lastTime = 0;
let running = false;
let paused = false;
let gameOver = false;
let animationId = null;
let ghostPreviewEnabled = false;
let soundEnabled = true;
let audioContext = null;
let masterGain = null;

bestScoreEl.textContent = formatNumber(bestScore);
resetBoard();
draw();

function resetBoard() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function createPiece(type) {
  const matrix = SHAPES[type].map((row) => [...row]);
  return {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: type === "I" ? -1 : 0,
  };
}

function randomPieceType() {
  if (bag.length === 0) {
    bag = Object.keys(SHAPES);
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  return bag.pop();
}

function spawnPiece() {
  current = next || createPiece(randomPieceType());
  next = createPiece(randomPieceType());
  canHold = true;
  dropCounter = 0;
  lockCounter = 0;

  if (collides(current.matrix, current.x, current.y)) {
    endGame();
  }
}

function startGame() {
  resetBoard();
  bag = [];
  current = null;
  next = null;
  hold = null;
  canHold = true;
  score = 0;
  lines = 0;
  level = 1;
  dropCounter = 0;
  lockCounter = 0;
  lastTime = 0;
  running = true;
  paused = false;
  gameOver = false;
  overlayTitle.textContent = "Classic Tetris";
  startButton.textContent = "게임 시작";
  pauseButton.textContent = "일시정지";
  overlay.hidden = true;
  spawnPiece();
  updateStats();
  draw();
  playSound("start");

  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  animationId = requestAnimationFrame(update);
}

function togglePause() {
  if (!running || gameOver) return;
  paused = !paused;
  pauseButton.textContent = paused ? "계속" : "일시정지";
  overlayTitle.textContent = paused ? "Paused" : "";
  startButton.textContent = "계속하기";
  overlay.hidden = !paused;
  playSound(paused ? "pause" : "resume");
  if (!paused) {
    lastTime = 0;
    animationId = requestAnimationFrame(update);
  }
}

function endGame() {
  if (gameOver) return;
  running = false;
  gameOver = true;
  paused = false;
  overlayTitle.textContent = "Game Over";
  startButton.textContent = "다시 시작";
  overlay.hidden = false;
  playSound("gameOver");
}

function update(time = 0) {
  if (!running || paused) return;

  const delta = lastTime ? time - lastTime : 0;
  lastTime = time;
  dropCounter += delta;

  if (current && isPieceLanded()) {
    lockCounter += delta;
    if (lockCounter >= getLockDelay()) {
      lockPiece();
    }
  } else {
    lockCounter = 0;
  }

  if (canControl() && !isPieceLanded() && dropCounter > getDropInterval()) {
    softDrop(false);
  }

  draw();
  animationId = requestAnimationFrame(update);
}

function getDropInterval() {
  return Math.max(90, 850 - (level - 1) * 70);
}

function getLockDelay() {
  return Math.max(140, 560 - (level - 1) * 35);
}

function move(dx) {
  if (!canControl()) return;
  if (!collides(current.matrix, current.x + dx, current.y)) {
    current.x += dx;
    refreshLockStateAfterMove();
    playSound("move");
    draw();
  }
}

function softDrop(addPoint = true) {
  if (!canControl()) return;
  if (!collides(current.matrix, current.x, current.y + 1)) {
    current.y += 1;
    lockCounter = 0;
    if (addPoint) {
      score += 1;
      updateStats();
      playSound("softDrop");
    }
  }
  dropCounter = 0;
  draw();
}

function hardDrop() {
  if (!canControl()) return;
  const startY = current.y;
  while (!collides(current.matrix, current.x, current.y + 1)) {
    current.y += 1;
  }
  score += Math.max(0, current.y - startY) * 2;
  lockPiece("drop");
  dropCounter = 0;
  updateStats();
  draw();
}

function rotatePiece(direction = 1) {
  if (!canControl()) return;
  if (current.type === "O") return;

  const rotated = rotateMatrix(current.matrix, direction);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collides(rotated, current.x + kick, current.y)) {
      current.matrix = rotated;
      current.x += kick;
      refreshLockStateAfterMove();
      playSound("rotate");
      draw();
      return;
    }
  }
}

function holdPiece() {
  if (!canControl() || !canHold) return;
  const heldType = hold?.type;
  hold = createPiece(current.type);
  if (heldType) {
    current = createPiece(heldType);
  } else {
    current = next;
    next = createPiece(randomPieceType());
  }
  canHold = false;
  dropCounter = 0;
  lockCounter = 0;
  playSound("hold");
  if (collides(current.matrix, current.x, current.y)) {
    endGame();
  }
  draw();
}

function lockPiece(lockSound = "lock") {
  let toppedOut = false;

  forEachBlock(current.matrix, current.x, current.y, (x, y) => {
    if (y >= 0) {
      board[y][x] = current.type;
    } else {
      toppedOut = true;
    }
  });

  if (toppedOut) {
    endGame();
    return;
  }

  const result = clearLines();
  if (result.cleared > 0) {
    playSound(result.leveledUp ? "levelUp" : "clear", result.cleared);
  } else {
    playSound(lockSound);
  }
  spawnPiece();
}

function clearLines() {
  let cleared = 0;
  const previousLevel = level;

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    score += SCORE_TABLE[cleared] * level;
    updateStats();
  }

  return {
    cleared,
    leveledUp: level > previousLevel,
  };
}

function collides(matrix, offsetX, offsetY) {
  let hit = false;
  forEachBlock(matrix, offsetX, offsetY, (x, y) => {
    if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])) {
      hit = true;
    }
  });
  return hit;
}

function isPieceLanded() {
  return current ? collides(current.matrix, current.x, current.y + 1) : false;
}

function refreshLockStateAfterMove() {
  if (!isPieceLanded()) {
    lockCounter = 0;
  }
}

function forEachBlock(matrix, offsetX, offsetY, callback) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) callback(x + offsetX, y + offsetY);
    });
  });
}

function rotateMatrix(matrix, direction) {
  const size = matrix.length;
  const rotated = Array.from({ length: size }, () => Array(size).fill(0));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (direction > 0) {
        rotated[x][size - 1 - y] = matrix[y][x];
      } else {
        rotated[size - 1 - x][y] = matrix[y][x];
      }
    }
  }
  return rotated;
}

function getGhostPiece() {
  const ghost = {
    ...current,
    matrix: current.matrix,
    y: current.y,
  };
  while (!collides(ghost.matrix, ghost.x, ghost.y + 1)) {
    ghost.y += 1;
  }
  return ghost;
}

function draw() {
  drawBoard();
  drawPreview(nextCtx, next);
  drawPreview(holdCtx, hold);
}

function drawBoard() {
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  drawGrid(boardCtx, COLS, ROWS, BLOCK);

  board.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type) drawCell(boardCtx, x, y, COLORS[type], 1);
    });
  });

  if (current) {
    if (ghostPreviewEnabled) {
      const ghost = getGhostPiece();
      forEachBlock(ghost.matrix, ghost.x, ghost.y, (x, y) => {
        if (y >= 0) drawCell(boardCtx, x, y, COLORS[current.type], 0.22);
      });
    }
    forEachBlock(current.matrix, current.x, current.y, (x, y) => {
      if (y >= 0) drawCell(boardCtx, x, y, COLORS[current.type], 1);
    });
  }
}

function drawPreview(ctx, piece) {
  const size = ctx.canvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#10131a";
  ctx.fillRect(0, 0, size, size);

  if (!piece) return;

  const matrix = piece.matrix;
  const blockSize = piece.type === "I" ? 22 : 26;
  const active = getBounds(matrix);
  const width = (active.maxX - active.minX + 1) * blockSize;
  const height = (active.maxY - active.minY + 1) * blockSize;
  const offsetX = Math.floor((size - width) / 2) - active.minX * blockSize;
  const offsetY = Math.floor((size - height) / 2) - active.minY * blockSize;

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawPixelCell(
          ctx,
          offsetX + x * blockSize,
          offsetY + y * blockSize,
          blockSize,
          COLORS[piece.type],
          1,
        );
      }
    });
  });
}

function getBounds(matrix) {
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      bounds.minX = Math.min(bounds.minX, x);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxY = Math.max(bounds.maxY, y);
    });
  });
  return bounds;
}

function drawGrid(ctx, cols, rows, blockSize) {
  ctx.fillStyle = "#0c0f14";
  ctx.fillRect(0, 0, cols * blockSize, rows * blockSize);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.055)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= cols; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * blockSize + 0.5, 0);
    ctx.lineTo(x * blockSize + 0.5, rows * blockSize);
    ctx.stroke();
  }

  for (let y = 0; y <= rows; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * blockSize + 0.5);
    ctx.lineTo(cols * blockSize, y * blockSize + 0.5);
    ctx.stroke();
  }
}

function drawCell(ctx, x, y, color, alpha) {
  drawPixelCell(ctx, x * BLOCK, y * BLOCK, BLOCK, color, alpha);
}

function drawPixelCell(ctx, x, y, size, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.fillRect(x + 3, y + 3, size - 6, Math.max(3, size * 0.18));
  ctx.strokeStyle = "rgba(0, 0, 0, 0.24)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
  ctx.restore();
}

function updateStats() {
  scoreEl.textContent = formatNumber(score);
  linesEl.textContent = formatNumber(lines);
  levelEl.textContent = formatNumber(level);
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("classic-tetris-best", String(bestScore));
    bestScoreEl.textContent = formatNumber(bestScore);
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function canControl() {
  return running && !paused && !gameOver && current;
}

function unlockAudio() {
  if (!soundEnabled || !AudioContextClass) return null;

  if (!audioContext) {
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.28;
    masterGain.connect(audioContext.destination);
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function playSound(name, detail = 0) {
  if (!soundEnabled) return;

  switch (name) {
    case "start":
      playTone(330, 0.06, { gain: 0.035, type: "triangle" });
      playTone(494, 0.08, { delay: 0.055, gain: 0.04, type: "triangle" });
      break;
    case "move":
      playTone(210, 0.035, { endFrequency: 165, gain: 0.02, type: "triangle" });
      break;
    case "rotate":
      playTone(360, 0.055, { endFrequency: 520, gain: 0.028, type: "square" });
      break;
    case "softDrop":
      playTone(120, 0.03, { endFrequency: 92, gain: 0.018, type: "triangle" });
      break;
    case "drop":
      playTone(140, 0.12, { endFrequency: 44, gain: 0.065, type: "sawtooth" });
      break;
    case "lock":
      playTone(92, 0.075, { endFrequency: 58, gain: 0.04, type: "sawtooth" });
      break;
    case "hold":
      playTone(262, 0.05, { gain: 0.026, type: "triangle" });
      playTone(330, 0.05, { delay: 0.045, gain: 0.03, type: "triangle" });
      break;
    case "clear":
      playClearSound(Number(detail) || 1);
      break;
    case "levelUp":
      [392, 523, 659, 880].forEach((frequency, index) => {
        playTone(frequency, 0.085, {
          delay: index * 0.055,
          gain: 0.045,
          type: "triangle",
        });
      });
      break;
    case "pause":
      playTone(196, 0.08, { endFrequency: 130, gain: 0.025, type: "triangle" });
      break;
    case "resume":
      playTone(262, 0.045, { gain: 0.026, type: "triangle" });
      playTone(392, 0.06, { delay: 0.045, gain: 0.03, type: "triangle" });
      break;
    case "gameOver":
      [330, 247, 185, 139].forEach((frequency, index) => {
        playTone(frequency, 0.13, {
          delay: index * 0.095,
          gain: 0.045,
          type: "sawtooth",
        });
      });
      break;
    default:
      break;
  }
}

function playClearSound(lineCount) {
  const notes = [392, 494, 587, 784];
  const noteCount = Math.min(notes.length, lineCount + 1);
  for (let i = 0; i < noteCount; i += 1) {
    playTone(notes[i], 0.08, {
      delay: i * 0.055,
      gain: lineCount === 4 ? 0.055 : 0.04,
      type: "triangle",
    });
  }
}

function playTone(frequency, duration, options = {}) {
  const context = unlockAudio();
  if (!context || !masterGain) return;

  const startTime = context.currentTime + (options.delay || 0);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const peakGain = options.gain ?? 0.04;

  oscillator.type = options.type || "square";
  oscillator.frequency.setValueAtTime(frequency, startTime);
  if (options.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, options.endFrequency),
      startTime + duration,
    );
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

function handleAction(action) {
  if (!running) {
    if (action === "restart") {
      startGame();
    }
    return;
  }

  switch (action) {
    case "left":
      move(-1);
      break;
    case "right":
      move(1);
      break;
    case "down":
      softDrop(true);
      break;
    case "drop":
      hardDrop();
      break;
    case "rotate":
      rotatePiece(1);
      break;
    case "rotateBack":
      rotatePiece(-1);
      break;
    case "hold":
      holdPiece();
      break;
    case "pause":
      togglePause();
      break;
    case "restart":
      startGame();
      break;
    default:
      break;
  }
}

document.addEventListener("keydown", (event) => {
  const keys = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowDown: "down",
    ArrowUp: "rotateBack",
    z: "rotateBack",
    Z: "rotateBack",
    x: "rotate",
    X: "rotate",
    c: "hold",
    C: "hold",
    " ": "drop",
    p: "pause",
    P: "pause",
    Escape: "pause",
  };

  const action = keys[event.key];
  if (!action) return;
  event.preventDefault();
  handleAction(action);
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handleAction(button.dataset.action);
  });
});

ghostToggle.addEventListener("change", () => {
  ghostPreviewEnabled = ghostToggle.checked;
  draw();
});

soundToggle.addEventListener("change", () => {
  soundEnabled = soundToggle.checked;
  if (soundEnabled) {
    playSound("resume");
  }
});

startButton.addEventListener("click", () => {
  if (paused) {
    togglePause();
  } else {
    startGame();
  }
});
pauseButton.addEventListener("click", () => handleAction("pause"));
restartButton.addEventListener("click", () => handleAction("restart"));
