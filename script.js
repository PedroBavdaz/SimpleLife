// Get the canvas element and its context
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');

// Configuration
let HERBIVORE_AMOUNT = 5;
let FOOD_AMOUNT = 10;
const MIN_HERBIVORE_DISTANCE = 20; // Minimum distance between herbivores
const BASE_EATING_TIME = 1000; // Base time in milliseconds to eat food (1 second)
let simulationSpeed = 1;
let FOOD_SPAWN_RATE = 5; // Food spawn rate in seconds
let AGE_CONSUMPTION_MULTIPLIER = 0.001; // How much the base consumption increases per frame
let SPEED_CONSUMPTION_RATE = 0.1; // Energy consumed per unit of speed per frame
const FPS = 60; // Frames per second
let REPRODUCTION_COOLDOWN = 300; // Cooldown in frames (5 seconds at 60fps)
let MIN_HERBIVORE_SIZE = 5; // Minimum size of herbivores
let MAX_HERBIVORE_SIZE = 15; // Maximum size of herbivores

// Herbivore attributes ranges
const SPEED_RANGE = { min: 1, max: 3 };
const ENERGY_RANGE = { min: 50, max: 100 };
const ENERGY_CONSUMPTION_RATE = 0.1; // Energy consumed per unit of speed per frame
const BASE_ENERGY_CONSUMPTION = 0.05; // Base energy consumed per frame even when not moving
const ENERGY_RECHARGE = 30; // Energy gained from eating food (reduced from 50)

// Control panel elements
const herbivoreSlider = document.getElementById('herbivoreAmount');
const herbivoreValue = document.getElementById('herbivoreAmountValue');
const foodSlider = document.getElementById('foodAmount');
const foodValue = document.getElementById('foodAmountValue');
const speedSlider = document.getElementById('simulationSpeed');
const speedValue = document.getElementById('simulationSpeedValue');
const foodSpawnSlider = document.getElementById('foodSpawnRate');
const foodSpawnValue = document.getElementById('foodSpawnRateValue');
const ageConsumptionSlider = document.getElementById('ageConsumptionRate');
const ageConsumptionValue = document.getElementById('ageConsumptionRateValue');
const speedConsumptionSlider = document.getElementById('speedConsumptionRate');
const speedConsumptionValue = document.getElementById('speedConsumptionRateValue');
const reproductionCooldownSlider = document.getElementById('reproductionCooldown');
const reproductionCooldownValue = document.getElementById('reproductionCooldownValue');
const minSizeSlider = document.getElementById('minHerbivoreSize');
const minSizeValue = document.getElementById('minHerbivoreSizeValue');
const maxSizeSlider = document.getElementById('maxHerbivoreSize');
const maxSizeValue = document.getElementById('maxHerbivoreSizeValue');
const resetButton = document.getElementById('resetButton');
const controlPanel = document.getElementById('controlPanel');
const toggleButton = document.querySelector('.toggle-button');

// Stats window elements
const statsWindow = document.getElementById('statsWindow');
const statsContent = document.getElementById('statsContent');
const closeStatsButton = document.getElementById('closeStatsButton');

// Track currently selected herbivore
let selectedHerbivore = null;

// Food spawn timer
let lastFoodSpawnTime = Date.now();
let pendingFoodSpawns = 0;

// Set canvas size to match window size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Initial resize
resizeCanvas();

// Handle window resize
window.addEventListener('resize', resizeCanvas);

// Helper function to calculate distance between two points
function calculateDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Helper function to get random number in range
function getRandomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

// Food class
class Food {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 5; // Size of the food
        this.isBeingEaten = false;
        this.eatingHerbivore = null;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isBeingEaten ? 'orange' : 'red';
        ctx.fill();
        ctx.closePath();
    }
}

