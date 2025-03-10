// -------------------------
// Module Imports & Aliases
// -------------------------
import Matter from "https://cdn.jsdelivr.net/npm/matter-js@0.19.0/+esm";
import 'https://cdn.jsdelivr.net/npm/poly-decomp@0.3.0/build/decomp.min.js';
import 'https://cdn.jsdelivr.net/npm/pathseg@1.2.1/pathseg.min.js';

const { 
    Engine, 
    Render, 
    Runner, 
    Bodies, 
    Body,     // Add this
    Composite, 
    Events, 
    Mouse, 
    MouseConstraint 
} = Matter;

// -------------------------
// Constants
// -------------------------

// Canvas Dimensions
const CANVAS_WIDTH  = 400;
const CANVAS_HEIGHT = 750;

// Simulation Constants
const BALL_RADIUS   = 4;
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
    render: { 
        fillStyle: 'rgb(54 75 74)',
        opacity: 1
    }
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
let currentBarWidth     = BAR_FULL_WIDTH;
let stateStartTime      = Date.now();

const counterTableBody = document.getElementById('counterTableBody');

const slotStats    = {};
const totalBalls   = { count: 0 };
let numSlots       = 0;

// -------------------------
// Heat Map Constants
// -------------------------
const HEATMAP_Y_MIN = 205;            // Minimum Y to track heat
const HEATMAP_Y_MAX = 455;            // Maximum Y to track heat
const HEATMAP_RESOLUTION = 3;         // Size of each heat map cell (smaller for more detail)
const HEAT_BLUR_RADIUS = 9;          // Blur radius for continuous effect
const MAX_HEAT_VALUE = 100;           // Value at which a cell reaches maximum color intensity
const HEAT_DECAY = 0.9995;             // Decay factor for heat (per frame)

// Add these constants at the top with other constants
const PROBABILITY_THRESHOLD = 0.05; // 5% deviation threshold
const WARNING_SIZE = 20; // Size of warning icon in pixels

// -------------------------
// Heat Map Variables
// -------------------------
let heatMapData = {};                // Object to store heat values
let heatMapCanvas = null;            // Canvas for rendering the heat map
let heatMapContext = null;           // Canvas context
let showHeatMap = true;              // Toggle for heat map visibility
let heatMapOpacity = 0.7;            // Heat map opacity value
let disabledPegs = new Set();        // Track which pegs are disabled

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
                // Check deviations here before transitioning
                checkSlotDeviations();
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

// Create heat map setup function
function setupHeatMap() {
    // Create heat map canvas
    heatMapCanvas = document.createElement('canvas');
    heatMapCanvas.width = CANVAS_WIDTH;
    heatMapCanvas.height = CANVAS_HEIGHT;
    heatMapCanvas.style.position = 'absolute';
    heatMapCanvas.style.top = '0';
    heatMapCanvas.style.left = '0';
    heatMapCanvas.style.pointerEvents = 'none'; // Allow clicks to pass through
    heatMapCanvas.style.opacity = heatMapOpacity;
    
    // Get the parent container
    const simulationContainer = document.querySelector('.simulation-container');
    simulationContainer.appendChild(heatMapCanvas);
    
    // Get context and set initial styles
    heatMapContext = heatMapCanvas.getContext('2d');
    
    // Add event listeners
    document.getElementById('heatMapToggle').addEventListener('change', function(e) {
        showHeatMap = e.target.checked;
        heatMapCanvas.style.display = showHeatMap ? 'block' : 'none';
    });
    
    document.getElementById('heatIntensityRange').addEventListener('input', function(e) {
        heatMapOpacity = parseFloat(e.target.value);
        heatMapCanvas.style.opacity = heatMapOpacity;
    });
    
    document.getElementById('resetHeatMap').addEventListener('click', function() {
        heatMapData = {};
        drawHeatMap();
    });
    
    // Create heat gradient display in CSS
    const style = document.createElement('style');
    style.textContent = `
        .heat-gradient {
            width: 200px;
            height: 20px;
            background: linear-gradient(to right, blue, cyan, green, yellow, red);
            border-radius: 4px;
        }
    `;
    document.head.appendChild(style);
}

