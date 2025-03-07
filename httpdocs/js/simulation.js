// -------------------------
// Module Imports & Aliases
// -------------------------
import Matter from "https://cdn.jsdelivr.net/npm/matter-js@0.19.0/+esm";
import 'https://cdn.jsdelivr.net/npm/poly-decomp@0.3.0/build/decomp.min.js';
import 'https://cdn.jsdelivr.net/npm/pathseg@1.2.1/pathseg.min.js';

const { Engine, Render, Runner, Bodies, Composite, Svg, Events, Mouse, MouseConstraint } = Matter;

// -------------------------
// Constants
// -------------------------

// Canvas Dimensions
const CANVAS_WIDTH  = 400;
const CANVAS_HEIGHT = 750;

// Simulation Constants
const BALL_RADIUS   = 4;
const BALL_DIAMETER = BALL_RADIUS * 2;
const BALL_OPTIONS  = {
    restitution: 0.5,
    friction: 0.001,
    frictionAir: 0.0001,
    render: { 
        fillStyle: 'rgb(166 219 251)',
    },
    collisionFilter: {
        category: 0x0001
    }
};

const BATCH_SIZE   = 100;      // Number of balls per batch
const HOLDING_TIME = 1000;     // Time (ms) to hold balls before releasing

// Peg & Divider Constants
const PEG_WIDTH = 17.5;
const PEG_R = PEG_WIDTH / 2;
const PEG_r = (PEG_R * Math.sqrt(3)) / 2; // Hexagon related measurement

const PEG_OPTIONS = {
    isStatic: true,
    restitution: 0.5,
    friction: 0.001,
    render: { fillStyle: 'rgb(54 75 74)' }
};

const START_X   = 198;
const START_Y   = 202;
const PEG_ROWS  = 11;
const PEG_COLS  = 11;

// Offsets for peg placement (using 60° and 120° angles)
const ROW_OFFSET_X = Math.cos(Math.PI / 3) * PEG_r * 4;
const ROW_OFFSET_Y = Math.sin(Math.PI / 3) * PEG_r * 4;
const COL_OFFSET_X = Math.cos((2 * Math.PI) / 3) * PEG_r * 4;
const COL_OFFSET_Y = Math.sin((2 * Math.PI) / 3) * PEG_r * 4;

// Divider & Slot Options
const DIVIDER_OPTIONS = {
    isStatic: true,
    restitution: 0.5,
    friction: 0.001,
    render: { fillStyle: 'rgb(54 75 74)', opacity: 1 }
};

const SLOT_OPTIONS = {
    isStatic: true,
    isSensor: true,  // Non-collideable
    render: {
        visible: false  // Make slots invisible
    }
};

// Bottom Bar Constants
const BAR_FULL_WIDTH  = 320;
const BAR_SLIM_WIDTH  = 5;
const BAR_HEIGHT      = 20;
const BAR_X           = 200;
const BAR_Y           = 575;
const TRANSITION_TIME = 500; // 500ms for bar transition

// Frame (from vertices) Constants
const VERTEX_PATH = "500 400 L 555.4256 400 L 555.4256 496 L 513.8564 568 L 652.4205 808 L 652.4205 976 L 527.7128 1024 L 527.7128 1048 L 666.2769 1000 L 666.2769 808 L 569.282 496 L 569.282 376 L 430.718 376 L 430.718 496 L 333.7231 808 L 333.7231 1000 L 500 1048 L 500 1024 L 347.5795 976 L 347.5795 808 L 486.1436 568 L 444.5744 496 L 444.5744 400";

// Check for user's color scheme preference.
const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

// Define frame styling based on color scheme.
const FRAME_OPTIONS = {
    isStatic: true,
    friction: 0.001,
    frictionStatic: 0.005,
    frictionAir: 0.0001,
    render: {
        visible: true,
        fillStyle: 'rgb(130 136 134)',
        strokeStyle: 'rgb(130 136 134)',
        lineWidth: 1
    }
};

// Cycle States
const CycleState = {
    WAITING_FOR_COLLECTION: 'WAITING_FOR_COLLECTION',
    HOLDING: 'HOLDING',
    RELEASING: 'RELEASING',
    REACTIVATING: 'REACTIVATING'
};