// Herbivore class
class Herbivore {
    constructor(x, y, speed = null) {
        this.x = x;
        this.y = y;
        this.radius = 10; // Size of the herbivore
        this.speed = speed !== null ? speed : getRandomInRange(SPEED_RANGE.min, SPEED_RANGE.max);
        this.maxEnergy = getRandomInRange(ENERGY_RANGE.min, ENERGY_RANGE.max);
        this.energy = this.maxEnergy;
        this.velocityX = 0;
        this.velocityY = 0;
        this.isAlive = true;
        this.isEating = false;
        this.eatingStartTime = 0;
        this.currentFood = null;
        this.age = 0; // Track age in frames
        this.reproductionCooldown = 0; // Cooldown after reproduction
    }

    findClosestFood(foods) {
        let closestFood = null;
        let minDistance = Infinity;

        for (const food of foods) {
            // Skip food that's being eaten
            if (food.isBeingEaten) continue;
            
            const distance = calculateDistance(this.x, this.y, food.x, food.y);
            if (distance < minDistance) {
                minDistance = distance;
                closestFood = food;
            }
        }

        return closestFood;
    }

    findClosestHerbivore(herbivores) {
        let closestHerbivore = null;
        let minDistance = Infinity;

        for (const otherHerbivore of herbivores) {
            if (otherHerbivore === this || !otherHerbivore.isAlive || otherHerbivore.reproductionCooldown > 0) continue;
            
            const distance = calculateDistance(this.x, this.y, otherHerbivore.x, otherHerbivore.y);
            if (distance < minDistance) {
                minDistance = distance;
                closestHerbivore = otherHerbivore;
            }
        }

        return closestHerbivore;
    }

    moveTowards(target) {
        if (!target || this.isEating) return;

        // Calculate direction vector
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        
        // Normalize the direction vector
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length === 0) return;

        const normalizedDx = dx / length;
        const normalizedDy = dy / length;

        // Set velocity based on direction and speed
        this.velocityX = normalizedDx * this.speed;
        this.velocityY = normalizedDy * this.speed;

