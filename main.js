const CONFIG = {
  canvas: { width: 1280, height: 720 },
  world: { gravity: 2200, groundY: 610, friction: 0.85 },
  player: {
    w: 40,
    h: 70,
    moveAccel: 4200,
    maxSpeedX: 540,
    jumpVel: -880,
    dashSpeed: 980,
    dashDuration: 0.15,
    dashCooldown: 0.32,
    slideSpeed: 760,
    slideDuration: 0.32,
    slideCooldown: 0.28,
    shootCooldown: 0.08,
    bulletSpeed: 1200,
    bulletLife: 0.8,
  },
  enemy: {
    telegraphTime: 0.8,
    coolTime: 1.0,
    shotSpeed: 1400,
    bulletLife: 1.4,
  },
  camera: { lerp: 0.16 },
};

const ASSETS = {
  // TODO: Swap these with actual sprite paths in /assets later
  playerSprite: null,
  droneSprite: null,
  bgLayer1: null,
  bgLayer2: null,
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = CONFIG.canvas.width;
canvas.height = CONFIG.canvas.height;

const input = {
  held: new Set(),
  pressed: new Set(),
};

const keys = {
  left: ["a", "ArrowLeft"],
  right: ["d", "ArrowRight"],
  jump: [" ", "w", "ArrowUp"],
  dash: ["Shift"],
  slide: ["Control", "c"],
  shoot: ["j", "z"],
  aimUp: ["i"],
  aimDown: ["k"],
  aimLeft: ["j", "u"],
  aimRight: ["l", "o"],
};

const state = {
  time: 0,
  camX: 0,
  playerBullets: [],
  enemyBullets: [],
  enemies: [],
};

const player = {
  x: 220,
  y: CONFIG.world.groundY - CONFIG.player.h,
  vx: 0,
  vy: 0,
  w: CONFIG.player.w,
  h: CONFIG.player.h,
  facing: 1,
  aim: { x: 1, y: 0 },
  grounded: true,
  state: "run",
  dashTimer: 0,
  dashCD: 0,
  slideTimer: 0,
  slideCD: 0,
  shootTimer: 0,
};

function spawnEnemy(x, y) {
  return {
    x,
    y,
    w: 56,
    h: 36,
    mode: "telegraph",
    timer: CONFIG.enemy.telegraphTime,
    target: { x: player.x, y: player.y },
  };
}

state.enemies.push(spawnEnemy(780, 260));
state.enemies.push(spawnEnemy(1180, 200));

window.addEventListener("keydown", (e) => {
  if (!input.held.has(e.key)) input.pressed.add(e.key);
  input.held.add(e.key);
});

window.addEventListener("keyup", (e) => {
  input.held.delete(e.key);
});

function isHeld(action) {
  return keys[action].some((k) => input.held.has(k));
}

function isPressed(action) {
  return keys[action].some((k) => input.pressed.has(k));
}

function normalize(vx, vy) {
  const m = Math.hypot(vx, vy) || 1;
  return { x: vx / m, y: vy / m };
}

function updatePlayer(dt) {
  const move = (isHeld("right") ? 1 : 0) - (isHeld("left") ? 1 : 0);
  const jump = isPressed("jump");

  if (move !== 0) player.facing = move;

  if (player.dashTimer <= 0 && player.slideTimer <= 0) {
    player.vx += move * CONFIG.player.moveAccel * dt;
    const max = CONFIG.player.maxSpeedX;
    player.vx = Math.max(-max, Math.min(max, player.vx));
    if (move === 0) player.vx *= CONFIG.world.friction;
  }

  if (jump && player.grounded) {
    player.vy = CONFIG.player.jumpVel;
    player.grounded = false;
  }

  if (isPressed("dash") && player.dashCD <= 0) {
    player.dashTimer = CONFIG.player.dashDuration;
    player.dashCD = CONFIG.player.dashCooldown;
    player.vx = player.facing * CONFIG.player.dashSpeed;
    player.vy = 0;
    player.state = "dash";
  }

  if (isPressed("slide") && player.slideCD <= 0 && player.grounded && player.dashTimer <= 0) {
    player.slideTimer = CONFIG.player.slideDuration;
    player.slideCD = CONFIG.player.slideCooldown;
    player.vx = player.facing * CONFIG.player.slideSpeed;
    player.state = "slide";
  }

  const ax = (isHeld("aimRight") ? 1 : 0) - (isHeld("aimLeft") ? 1 : 0);
  const ay = (isHeld("aimDown") ? 1 : 0) - (isHeld("aimUp") ? 1 : 0);
  if (ax !== 0 || ay !== 0) {
    const n = normalize(ax, ay);
    player.aim = { x: Math.round(n.x * Math.SQRT2) / Math.SQRT2, y: Math.round(n.y * Math.SQRT2) / Math.SQRT2 };
  } else {
    player.aim = { x: player.facing, y: 0 };
  }

  if (isHeld("shoot") && player.shootTimer <= 0) {
    const dir = normalize(player.aim.x, player.aim.y);
    state.playerBullets.push({
      x: player.x + player.w * 0.5,
      y: player.y + player.h * 0.4,
      vx: dir.x * CONFIG.player.bulletSpeed,
      vy: dir.y * CONFIG.player.bulletSpeed,
      life: CONFIG.player.bulletLife,
    });
    player.shootTimer = CONFIG.player.shootCooldown;
  }

  player.dashTimer -= dt;
  player.dashCD -= dt;
  player.slideTimer -= dt;
  player.slideCD -= dt;
  player.shootTimer -= dt;

  if (player.dashTimer <= 0 && player.slideTimer <= 0) {
    player.vy += CONFIG.world.gravity * dt;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const ground = CONFIG.world.groundY - player.h;
  if (player.y >= ground) {
    player.y = ground;
    player.vy = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  if (player.dashTimer > 0) player.state = "dash";
  else if (player.slideTimer > 0) player.state = "slide";
  else if (!player.grounded) player.state = player.vy < 0 ? "jump" : "fall";
  else if (Math.abs(player.vx) > 30) player.state = "run";
  else player.state = "idle";
}

function updateBullets(dt, list) {
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) list.splice(i, 1);
  }
}

function updateEnemies(dt) {
  state.enemies.forEach((e) => {
    e.timer -= dt;
    if (e.mode === "telegraph") {
      e.target = { x: player.x + player.w * 0.5, y: player.y + player.h * 0.4 };
      if (e.timer <= 0) {
        const dir = normalize(e.target.x - (e.x + e.w * 0.5), e.target.y - (e.y + e.h * 0.5));
        state.enemyBullets.push({
          x: e.x + e.w * 0.5,
          y: e.y + e.h * 0.5,
          vx: dir.x * CONFIG.enemy.shotSpeed,
          vy: dir.y * CONFIG.enemy.shotSpeed,
          life: CONFIG.enemy.bulletLife,
        });
        e.mode = "cooldown";
        e.timer = CONFIG.enemy.coolTime;
      }
    } else if (e.timer <= 0) {
      e.mode = "telegraph";
      e.timer = CONFIG.enemy.telegraphTime;
    }
  });
}

function rectHit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function checkEnemyBullets() {
  const hurtbox = { x: player.x + 6, y: player.y + 8, w: player.w - 12, h: player.h - 10 };
  for (const b of state.enemyBullets) {
    const r = { x: b.x - 4, y: b.y - 4, w: 8, h: 8 };
    if (rectHit(hurtbox, r)) {
      if (player.state !== "dash" && player.state !== "slide") {
        player.x = 220;
        player.y = CONFIG.world.groundY - player.h;
        player.vx = 0;
        player.vy = 0;
      }
      break;
    }
  }
}

function updateCamera() {
  const target = player.x - canvas.width * 0.3;
  state.camX += (target - state.camX) * CONFIG.camera.lerp;
  state.camX = Math.max(0, state.camX);
}

function drawBackground() {
  ctx.fillStyle = "#081025";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const x1 = -(state.camX * 0.2) % canvas.width;
  ctx.fillStyle = "rgba(90,130,255,0.12)";
  for (let i = -1; i < 2; i++) {
    ctx.fillRect(x1 + i * canvas.width, 460, canvas.width, 220);
  }

  ctx.fillStyle = "#1e2e4c";
  for (let i = 0; i < 40; i++) {
    const bx = i * 180 - (state.camX * 0.5) % 180;
    ctx.fillRect(bx, 520 - (i % 5) * 15, 100, 200);
  }
}

function drawWorld() {
  ctx.save();
  ctx.translate(-state.camX, 0);

  ctx.fillStyle = "#0f1a34";
  ctx.fillRect(-2000, CONFIG.world.groundY, 6000, canvas.height - CONFIG.world.groundY);

  ctx.fillStyle = "#8fd3ff";
  ctx.fillRect(player.x, player.y, player.w, player.h);

  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(player.x + player.w * 0.5, player.y + player.h * 0.4);
  ctx.lineTo(
    player.x + player.w * 0.5 + player.aim.x * 60,
    player.y + player.h * 0.4 + player.aim.y * 60
  );
  ctx.stroke();

  for (const b of state.playerBullets) {
    ctx.fillStyle = "#ffe18a";
    ctx.fillRect(b.x - 3, b.y - 3, 6, 6);
  }

  for (const e of state.enemies) {
    ctx.fillStyle = "#7a8ea8";
    ctx.fillRect(e.x, e.y, e.w, e.h);

    if (e.mode === "telegraph") {
      ctx.strokeStyle = "rgba(255, 30, 30, 0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x + e.w * 0.5, e.y + e.h * 0.5);
      ctx.lineTo(e.target.x, e.target.y);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  for (const b of state.enemyBullets) {
    ctx.fillStyle = "#ff4f4f";
    ctx.fillRect(b.x - 4, b.y - 4, 8, 8);
  }

  ctx.restore();
}

function drawDebug() {
  ctx.fillStyle = "rgba(0,0,0,0.48)";
  ctx.fillRect(8, 8, 330, 140);
  ctx.fillStyle = "#bfe4ff";
  ctx.font = "16px monospace";
  const speed = Math.hypot(player.vx, player.vy).toFixed(1);
  const aim = `${player.aim.x.toFixed(2)}, ${player.aim.y.toFixed(2)}`;
  const lines = [
    `State: ${player.state}`,
    `Speed: ${speed}`,
    `Grounded: ${player.grounded}`,
    `Aim: ${aim}`,
    `Pos: ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`,
    `Enemy Bullets: ${state.enemyBullets.length}`,
  ];
  lines.forEach((t, i) => ctx.fillText(t, 16, 32 + i * 20));
}

let last = performance.now();
function frame(ts) {
  const dt = Math.min((ts - last) / 1000, 0.033);
  last = ts;
  state.time += dt;

  updatePlayer(dt);
  updateEnemies(dt);
  updateBullets(dt, state.playerBullets);
  updateBullets(dt, state.enemyBullets);
  checkEnemyBullets();
  updateCamera();

  drawBackground();
  drawWorld();
  drawDebug();

  input.pressed.clear();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
