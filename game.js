const COLS = 10;
const ROWS = 20;
const EMPTY = 0;

const COLORS = {
  I: "#06b6d4",
  O: "#facc15",
  T: "#a855f7",
  S: "#22c55e",
  Z: "#ef4444",
  J: "#3b82f6",
  L: "#f97316",
};

const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
};

const SCORE_BY_LINES = [0, 100, 300, 500, 800];
const STORAGE_KEY = "tetris_best_score";
const HANDED_KEY = "tetris_handed_mode";
const SETTINGS_KEY = "tetris_settings_v1";

const appEl = document.querySelector(".app");
const boardCanvas = document.getElementById("board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const bestEl = document.getElementById("best");
const statusEl = document.getElementById("status");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const handBtn = document.getElementById("handBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const vibrationToggle = document.getElementById("vibrationToggle");
const gestureToggle = document.getElementById("gestureToggle");
const speedSelect = document.getElementById("speedSelect");
const controlEls = document.querySelectorAll("[data-act]");

const CELL_SIZE = boardCanvas.width / COLS;
const NEXT_CELL = 24;

let board = createBoard();
let current = null;
let next = null;
let bag = [];
let score = 0;
let level = 1;
let dropCounter = 0;
let lastTime = 0;
let isPaused = false;
let isOver = false;
let best = Number(localStorage.getItem(STORAGE_KEY) || 0);
let handedMode = localStorage.getItem(HANDED_KEY) || "right";
let settings = loadSettings();
let holdTimer = null;
let holdAct = null;
let gesture = null;

bestEl.textContent = String(best);

function applyHandedMode(mode) {
  handedMode = mode === "left" ? "left" : "right";
  appEl.classList.toggle("handed-left", handedMode === "left");
  handBtn.textContent = handedMode === "left" ? "左手" : "右手";
  localStorage.setItem(HANDED_KEY, handedMode);
}

function loadSettings() {
  const defaults = { vibration: true, gesture: true, speed: "normal" };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const data = JSON.parse(raw);
    return {
      vibration: typeof data.vibration === "boolean" ? data.vibration : defaults.vibration,
      gesture: typeof data.gesture === "boolean" ? data.gesture : defaults.gesture,
      speed: ["slow", "normal", "fast"].includes(data.speed) ? data.speed : defaults.speed,
    };
  } catch (e) {
    return defaults;
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function syncSettingsUI() {
  vibrationToggle.checked = settings.vibration;
  gestureToggle.checked = settings.gesture;
  speedSelect.value = settings.speed;
}

function buzz(pattern) {
  if (settings.vibration && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

function createBag() {
  const pieces = Object.keys(SHAPES);
  for (let i = pieces.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  return pieces;
}

function pieceFromType(type) {
  return {
    type,
    matrix: SHAPES[type].map((row) => [...row]),
    x: Math.floor(COLS / 2) - 1,
    y: 0,
  };
}

function nextPiece() {
  if (bag.length === 0) {
    bag = createBag();
  }
  return pieceFromType(bag.pop());
}

function resetGame() {
  board = createBoard();
  bag = [];
  score = 0;
  level = 1;
  isPaused = false;
  isOver = false;
  current = nextPiece();
  next = nextPiece();
  updateHUD();
  statusEl.textContent = "游戏中";
}

function updateHUD() {
  scoreEl.textContent = String(score);
  levelEl.textContent = String(level);
  bestEl.textContent = String(best);
}

function collision(piece, dx = 0, dy = 0, matrix = piece.matrix) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) continue;
      const nx = piece.x + x + dx;
      const ny = piece.y + y + dy;
      if (nx < 0 || nx >= COLS || ny >= ROWS) {
        return true;
      }
      if (ny >= 0 && board[ny][nx] !== EMPTY) {
        return true;
      }
    }
  }
  return false;
}

function merge(piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value && piece.y + y >= 0) {
        board[piece.y + y][piece.x + x] = piece.type;
      }
    });
  });
}

function rotateMatrix(matrix) {
  const h = matrix.length;
  const w = matrix[0].length;
  const out = Array.from({ length: w }, () => Array(h).fill(0));
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      out[x][h - 1 - y] = matrix[y][x];
    }
  }
  return out;
}

function rotatePiece() {
  const rotated = rotateMatrix(current.matrix);
  const kicks = [0, -1, 1, -2, 2];
  for (const k of kicks) {
    if (!collision(current, k, 0, rotated)) {
      current.matrix = rotated;
      current.x += k;
      return;
    }
  }
}