// Import analytics functions
import { updateSlotData, recordStateChange, recordLostBalls } from './analytics.js';

// -------------------------
// Engine, Renderer, & Runner
// -------------------------
const engine = Engine.create();
const world  = engine.world;

const render = Render.create({
    element: document.getElementById('simulation-canvas'),
    engine: engine,
    options: {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        transparent: true,
        background: 'transparent',
        wireframes: false
    }
});

// Mouse control with improved interaction.
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
        stiffness: 0.2,
        render: {
            visible: false
        }
    },
    collisionFilter: {
        mask: 0x0001
    }
});
render.options.mouse = mouse;
render.options.hasBounds = true;

// Create a sensor body that follows the mouse.
const mouseBody = Bodies.circle(0, 0, BALL_RADIUS * 3, {
    isStatic: false,
    render: { visible: false },
    collisionFilter: { mask: 0x0001 }
});
Composite.add(world, mouseBody);

// Update mouse sensor position.
Events.on(engine, 'beforeUpdate', () => {
    if (mouse.position) {
        Matter.Body.setPosition(mouseBody, {
            x: mouse.position.x,
            y: mouse.position.y
        });
    }
});
Composite.add(world, mouseConstraint);

const runner = Runner.create();

// -------------------------
// State Variables & DOM Elements
// -------------------------
let currentBallCount    = 0;
let currentState        = CycleState.WAITING_FOR_COLLECTION;
let previousState       = "Initializing";
let currentBarWidth     = BAR_FULL_WIDTH;
let stateStartTime      = Date.now();

const counterTableBody = document.getElementById('counterTableBody');

const slotStats    = {};
const totalBalls   = { count: 0 };
let numSlots       = 0;

// -------------------------
// Function Definitions
// -------------------------