// Function to update heat map data
function updateHeatMap() {
    // Decay all heat values slightly each frame
    Object.keys(heatMapData).forEach(key => {
        heatMapData[key] *= HEAT_DECAY;
        
        // Remove very small values to prevent memory buildup
        if (heatMapData[key] < 0.1) {
            delete heatMapData[key];
        }
    });
    
    // Get all balls
    const balls = Composite.allBodies(world).filter(body => 
        body.circleRadius && body.circleRadius === BALL_RADIUS);
    
    // Track ball positions - but only in the peg area
    balls.forEach(ball => {
        // Only track balls in the specified Y range
        if (ball.position.y >= HEATMAP_Y_MIN && ball.position.y <= HEATMAP_Y_MAX) {
            // Get the grid cell coordinates
            const gridX = Math.floor(ball.position.x / HEATMAP_RESOLUTION);
            const gridY = Math.floor(ball.position.y / HEATMAP_RESOLUTION);
            const key = `${gridX},${gridY}`;
            
            // Increase heat at this position
            if (!heatMapData[key]) {
                heatMapData[key] = 0;
            }
            
            heatMapData[key] += 1;
            
            // Cap the heat value
            if (heatMapData[key] > MAX_HEAT_VALUE) {
                heatMapData[key] = MAX_HEAT_VALUE;
            }
        }
    });
    
    // Only redraw the heatmap if it's visible
    if (showHeatMap) {
        drawHeatMap();
    }
}

// Function to draw the heat map with continuous gradient
function drawHeatMap() {
    // Clear the canvas
    heatMapContext.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Find the current maximum heat value
    const currentMaxHeat = Math.max(
        0.1, // Prevent division by zero
        ...Object.values(heatMapData)
    );
    
    // Create an offscreen canvas for the initial heat data
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = CANVAS_WIDTH;
    offscreenCanvas.height = CANVAS_HEIGHT;
    const offscreenContext = offscreenCanvas.getContext('2d');
    
    // Draw initial heat points
    Object.keys(heatMapData).forEach(key => {
        const [gridX, gridY] = key.split(',').map(Number);
        const x = gridX * HEATMAP_RESOLUTION;
        const y = gridY * HEATMAP_RESOLUTION;
        const intensity = heatMapData[key] / currentMaxHeat; // Normalize based on current max
        
        // Create heat color (blue to red gradient)
        const r = Math.floor(255 * Math.min(1, intensity * 2));
        const g = Math.floor(255 * Math.min(1, 2 - intensity * 2));
        const b = Math.floor(intensity < 0.5 ? 255 * intensity * 2 : 0);
        
        offscreenContext.fillStyle = `rgba(${r}, ${g}, ${b}, ${intensity})`;
        offscreenContext.fillRect(x, y, HEATMAP_RESOLUTION, HEATMAP_RESOLUTION);
    });
    
    // Apply gaussian blur for continuous effect
    heatMapContext.filter = `blur(${HEAT_BLUR_RADIUS}px)`;
    heatMapContext.drawImage(offscreenCanvas, 0, 0);
    heatMapContext.filter = 'none';
    
    // Clip to specified Y range
    heatMapContext.globalCompositeOperation = 'destination-in';
    heatMapContext.fillStyle = 'black';
    heatMapContext.fillRect(0, HEATMAP_Y_MIN, CANVAS_WIDTH, HEATMAP_Y_MAX - HEATMAP_Y_MIN);
    heatMapContext.globalCompositeOperation = 'source-over';
}

// Add peg interaction
function setupPegInteraction() {
    // Add click event to the render canvas
    render.canvas.addEventListener('click', function(event) {
        const rect = render.canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        // Scale coordinates based on render size
        const scaleX = CANVAS_WIDTH / render.options.width;
        const scaleY = CANVAS_HEIGHT / render.options.height;
        const worldX = clickX * scaleX;
        const worldY = clickY * scaleY;
        
        // Check if we clicked on a peg
        const bodies = Composite.allBodies(world);
        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            
            // Only check for pegs (hexagons)
            if (body.isStatic && body.vertices && body.vertices.length === 6) {
                // Check if point is inside peg
                if (Matter.Vertices.contains(body.vertices, { x: worldX, y: worldY })) {
                    togglePeg(body);
                    break;
                }
            }
        }
    });
}

// Toggle peg collision
function togglePeg(peg) {
    const pegId = peg.id;
    
    if (disabledPegs.has(pegId)) {
        // Re-enable the peg
        disabledPegs.delete(pegId);
        peg.collisionFilter.category = 0x0001;
        peg.collisionFilter.mask = 0xFFFFFFFF;
        // Restore original color
        peg.render.opacity = 1;
        peg.render.fillStyle = 'rgb(54 75 74)';
    } else {
        // Disable the peg
        disabledPegs.add(pegId);
        peg.collisionFilter.category = 0x0002;
        peg.collisionFilter.mask = 0;
        // Change appearance to indicate disabled
        peg.render.opacity = 0.3;
        peg.render.fillStyle = 'rgb(150 150 150)';
    }
}