function clearLines() {
  let lines = 0;
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every((cell) => cell !== EMPTY)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(EMPTY));
      lines += 1;
      y += 1;
    }
  }

  if (lines > 0) {
    score += SCORE_BY_LINES[lines] * level;
    level = Math.floor(score / 1000) + 1;
    buzz(lines >= 2 ? [30, 30, 30] : 35);
    if (score > best) {
      best = score;
      localStorage.setItem(STORAGE_KEY, String(best));
    }
    updateHUD();
  }

  return lines;
}

function spawnPiece() {
  current = next;
  next = nextPiece();
  current.x = Math.floor((COLS - current.matrix[0].length) / 2);
  current.y = 0;

  if (collision(current)) {
    isOver = true;
    clearHold();
    clearGesture();
    statusEl.textContent = "游戏结束，点击重新开始";
  }
}

function hardDrop() {
  while (!collision(current, 0, 1)) {
    current.y += 1;
    score += 2;
  }
  lockPiece();
}

function softDrop() {
  if (!collision(current, 0, 1)) {
    current.y += 1;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge(current);
  const cleared = clearLines();
  if (!isOver && cleared === 0) {
    buzz(14);
  }
  spawnPiece();
  updateHUD();
}

function move(dir) {
  if (!collision(current, dir, 0)) {
    current.x += dir;
  }
}

function drawCell(ctx, x, y, type, size) {
  ctx.fillStyle = COLORS[type];
  ctx.fillRect(x * size, y * size, size, size);
  ctx.strokeStyle = "rgba(15,23,42,0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x * size + 1, y * size + 1, size - 2, size - 2);
}

function getGhostY(piece) {
  let y = piece.y;
  while (!collision(piece, 0, y - piece.y + 1)) {
    y += 1;
  }
  return y;
}

function drawGhostPiece() {
  if (!current || isOver) return;
  const ghostY = getGhostY(current);
  if (ghostY === current.y) return;

  boardCtx.save();
  boardCtx.globalAlpha = 0.28;
  current.matrix.forEach((row, y) => {
    row.forEach((v, x) => {
      if (!v) return;
      boardCtx.fillStyle = COLORS[current.type];
      boardCtx.fillRect((current.x + x) * CELL_SIZE, (ghostY + y) * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      boardCtx.strokeStyle = "rgba(255,255,255,0.45)";
      boardCtx.lineWidth = 1.5;
      boardCtx.strokeRect((current.x + x) * CELL_SIZE + 1, (ghostY + y) * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    });
  });
  boardCtx.restore();
}

function drawBoard() {
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const type = board[y][x];
      if (type !== EMPTY) {
        drawCell(boardCtx, x, y, type, CELL_SIZE);
      }
    }
  }

  drawGhostPiece();

  if (current) {
    current.matrix.forEach((row, y) => {
      row.forEach((v, x) => {
        if (v) {
          drawCell(boardCtx, current.x + x, current.y + y, current.type, CELL_SIZE);
        }
      });
    });
  }
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!next) return;

  const matrix = next.matrix;
  const offsetX = Math.floor((nextCanvas.width - matrix[0].length * NEXT_CELL) / 2 / NEXT_CELL);
  const offsetY = Math.floor((nextCanvas.height - matrix.length * NEXT_CELL) / 2 / NEXT_CELL);

  matrix.forEach((row, y) => {
    row.forEach((v, x) => {
      if (v) {
        drawCell(nextCtx, x + offsetX, y + offsetY, next.type, NEXT_CELL);
      }
    });
  });
}

function tick(time = 0) {
  if (!lastTime) lastTime = time;
  const delta = time - lastTime;
  lastTime = time;

  if (!isPaused && !isOver) {
    dropCounter += delta;
    const baseSpeed = Math.max(80, 700 - (level - 1) * 55);
    const speedScale = settings.speed === "slow" ? 1.2 : settings.speed === "fast" ? 0.82 : 1;
    const speed = Math.max(55, Math.floor(baseSpeed * speedScale));
    if (dropCounter > speed) {
      softDrop();
      dropCounter = 0;
    }
  }

  drawBoard();
  drawNext();
  requestAnimationFrame(tick);
}

