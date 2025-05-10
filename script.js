// Get the canvas element and its context
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');

// Configuration
let HERBIVORE_AMOUNT = 5;
let FOOD_AMOUNT = 10;
const MIN_HERBIVORE_DISTANCE = 20; // Minimum distance between herbivores
const BASE_EATING_TIME = 1000; // Base time in milliseconds to eat food (1 second)
let simulationSpeed = 1;

// Herbivore attributes ranges
const SPEED_RANGE = { min: 1, max: 3 };
const ENERGY_RANGE = { min: 50, max: 100 };
const ENERGY_CONSUMPTION_RATE = 0.1; // Energy consumed per unit of speed per frame
const ENERGY_RECHARGE = 50; // Energy gained from eating food

// Control panel elements
const herbivoreSlider = document.getElementById('herbivoreAmount');
const herbivoreValue = document.getElementById('herbivoreAmountValue');
const foodSlider = document.getElementById('foodAmount');
const foodValue = document.getElementById('foodAmountValue');
const speedSlider = document.getElementById('simulationSpeed');
const speedValue = document.getElementById('simulationSpeedValue');
const resetButton = document.getElementById('resetButton');

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
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 10; // Size of the herbivore
        this.speed = getRandomInRange(SPEED_RANGE.min, SPEED_RANGE.max);
        this.maxEnergy = getRandomInRange(ENERGY_RANGE.min, ENERGY_RANGE.max);
        this.energy = this.maxEnergy;
        this.velocityX = 0;
        this.velocityY = 0;
        this.isAlive = true;
        this.isEating = false;
        this.eatingStartTime = 0;
        this.currentFood = null;
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
        this.energy -= this.speed * ENERGY_CONSUMPTION_RATE * simulationSpeed;
    }

    checkHerbivoreCollisions(herbivores) {
        for (const otherHerbivore of herbivores) {
            if (otherHerbivore === this || !otherHerbivore.isAlive) continue;

            const distance = calculateDistance(this.x, this.y, otherHerbivore.x, otherHerbivore.y);
            if (distance < MIN_HERBIVORE_DISTANCE) {
                // Calculate collision response
                const angle = Math.atan2(otherHerbivore.y - this.y, otherHerbivore.x - this.x);
                const overlap = MIN_HERBIVORE_DISTANCE - distance;
                
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
                    // Spawn new food at random position
                    const newPos = getRandomPosition();
                    foods.push(new Food(newPos.x, newPos.y));
                }
                this.isEating = false;
                this.currentFood = null;
                // Recharge energy
                this.energy = Math.min(this.maxEnergy, this.energy + ENERGY_RECHARGE);
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

        const closestFood = this.findClosestFood(foods);
        this.moveTowards(closestFood);
        
        // Apply velocity
        this.x += this.velocityX * simulationSpeed;
        this.y += this.velocityY * simulationSpeed;

        // Keep herbivore within canvas bounds
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        // Check collisions and energy
        this.checkHerbivoreCollisions(herbivores);
        this.checkFoodCollision(foods);
        this.checkEnergy();

        // Apply friction to slow down herbivores
        this.velocityX *= 0.95;
        this.velocityY *= 0.95;
    }

    draw() {
        if (!this.isAlive) return;

        // Draw herbivore body
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isEating ? 'gray' : 'black';
        ctx.fill();
        ctx.closePath();

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

resetButton.addEventListener('click', () => {
    initializeSimulation();
});

// Initial simulation setup
initializeSimulation();

// Animation loop
function animate() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw all herbivores
    herbivores.forEach(herbivore => {
        herbivore.update(foods, herbivores);
        herbivore.draw();
    });

    // Draw all food
    foods.forEach(food => food.draw());

    // Request next frame
    requestAnimationFrame(animate);
}

// Start the animation
animate(); 