        // Consume energy based on speed
        this.energy -= this.speed * SPEED_CONSUMPTION_RATE * simulationSpeed;
    }

    checkHerbivoreCollisions(herbivores) {
        for (const otherHerbivore of herbivores) {
            if (otherHerbivore === this || !otherHerbivore.isAlive) continue;

            const distance = calculateDistance(this.x, this.y, otherHerbivore.x, otherHerbivore.y);
            const minDistance = this.radius + otherHerbivore.radius;
            if (distance < minDistance) {
                // Calculate collision response
                const angle = Math.atan2(otherHerbivore.y - this.y, otherHerbivore.x - this.x);
                const overlap = minDistance - distance;
                
                // Move both herbivores apart
                const moveX = Math.cos(angle) * overlap * 0.5;
                const moveY = Math.sin(angle) * overlap * 0.5;
                
                this.x -= moveX;
                this.y -= moveY;
                otherHerbivore.x += moveX;
                otherHerbivore.y += moveY;

                // Adjust velocities to prevent sticking
                const pushForce = 0.5;
                this.velocityX -= Math.cos(angle) * pushForce;
                this.velocityY -= Math.sin(angle) * pushForce;
                otherHerbivore.velocityX += Math.cos(angle) * pushForce;
                otherHerbivore.velocityY += Math.sin(angle) * pushForce;
            }
        }
    }

    checkFoodCollision(foods) {
        if (this.isEating) {
            // Check if eating is complete, scaled by simulation speed
            const scaledEatingTime = BASE_EATING_TIME / simulationSpeed;
            if (Date.now() - this.eatingStartTime >= scaledEatingTime) {
                // Remove the food when eating is complete
                const foodIndex = foods.indexOf(this.currentFood);
                if (foodIndex !== -1) {
                    foods.splice(foodIndex, 1);
                    // Increment pending food spawns
                    pendingFoodSpawns++;
                }
                this.isEating = false;
                this.currentFood = null;
                // Recharge energy
                this.energy = Math.min(this.maxEnergy, this.energy + ENERGY_RECHARGE);
                // Increment food eaten counter
                this.foodEaten++;
                // Check if ready to reproduce
                if (this.foodEaten >= 3) {
                    this.canReproduce = true;
                }
            }
            return;
        }

        for (const food of foods) {
            // Skip food that's being eaten
            if (food.isBeingEaten) continue;

            const distance = calculateDistance(this.x, this.y, food.x, food.y);
            if (distance < (this.radius + food.radius)) {
                // Start eating
                this.isEating = true;
                this.eatingStartTime = Date.now();
                this.currentFood = food;
                food.isBeingEaten = true;
                food.eatingHerbivore = this;
                this.velocityX = 0;
                this.velocityY = 0;
                break;
            }
        }
    }

    checkReproduction(herbivores) {
        if (this.reproductionCooldown > 0) return;

        for (const otherHerbivore of herbivores) {
            if (otherHerbivore === this || !otherHerbivore.isAlive || otherHerbivore.reproductionCooldown > 0) continue;

            const distance = calculateDistance(this.x, this.y, otherHerbivore.x, otherHerbivore.y);
            if (distance < (this.radius + otherHerbivore.radius)) {
                // Create offspring at midpoint between parents
                const offspringX = (this.x + otherHerbivore.x) / 2;
                const offspringY = (this.y + otherHerbivore.y) / 2;
                const offspringSpeed = (this.speed + otherHerbivore.speed) / 2;
                const offspring = new Herbivore(offspringX, offspringY, offspringSpeed);
                herbivores.push(offspring);

                // Set cooldown for both parents
                this.reproductionCooldown = REPRODUCTION_COOLDOWN;
                otherHerbivore.reproductionCooldown = REPRODUCTION_COOLDOWN;
                break;
            }
        }
    }

    checkEnergy() {
        if (this.energy <= 0) {
            this.isAlive = false;
            // If this herbivore was eating, release the food
            if (this.currentFood) {
                this.currentFood.isBeingEaten = false;
                this.currentFood.eatingHerbivore = null;
            }
            // Spawn food when herbivore dies
            const newPos = getRandomPosition();
            foods.push(new Food(newPos.x, newPos.y));
        }
    }

    update(foods, herbivores) {
        if (!this.isAlive) return;

        // Calculate age-based consumption
        const ageConsumption = BASE_ENERGY_CONSUMPTION * (1 + this.age * AGE_CONSUMPTION_MULTIPLIER) * simulationSpeed;
        this.energy -= ageConsumption;
        this.age++; // Increment age

        // Decrease reproduction cooldown
        if (this.reproductionCooldown > 0) {
            this.reproductionCooldown -= simulationSpeed;
        }

        // Always look for closest herbivore first if not on cooldown
        if (this.reproductionCooldown <= 0) {
            const closestHerbivore = this.findClosestHerbivore(herbivores);
            if (closestHerbivore) {
                this.moveTowards(closestHerbivore);
            } else {
                // If no other herbivore found, look for food
                const closestFood = this.findClosestFood(foods);
                this.moveTowards(closestFood);
            }
        } else {
            // If on cooldown, just look for food
            const closestFood = this.findClosestFood(foods);
            this.moveTowards(closestFood);
        }
        
        // Apply velocity
        this.x += this.velocityX * simulationSpeed;
        this.y += this.velocityY * simulationSpeed;

        // Keep herbivore within canvas bounds
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        // Check collisions and energy
        this.checkHerbivoreCollisions(herbivores);
        this.checkFoodCollision(foods);
        this.checkReproduction(herbivores);
        this.checkEnergy();

        // Apply friction to slow down herbivores
        this.velocityX *= 0.95;
        this.velocityY *= 0.95;
    }

    draw() {
        if (!this.isAlive) return;

        // Calculate size based on energy level
        const energyRatio = this.energy / this.maxEnergy;
        this.radius = MIN_HERBIVORE_SIZE + (MAX_HERBIVORE_SIZE - MIN_HERBIVORE_SIZE) * energyRatio;

        // Calculate color based on base speed attribute
        // Map from green (min speed) to red (max speed)
        const speedRatio = (this.speed - SPEED_RANGE.min) / (SPEED_RANGE.max - SPEED_RANGE.min);
        const red = Math.floor(255 * speedRatio);
        const green = Math.floor(255 * (1 - speedRatio));
        const color = `rgb(${red}, ${green}, 0)`;

        // Draw herbivore body
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.closePath();

        // Draw reproduction indicator if ready
        if (this.reproductionCooldown <= 0) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw a heart symbol to indicate looking for mate
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - this.radius - 8);
            ctx.bezierCurveTo(
                this.x - 5, this.y - this.radius - 12,
                this.x - 8, this.y - this.radius - 4,
                this.x, this.y - this.radius
            );
            ctx.bezierCurveTo(
                this.x + 8, this.y - this.radius - 4,
                this.x + 5, this.y - this.radius - 12,
                this.x, this.y - this.radius - 8
            );
            ctx.fillStyle = 'red';
            ctx.fill();
        }

        // Draw energy bar
        const energyBarWidth = this.radius * 2;
        const energyBarHeight = 4;
        const energyPercentage = this.energy / this.maxEnergy;
        
        // Background
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - this.radius, this.y - this.radius - 8, energyBarWidth, energyBarHeight);
        
        // Energy level
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x - this.radius, this.y - this.radius - 8, energyBarWidth * energyPercentage, energyBarHeight);

        // Draw eating progress if currently eating
        if (this.isEating) {
            const scaledEatingTime = BASE_EATING_TIME / simulationSpeed;
            const progress = (Date.now() - this.eatingStartTime) / scaledEatingTime;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 2, 0, Math.PI * 2 * progress);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}