function action(act) {
  if (isOver && act !== "restart") return;

  switch (act) {
    case "left":
      if (!isPaused) move(-1);
      break;
    case "right":
      if (!isPaused) move(1);
      break;
    case "rotate":
      if (!isPaused) rotatePiece();
      break;
    case "soft":
      if (!isPaused) softDrop();
      break;
    case "drop":
      if (!isPaused) hardDrop();
      break;
    case "pause":
      if (!isOver) {
        clearHold();
        clearGesture();
        isPaused = !isPaused;
        pauseBtn.textContent = isPaused ? "继续" : "暂停";
        statusEl.textContent = isPaused ? "已暂停" : "游戏中";
      }
      break;
    case "restart":
      clearHold();
      clearGesture();
      pauseBtn.textContent = "暂停";
      resetGame();
      break;
    default:
      break;
  }
}

function clearHold() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  holdAct = null;
}

function clearGesture() {
  gesture = null;
}

function startHold(act) {
  const repeatable = act === "left" || act === "right" || act === "soft";
  if (!repeatable) return;

  clearHold();
  holdAct = act;

  const loop = () => {
    if (holdAct !== act || isPaused || isOver) return;
    action(act);
    holdTimer = setTimeout(loop, 60);
  };

  holdTimer = setTimeout(loop, 150);
}

window.addEventListener("keydown", (e) => {
  const map = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "rotate",
    ArrowDown: "soft",
    " ": "drop",
    p: "pause",
    P: "pause",
  };
  const act = map[e.key];
  if (act) {
    e.preventDefault();
    action(act);
  }
});

boardCanvas.addEventListener("pointerdown", (e) => {
  if (isPaused || isOver || !settings.gesture) return;
  gesture = {
    id: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    lastMoveX: e.clientX,
    moved: false,
  };
});

boardCanvas.addEventListener("pointermove", (e) => {
  if (!settings.gesture || !gesture || gesture.id !== e.pointerId || isPaused || isOver) return;
  const dx = e.clientX - gesture.startX;
  const dy = e.clientY - gesture.startY;

  if (Math.abs(dx) > Math.abs(dy)) {
    const step = 22;
    const delta = e.clientX - gesture.lastMoveX;
    if (Math.abs(delta) >= step) {
      action(delta > 0 ? "right" : "left");
      gesture.lastMoveX = e.clientX;
      gesture.moved = true;
    }
    return;
  }

  if (dy > 28) {
    action("soft");
    gesture.startY = e.clientY;
    gesture.moved = true;
    return;
  }

  if (dy < -34 && !gesture.moved) {
    action("rotate");
    gesture.moved = true;
  }
});

boardCanvas.addEventListener("pointerup", (e) => {
  if (!settings.gesture || !gesture || gesture.id !== e.pointerId) return;
  const dx = e.clientX - gesture.startX;
  const dy = e.clientY - gesture.startY;
  const movedLittle = Math.abs(dx) < 8 && Math.abs(dy) < 8;
  if (movedLittle && !isPaused && !isOver) {
    action("rotate");
  }
  clearGesture();
});

boardCanvas.addEventListener("pointercancel", clearGesture);
boardCanvas.addEventListener("pointerleave", clearGesture);

controlEls.forEach((el) => {
  const act = el.getAttribute("data-act");

  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    action(act);
    startHold(act);
  });

  const stop = () => clearHold();
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointercancel", stop);
  el.addEventListener("pointerleave", stop);
});

pauseBtn.addEventListener("click", () => action("pause"));
restartBtn.addEventListener("click", () => action("restart"));
handBtn.addEventListener("click", () => {
  applyHandedMode(handedMode === "left" ? "right" : "left");
});
settingsBtn.addEventListener("click", () => {
  settingsPanel.classList.remove("hidden");
});
closeSettingsBtn.addEventListener("click", () => {
  settingsPanel.classList.add("hidden");
});
settingsPanel.addEventListener("click", (e) => {
  if (e.target === settingsPanel) {
    settingsPanel.classList.add("hidden");
  }
});
vibrationToggle.addEventListener("change", () => {
  settings.vibration = vibrationToggle.checked;
  saveSettings();
});
gestureToggle.addEventListener("change", () => {
  settings.gesture = gestureToggle.checked;
  clearGesture();
  saveSettings();
});
speedSelect.addEventListener("change", () => {
  settings.speed = speedSelect.value;
  saveSettings();
});

applyHandedMode(handedMode);
syncSettingsUI();
resetGame();
requestAnimationFrame(tick);