// Update the createWarningIcon function to make warnings more visible
function createWarningIcon(x, y) {
    // Create a compound body for the warning sign
    const triangle = Bodies.polygon(x, y, 3, WARNING_SIZE, {
        isStatic: true,
        isSensor: true,
        render: {
            fillStyle: '#ffc107', // Bootstrap warning yellow
            strokeStyle: '#000',
            lineWidth: 2,
            opacity: 0.8
        }
    });

    // Create exclamation mark using two rectangles - positioned for vertical orientation
    const exclamationDot = Bodies.circle(x - WARNING_SIZE/4, y, WARNING_SIZE/8, {
        isStatic: true,
        isSensor: true,
        render: {
            fillStyle: '#000',
            opacity: 0.8
        }
    });

    const exclamationLine = Bodies.rectangle(x - WARNING_SIZE/4, y - WARNING_SIZE/2, WARNING_SIZE/6, WARNING_SIZE/2, {
        isStatic: true,
        isSensor: true,
        render: {
            fillStyle: '#000',
            opacity: 0.8
        }
    });

    // Create compound body
    const warningIcon = Body.create({
        parts: [triangle, exclamationDot, exclamationLine],
        isStatic: true,
        isSensor: true,
        collisionFilter: {
            group: -1,
            category: 0x0002,
            mask: 0x0000
        },
        label: 'warning'
    });

    // Rotate the entire compound body -90 degrees
    Body.rotate(warningIcon, -Math.PI/2);

    return warningIcon;
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

// Modify the reset handler to remove warnings
document.getElementById('resetHeatMap').addEventListener('click', function() {
    // Remove all warning icons
    const warningsToRemove = Composite.allBodies(world).filter(body => body.label === 'warning');
    warningsToRemove.forEach(warning => {
        Composite.remove(world, warning);
    });
    
    // Clear warning references
    Object.values(slotStats).forEach(stats => {
        stats.warningIcon = null;
    });

    // ...existing reset code...
    heatMapData = {};
    drawHeatMap();
});

// Update the checkSlotDeviations function with better logging and positioning
function checkSlotDeviations() {
    console.log('Checking slot deviations...'); // Debug log
    
    Object.entries(slotStats).forEach(([slotId, stats]) => {
        const totalPercent = (stats.totalCount / totalBalls.count * 100) || 0;
        const expectedPercent = stats.expectedProbability * 100;
        const deviation = Math.abs(totalPercent - expectedPercent);
        
        console.log(`Slot ${stats.index}: Total ${totalPercent.toFixed(1)}%, Expected ${expectedPercent.toFixed(1)}%, Deviation ${deviation.toFixed(1)}%`); // Debug log
        
        if (deviation > PROBABILITY_THRESHOLD * 100) {
            if (!stats.warningIcon) {
                // Changed how we find the slot - using numerical comparison
                const slot = Composite.allBodies(world).find(body => 
                    body.isSensor && 
                    Math.abs(body.position.x - parseFloat(slotId)) < 0.1
                );
                
                if (slot) {
                    console.log(`Creating warning for slot ${stats.index}`); // Debug log
                    const warningIcon = createWarningIcon(
                        slot.position.x, 
                        slot.bounds.min.y + 50 // Position above the slot
                    );
                    
                    // Rotate the triangle to point downward
                    Matter.Body.rotate(warningIcon, Math.PI);
                    
                    stats.warningIcon = warningIcon;
                    Composite.add(world, warningIcon);
                    console.log(`Warning added for slot ${stats.index} at (${warningIcon.position.x}, ${warningIcon.position.y})`);
                } else {
                    console.log(`Could not find slot body at x: ${slotId}`); // More detailed debug log
                }
            }
        }
    });
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
    updateHeatMap();
    
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

// Add this to your initialization code after setting up the render
setupHeatMap();
setupPegInteraction();

// Keep this event listener
document.getElementById('resetHeatMap').addEventListener('click', function() {
    // Remove all warning icons
    const warningsToRemove = Composite.allBodies(world).filter(body => body.label === 'warning');
    warningsToRemove.forEach(warning => {
        Composite.remove(world, warning);
    });
    
    // Clear warning references
    Object.values(slotStats).forEach(stats => {
        stats.warningIcon = null;
    });

    heatMapData = {};
    drawHeatMap();
});