// Function to get random position within canvas bounds
function getRandomPosition() {
    return {
        x: Math.random() * (canvas.width - 20) + 10,
        y: Math.random() * (canvas.height - 20) + 10
    };
}

// Initialize simulation
let herbivores = [];
let foods = [];

function initializeSimulation() {
    // Create herbivores
    herbivores = Array.from({ length: HERBIVORE_AMOUNT }, () => {
        const pos = getRandomPosition();
        return new Herbivore(pos.x, pos.y);
    });

    // Create food
    foods = Array.from({ length: FOOD_AMOUNT }, () => {
        const pos = getRandomPosition();
        return new Food(pos.x, pos.y);
    });
}

// Control panel event listeners
herbivoreSlider.addEventListener('input', (e) => {
    HERBIVORE_AMOUNT = parseInt(e.target.value);
    herbivoreValue.textContent = HERBIVORE_AMOUNT;
});

foodSlider.addEventListener('input', (e) => {
    FOOD_AMOUNT = parseInt(e.target.value);
    foodValue.textContent = FOOD_AMOUNT;
});

speedSlider.addEventListener('input', (e) => {
    simulationSpeed = parseFloat(e.target.value);
    speedValue.textContent = simulationSpeed.toFixed(1);
});

foodSpawnSlider.addEventListener('input', (e) => {
    FOOD_SPAWN_RATE = parseFloat(e.target.value);
    foodSpawnValue.textContent = FOOD_SPAWN_RATE.toFixed(1);
});

ageConsumptionSlider.addEventListener('input', (e) => {
    AGE_CONSUMPTION_MULTIPLIER = parseFloat(e.target.value);
    ageConsumptionValue.textContent = AGE_CONSUMPTION_MULTIPLIER.toFixed(4);
});

speedConsumptionSlider.addEventListener('input', (e) => {
    SPEED_CONSUMPTION_RATE = parseFloat(e.target.value);
    speedConsumptionValue.textContent = SPEED_CONSUMPTION_RATE.toFixed(2);
});

reproductionCooldownSlider.addEventListener('input', (e) => {
    const seconds = parseFloat(e.target.value);
    REPRODUCTION_COOLDOWN = Math.round(seconds * FPS); // Convert seconds to frames
    reproductionCooldownValue.textContent = seconds.toFixed(1);
});

minSizeSlider.addEventListener('input', (e) => {
    MIN_HERBIVORE_SIZE = parseInt(e.target.value);
    minSizeValue.textContent = MIN_HERBIVORE_SIZE;
    // Ensure max size is always greater than min size
    if (MAX_HERBIVORE_SIZE <= MIN_HERBIVORE_SIZE) {
        MAX_HERBIVORE_SIZE = MIN_HERBIVORE_SIZE + 1;
        maxSizeSlider.value = MAX_HERBIVORE_SIZE;
        maxSizeValue.textContent = MAX_HERBIVORE_SIZE;
    }
});