// Calculate binomial probability for a slot given its index.
function calculateBinomialProbability(slotIndex, totalSlots) {
    const n = PEG_ROWS;  // number of rows = number of trials
    const p = 0.5;       // probability of going right at each peg
    
    const k = slotIndex <= (totalSlots - 1) / 2 
        ? slotIndex 
        : (totalSlots - 1) - slotIndex;
    
    const binomialCoeff = (n, k) => {
        if (k === 0 || k === n) return 1;
        if (k > n) return 0;
        let result = 1;
        for (let i = 1; i <= k; i++) {
            result *= (n + 1 - i) / i;
        }
        return result;
    };
    
    return binomialCoeff(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

// Update slot statistics in the UI.
function updateStats() {
    let currentTotal = 0;
    Object.values(slotStats).forEach(slot => {
        currentTotal += slot.currentCount;
    });

    Object.entries(slotStats).forEach(([slotId, stats]) => {
        const row = document.getElementById(`row-${slotId}`);
        const totalPercent = (stats.totalCount / totalBalls.count * 100) || 0;
        const currentPercent = (stats.currentCount / currentTotal * 100) || 0;
        
        row.innerHTML = `
            <td class="slot-count">Slot ${stats.index}</td>
            <td class="slot-count">${stats.totalCount}</td>
            <td class="slot-count">${stats.currentCount}</td>
            <td class="slot-count">${totalPercent.toFixed(1)}%</td>
            <td class="slot-count">${currentPercent.toFixed(1)}%</td>
            <td class="slot-count expected">${(stats.expectedProbability * 100).toFixed(1)}%</td>
        `;
    });

    document.getElementById('totalBalls').textContent = totalBalls.count;
    document.getElementById('currentBalls').textContent = currentTotal;
}

// Update ball counts and slot statistics.
function updateCounts() {
    Object.values(slotStats).forEach(stats => {
        stats.currentCount = 0;
    });

    const bodies = Composite.allBodies(world);
    const balls = bodies.filter(body => body.circleRadius);
    const slots = bodies.filter(body => body.slotId);
    
    currentBallCount = 0;
    let newBallsProcessed = false;

    balls.forEach(ball => {
        slots.forEach(slot => {
            if (Matter.Bounds.overlaps(ball.bounds, slot.bounds)) {
                slotStats[slot.slotId].currentCount++;
                currentBallCount++;
                
                if (!ball.counted && currentState === CycleState.RELEASING) {
                    slotStats[slot.slotId].totalCount++;
                    totalBalls.count++;
                    ball.counted = true;
                    newBallsProcessed = true;
                }
            }
        });
    });

    Object.entries(slotStats).forEach(([slotId, stats]) => {
        const row = document.getElementById(`row-${slotId}`);
        const totalPercent = (stats.totalCount / totalBalls.count * 100) || 0;
        const currentPercent = (stats.currentCount / currentBallCount * 100) || 0;
        
        row.innerHTML = `
            <td class="slot-count">Slot ${stats.index}</td>
            <td class="slot-count">${stats.totalCount}</td>
            <td class="slot-count">${stats.currentCount}</td>
            <td class="slot-count">${totalPercent.toFixed(1)}%</td>
            <td class="slot-count">${currentPercent.toFixed(1)}%</td>
            <td class="slot-count expected">${(stats.expectedProbability * 100).toFixed(1)}%</td>
        `;
    });

    document.getElementById('totalBalls').textContent = totalBalls.count;
    document.getElementById('currentBalls').textContent = currentBallCount;

    // After updating all slot statistics
    updateSlotData(slotStats);
    
    return { currentBallCount, newBallsProcessed };
}

// Manage simulation cycle based on current state.
function manageCycle() {
    const currentTime = Date.now();
    const elapsedTime = currentTime - stateStartTime;
    
    let nextState = currentState;
    
    switch (currentState) {
        case CycleState.WAITING_FOR_COLLECTION:
            if (currentBallCount === BATCH_SIZE) {
                nextState = CycleState.HOLDING;
            }
            if (currentTime - stateStartTime > 15000) {
                const lostBalls = BATCH_SIZE - currentBallCount;
                console.log(`Lost ${lostBalls} balls after 15s timeout`);
                recordLostBalls(lostBalls);
                nextState = CycleState.RELEASING;
                animateBarWidth(BAR_FULL_WIDTH, BAR_SLIM_WIDTH, TRANSITION_TIME);
            }
            break;

        case CycleState.HOLDING:
            if (currentTime - stateStartTime > HOLDING_TIME) {
                nextState = CycleState.RELEASING;
                animateBarWidth(BAR_FULL_WIDTH, BAR_SLIM_WIDTH, TRANSITION_TIME);
            }
            break;

        case CycleState.RELEASING:
            if (currentBallCount === 0) {
                animateBarWidth(BAR_SLIM_WIDTH, BAR_FULL_WIDTH, TRANSITION_TIME);
                nextState = CycleState.REACTIVATING;
            }
            break;
        
        case CycleState.REACTIVATING:
            if (currentBarWidth === BAR_FULL_WIDTH) {
                balls_to_spawn = BATCH_SIZE;
                nextState = CycleState.WAITING_FOR_COLLECTION;
            }
            break;
    }

    if (nextState !== currentState) {
        console.log(`State: ${nextState}, ${currentState} took: ${elapsedTime}`);
        recordStateChange(currentState, nextState, elapsedTime);
        currentState = nextState;
        stateStartTime = currentTime;
    }
}

// Animate the bottom bar's width.
function animateBarWidth(startWidth, endWidth, duration, callback) {
    const startTime = Date.now();
    const leftEdgeX = bar.bounds.min.x;
    
    const animate = () => {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 0.5 - Math.cos(progress * Math.PI) / 2;
        const currentWidth = startWidth + (endWidth - startWidth) * eased;
        const scaleFactor = currentWidth / currentBarWidth;
        currentBarWidth = currentWidth;
        
        Matter.Body.scale(bar, scaleFactor, 1);
        Matter.Body.setPosition(bar, { 
            x: leftEdgeX + currentWidth / 2, 
            y: bar.position.y 
        });
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else if (callback) {
            callback();
        }
    };
    
    requestAnimationFrame(animate);
}

// -------------------------
// Main Simulation Setup
// -------------------------

Render.run(render);
Runner.run(runner, engine);

// Create Pegs, Dividers, and Slots
let lastDividerX = null;
let slotColorIndex = 0;

for (let row = 0; row <= PEG_ROWS; row++) {
  for (let col = 0; col <= PEG_COLS; col++) {
    const pegX = START_X + row * ROW_OFFSET_X + col * COL_OFFSET_X;
    const pegY = START_Y + row * ROW_OFFSET_Y + col * COL_OFFSET_Y;
    
    if ((row + col === PEG_ROWS) && (row !== 0) && (col <= PEG_ROWS)) {
      const dividerX = pegX - PEG_r * 2;
      
      const divider = Bodies.rectangle(
        dividerX, 
        pegY + 100 / 2 - PEG_R * 3, 
        PEG_r * 2, 
        100, 
        DIVIDER_OPTIONS
      );
      
      if (lastDividerX !== null) {
          const slotWidth = dividerX - lastDividerX;
          const slotX = lastDividerX + slotWidth / 2;
          
          const slot = Bodies.rectangle(
              slotX,
              pegY + 100 / 2 - PEG_R * 3,
              slotWidth - PEG_r * 2,
              100,
              SLOT_OPTIONS
          );
          
          const slotIndex = numSlots++;
          slotStats[slotX] = {
              totalCount: 0,
              currentCount: 0,
              index: slotIndex,
              expectedProbability: 0
          };
          
          slot.slotId = slotX;
          const tableRow = document.createElement('tr');
          tableRow.id = `row-${slotX}`;
          counterTableBody.appendChild(tableRow);
          
          Composite.add(world, slot);
          slotColorIndex++;
      }
      
      lastDividerX = dividerX;
      Composite.add(world, divider);
      continue;
    } else if (row + col >= PEG_ROWS) {
      continue;
    }
    
    const peg = Bodies.polygon(pegX, pegY, 6, PEG_R, PEG_OPTIONS);
    Composite.add(world, peg);
  }
}

// Create bottom bar.
const bar = Bodies.rectangle(
    BAR_X, 
    BAR_Y, 
    BAR_FULL_WIDTH, 
    BAR_HEIGHT, 
    FRAME_OPTIONS
);
Composite.add(world, bar);

// Create frame from vertices using FRAME_OPTIONS.
const vertices = Matter.Vertices.fromPath(VERTEX_PATH);
const frame = Matter.Bodies.fromVertices(200, 350, vertices, FRAME_OPTIONS);
Composite.add(world, frame);

// -------------------------
// Continuous Ball Spawner
// -------------------------
let balls_to_spawn = BATCH_SIZE;
setInterval(() => {
  if (balls_to_spawn > 0) {
    const offset = (Math.random() - 0.5) * 20;
    const ball = Bodies.circle(
      200 + offset, 
      100 + offset, 
      BALL_RADIUS, 
      BALL_OPTIONS
    );
    Composite.add(world, ball);
    balls_to_spawn--;
  }
}, 50);

// -------------------------
// Event Listeners
// -------------------------

document.addEventListener('click', function(event) {
  const mouseX = event.clientX;
  const mouseY = event.clientY;
  console.log(`Mouse clicked at: (${mouseX}, ${mouseY})`);
  console.log(`Frame position: (${frame.position.x}, ${frame.position.y})`);
  console.log(`Frame bounds: (min: (${frame.bounds.min.x}, ${frame.bounds.min.y}), max: (${frame.bounds.max.x}, ${frame.bounds.max.y}))`);
});

Events.on(engine, 'afterUpdate', function() {
    updateCounts();
    manageCycle();
    
    Composite.allBodies(world).forEach(body => {
        if (!body.isStatic && body.position.y > CANVAS_HEIGHT + 100) {
            Composite.remove(world, body);
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const totalProbability = Object.values(slotStats).reduce((sum, slot) => {
        slot.expectedProbability = calculateBinomialProbability(slot.index, numSlots);
        return sum + slot.expectedProbability;
    }, 0);

    Object.values(slotStats).forEach(slot => {
        slot.expectedProbability /= totalProbability;
    });
});