maxSizeSlider.addEventListener('input', (e) => {
    MAX_HERBIVORE_SIZE = parseInt(e.target.value);
    maxSizeValue.textContent = MAX_HERBIVORE_SIZE;
    // Ensure min size is always less than max size
    if (MIN_HERBIVORE_SIZE >= MAX_HERBIVORE_SIZE) {
        MIN_HERBIVORE_SIZE = MAX_HERBIVORE_SIZE - 1;
        minSizeSlider.value = MIN_HERBIVORE_SIZE;
        minSizeValue.textContent = MIN_HERBIVORE_SIZE;
    }
});

resetButton.addEventListener('click', () => {
    initializeSimulation();
});

// Toggle control panel
toggleButton.addEventListener('click', () => {
    controlPanel.classList.toggle('collapsed');
    toggleButton.textContent = controlPanel.classList.contains('collapsed') ? '▶' : '▼';
});

// Initial simulation setup
initializeSimulation();

// Animation loop
function animate() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Check for food spawns
    const currentTime = Date.now();
    if (pendingFoodSpawns > 0 && (currentTime - lastFoodSpawnTime) >= (FOOD_SPAWN_RATE * 1000)) {
        const newPos = getRandomPosition();
        foods.push(new Food(newPos.x, newPos.y));
        pendingFoodSpawns--;
        lastFoodSpawnTime = currentTime;
    }

    // Update and draw all herbivores
    herbivores.forEach(herbivore => {
        herbivore.update(foods, herbivores);
        herbivore.draw();
    });

    // Draw all food
    foods.forEach(food => food.draw());

    // Update stats display if a herbivore is selected
    if (selectedHerbivore) {
        updateStatsDisplay();
    }

    // Request next frame
    requestAnimationFrame(animate);
}

// Start the animation
animate();

// Function to show stats for a herbivore
function showHerbivoreStats(herbivore) {
    selectedHerbivore = herbivore;
    updateStatsDisplay();
    statsWindow.style.display = 'block';
}

// Function to update stats display
function updateStatsDisplay() {
    if (!selectedHerbivore || !selectedHerbivore.isAlive) {
        hideStatsWindow();
        return;
    }

    // Calculate energy expenditure per frame
    const baseExpenditure = BASE_ENERGY_CONSUMPTION * (1 + selectedHerbivore.age * AGE_CONSUMPTION_MULTIPLIER) * simulationSpeed;
    const movementExpenditure = selectedHerbivore.speed * SPEED_CONSUMPTION_RATE * simulationSpeed;
    const totalExpenditure = baseExpenditure + movementExpenditure;

    statsContent.innerHTML = `
        <h3>Herbivore Stats</h3>
        <p>Speed: ${selectedHerbivore.speed.toFixed(2)}</p>
        <p>Age: ${selectedHerbivore.age} frames</p>
        <p>Energy: ${selectedHerbivore.energy.toFixed(1)}</p>
        <p>Base Expenditure: -${baseExpenditure.toFixed(2)} per frame</p>
        <p>Movement Expenditure: -${movementExpenditure.toFixed(2)} per frame</p>
        <p>Total Expenditure: -${totalExpenditure.toFixed(2)} per frame</p>
    `;
}

// Function to hide stats window
function hideStatsWindow() {
    statsWindow.style.display = 'none';
    selectedHerbivore = null;
}

// Add click event listener to canvas
canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Check if click is on any herbivore
    for (const herbivore of herbivores) {
        if (!herbivore.isAlive) continue;
        
        const distance = calculateDistance(clickX, clickY, herbivore.x, herbivore.y);
        if (distance <= herbivore.radius) {
            showHerbivoreStats(herbivore);
            return;
        }
    }
    
    // If clicked outside any herbivore, hide stats window
    hideStatsWindow();
});

// Add click event listener to close button
closeStatsButton.addEventListener('click', hideStatsWindow); 