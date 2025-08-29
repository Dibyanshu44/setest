document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('map-canvas');
    const ctx = canvas.getContext('2d');
    const findPathBtn = document.getElementById('find-path-btn');
    const startRoomSelect = document.getElementById('start-room');
    const endRoomSelect = document.getElementById('end-room');
    const messageBox = document.getElementById('message-box');
    const navigationControls = document.getElementById('navigation-controls');
    const currentInstruction = document.getElementById('current-instruction');
    const moveForwardBtn = document.getElementById('move-forward-btn');
    const turnLeftBtn = document.getElementById('turn-left-btn');
    const turnRightBtn = document.getElementById('turn-right-btn');
    const compassArrow = document.getElementById('compass-arrow');
    const gridSize = 25;
    const gridWidth = 35;
    const gridHeight = 25;

    let gridLayout;
    let nodes;
    let roomCoordinates = {};
    let currentPath = [];
    let playerPosition = { x: -1, y: -1, name: '' };
    let playerDirection = 'north'; // 'north', 'east', 'south', 'west'

    const typeColors = {
        "empty": "#ffffff",
        "corridor": "#fde68a",
        "room": "#d1fae5",
        "girls_toilet": "#fecaca",
        "boys_toilet": "#dbeafe",
        "stair": "#e9d5ff",
        "lift": "#e9d5ff",
        "B-entrance": "#fca5a5",
        "A-entrance": "#fca5a5",
    };

    async function init() {
        try {
            const response = await fetch("stitched.json");
            const jsonData = await response.json();
            
            gridLayout = jsonData.layout.Floor_0;
            nodes = jsonData.nodes;

            canvas.width = gridWidth * gridSize;
            canvas.height = gridHeight * gridSize;
            
            precomputeRoomCoordinates();
            populateDropdowns();
            drawGrid();
        } catch (error) {
            console.error('Error loading map data:', error);
            showMessage('Failed to load map data. Please ensure "stitched.json" is in the same directory.', 'error');
        }
    }

    // Pre-computes and stores the coordinates of each named room/corridor for faster lookup.
    function precomputeRoomCoordinates() {
        roomCoordinates = {};
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const cell = gridLayout[y] && gridLayout[y][x];
                if (cell && cell.name) {
                    roomCoordinates[cell.name] = { x, y };
                }
            }
        }
    }

    function getCellColor(cell) {
        if (cell.type in typeColors) {
            return typeColors[cell.type];
        }
        const namePrefix = cell.name?.charAt(0);
        if (namePrefix === 'c') return typeColors['corridor'];
        if (namePrefix === 's' || namePrefix === 'l') return typeColors['stair'];
        if (cell.name in typeColors) return typeColors[cell.name];
        return '#d1fae5';
    }

    function findNearestAmenity(startRoom, amenityType) {
        let shortestPath = null;
        let nearestAmenity = null;
        
        for (const roomName in nodes) {
            if (nodes[roomName].type === amenityType) {
                const path = bfs(startRoom, roomName);
                if (path && (shortestPath === null || path.length < shortestPath.length)) {
                    shortestPath = path;
                    nearestAmenity = roomName;
                }
            }
        }
        return nearestAmenity;
    }

    function populateDropdowns() {
        const roomList = [];
        startRoomSelect.innerHTML = '';
        endRoomSelect.innerHTML = '';

        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Select a location';
        startRoomSelect.appendChild(emptyOption.cloneNode(true));
        endRoomSelect.appendChild(emptyOption.cloneNode(true));
        
        const girlsToiletOption = document.createElement('option');
        girlsToiletOption.value = 'girls_toilet';
        girlsToiletOption.textContent = 'Nearest Girls\' Toilet';
        endRoomSelect.appendChild(girlsToiletOption);

        const boysToiletOption = document.createElement('option');
        boysToiletOption.value = 'boys_toilet';
        boysToiletOption.textContent = 'Nearest Boys\' Toilet';
        endRoomSelect.appendChild(boysToiletOption);

        const liftOption = document.createElement('option');
        liftOption.value = 'lift';
        liftOption.textContent = 'Nearest Lift';
        endRoomSelect.appendChild(liftOption);

        const stairOption = document.createElement('option');
        stairOption.value = 'stair';
        stairOption.textContent = 'Nearest Staircase';
        endRoomSelect.appendChild(stairOption);

        for (const roomName in nodes) {
            const roomNode = nodes[roomName];
            const isAmenity = roomNode.type === 'girls_toilet' || roomNode.type === 'boys_toilet' || roomNode.type === 'lift' || roomNode.type === 'stair';
            const isCorridor = roomNode.type === 'corridor';
            if (!isAmenity && !isCorridor) {
                roomList.push(roomName);
            }
        }
        
        roomList.sort().forEach(room => {
            const startOption = document.createElement('option');
            startOption.value = room;
            startOption.textContent = room;
            startRoomSelect.appendChild(startOption);

            const endOption = document.createElement('option');
            endOption.value = room;
            endOption.textContent = room;
            endRoomSelect.appendChild(endOption);
        });
    }

    function drawGrid() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const cell = gridLayout[y] && gridLayout[y][x] ? gridLayout[y][x] : { type: 'empty' };
                const color = getCellColor(cell);
                ctx.fillStyle = color;
                ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
                
                ctx.strokeStyle = '#d1d5db';
                ctx.lineWidth = 1;
                ctx.strokeRect(x * gridSize, y * gridSize, gridSize, gridSize);

                if (cell.type === 'girls_toilet' || cell.name === 'GT2' || cell.name === 'GT5' || cell.name === 'GT7') {
                    ctx.fillStyle = '#1f2937';
                    ctx.font = '9px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText("Girls", x * gridSize + gridSize / 2, y * gridSize + gridSize / 2 - 5);
                    ctx.fillText("Toilet", x * gridSize + gridSize / 2, y * gridSize + gridSize / 2 + 5);
                } else if (cell.type === 'boys_toilet' || cell.name === 'BT1' || cell.name === 'BT3' || cell.name === 'BT6' || cell.name === 'HT' || cell.name === 'T4') {
                    ctx.fillStyle = '#1f2937';
                    ctx.font = '9px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText("Boys", x * gridSize + gridSize / 2, y * gridSize + gridSize / 2 - 5);
                    ctx.fillText("Toilet", x * gridSize + gridSize / 2, y * gridSize + gridSize / 2 + 5);
                } else if (cell.type === 'lift') {
                    ctx.fillStyle = '#1f2937';
                    ctx.font = '9px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText("Lift", x * gridSize + gridSize / 2, y * gridSize + gridSize / 2);
                } else if (cell.type === 'stair') {
                    ctx.fillStyle = '#1f2937';
                    ctx.font = '9px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText("Stair", x * gridSize + gridSize / 2, y * gridSize + gridSize / 2);
                } else if (cell.name && cell.type !== 'corridor') {
                    ctx.fillStyle = '#1f2937';
                    ctx.font = '9px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(cell.name, x * gridSize + gridSize / 2, y * gridSize + gridSize / 2);
                }
            }
        }
    }

    // Draws a tracker dot on the canvas at the player's current position.
    function drawTracker(x, y) {
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(x * gridSize + gridSize / 2, y * gridSize + gridSize / 2, 7, 0, Math.PI * 2);
        ctx.fill();
    }

    function findPathCoordinates(path) {
        const coordinates = [];
        for (const roomName of path) {
            const coord = roomCoordinates[roomName];
            if (coord && coord.x < gridWidth && coord.y < gridHeight) {
                coordinates.push({
                    x: coord.x * gridSize + gridSize / 2,
                    y: coord.y * gridSize + gridSize / 2
                });
            }
        }
        return coordinates;
    }

    function drawPath(pathCoordinates) {
        if (pathCoordinates.length < 2) return;

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        
        ctx.moveTo(pathCoordinates[0].x, pathCoordinates[0].y);

        for (let i = 1; i < pathCoordinates.length; i++) {
            ctx.lineTo(pathCoordinates[i].x, pathCoordinates[i].y);
        }
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        pathCoordinates.forEach(coord => {
            ctx.beginPath();
            ctx.arc(coord.x, coord.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function bfs(start, end) {
        const queue = [[start]];
        const visited = new Set();
        
        while (queue.length > 0) {
            const currentPath = queue.shift();
            const currentNode = currentPath[currentPath.length - 1];

            if (currentNode === end) {
                return currentPath;
            }

            if (!visited.has(currentNode)) {
                visited.add(currentNode);
                const neighbors = nodes[currentNode]?.neighbors || [];
                for (const neighbor of neighbors) {
                    const neighborType = nodes[neighbor]?.type;
                    
                    if ((neighborType !== 'lift' && neighborType !== 'stair') || neighbor === end) {
                        if (!visited.has(neighbor)) {
                            const newPath = [...currentPath, neighbor];
                            queue.push(newPath);
                        }
                    }
                }
            }
        }
        return null;
    }

    // Generates a human-readable direction instruction based on the player's position and the path.
    function getNextDirection(path) {
        if (!path || path.length === 0) {
            return "No path available.";
        }
        
        const playerNodeIndex = path.indexOf(playerPosition.name);
        if (playerNodeIndex === -1) {
            return "You are off the planned path.";
        }
        
        if (playerNodeIndex >= path.length - 1) {
            return "You have arrived at your destination!";
        }

        const nextNodeName = path[playerNodeIndex + 1];
        const nextCoord = roomCoordinates[nextNodeName];
        const playerCoord = roomCoordinates[playerPosition.name];

        const dx = nextCoord.x - playerCoord.x;
        const dy = nextCoord.y - playerCoord.y;

        let neededDirection = '';
        if (dx > 0) neededDirection = 'east';
        else if (dx < 0) neededDirection = 'west';
        else if (dy > 0) neededDirection = 'south';
        else if (dy < 0) neededDirection = 'north';

        if (playerDirection === neededDirection) {
            return `Go straight towards ${nextNodeName}.`;
        }

        const directions = ['north', 'east', 'south', 'west'];
        const playerIndex = directions.indexOf(playerDirection);
        const neededIndex = directions.indexOf(neededDirection);
        const turn = (neededIndex - playerIndex + 4) % 4;

        if (turn === 1) {
            return `Turn right towards ${nextNodeName}.`;
        } else if (turn === 3) {
            return `Turn left towards ${nextNodeName}.`;
        } else if (turn === 2) {
            return `Turn around.`;
        }

        return `Proceed to ${nextNodeName}.`;
    }

    // Updates the compass needle's rotation.
    function updateCompass() {
        let rotation = 0;
        if (playerDirection === 'east') rotation = 90;
        if (playerDirection === 'south') rotation = 180;
        if (playerDirection === 'west') rotation = 270;
        compassArrow.style.transform = `rotate(${rotation}deg)`;
    }

    // Simulates the player moving forward one step in their current direction.
    function moveForward() {
        let newX = playerPosition.x;
        let newY = playerPosition.y;

        if (playerDirection === 'north') newY--;
        if (playerDirection === 'east') newX++;
        if (playerDirection === 'south') newY++;
        if (playerDirection === 'west') newX--;

        if (newX >= 0 && newX < gridWidth && newY >= 0 && newY < gridHeight) {
            const nextCell = gridLayout[newY][newX];
            if (nextCell && nextCell.type !== 'empty') {
                playerPosition = { x: newX, y: newY, name: nextCell.name };
                redrawMap();
                updateInstructions();
            } else {
                showMessage("Can't move there, it's a wall!", "error");
            }
        }
    }

    // Simulates the player turning left.
    function turnLeft() {
        const directions = ['north', 'west', 'south', 'east'];
        playerDirection = directions[directions.indexOf(playerDirection)];
        updateCompass();
        updateInstructions();
    }

    // Simulates the player turning right.
    function turnRight() {
        const directions = ['north', 'east', 'south', 'west'];
        playerDirection = directions[(directions.indexOf(playerDirection) + 1) % 4];
        updateCompass();
        updateInstructions();
    }

    // Redraws the entire canvas with the grid, path, and player tracker.
    function redrawMap() {
        drawGrid();
        if (currentPath.length > 0) {
            const pathCoords = findPathCoordinates(currentPath);
            drawPath(pathCoords);
            drawTracker(playerPosition.x, playerPosition.y);
        }
    }

    // Updates the text instruction based on the player's current position and direction.
    function updateInstructions() {
        const nextInstruction = getNextDirection(currentPath);
        currentInstruction.textContent = nextInstruction;

        if (nextInstruction === "You have arrived!") {
            showMessage("You have arrived at your destination!", "success");
            navigationControls.classList.add('hidden');
        } else {
            showMessage('Following Path...', 'info');
        }
    }

    // Event listeners for the UI buttons
    findPathBtn.addEventListener('click', () => {
        const startRoom = startRoomSelect.value;
        const endRoom = endRoomSelect.value;

        if (!startRoom || !endRoom) {
            showMessage("Please select both a start and end location.", "error");
            navigationControls.classList.add('hidden');
            return;
        }

        if (startRoom === endRoom) {
            showMessage("Start and end locations are the same. No path to show.", "info");
            navigationControls.classList.add('hidden');
            return;
        }

        let actualEndRoom = endRoom;
        if (['girls_toilet', 'boys_toilet', 'lift', 'stair'].includes(endRoom)) {
            const nearestAmenity = findNearestAmenity(startRoom, endRoom);
            if (nearestAmenity) {
                actualEndRoom = nearestAmenity;
            } else {
                showMessage(`No ${endRoom.replace('_', ' ')}s found.`, "error");
                navigationControls.classList.add('hidden');
                return;
            }
        }

        currentPath = bfs(startRoom, actualEndRoom);

        if (currentPath) {
            const startCoord = roomCoordinates[startRoom];
            playerPosition = { x: startCoord.x, y: startCoord.y, name: startRoom };
            playerDirection = 'north';

            redrawMap();
            updateInstructions();
            updateCompass();
            
            showMessage(`Path found from ${startRoom} to ${actualEndRoom}!`, "success");
            navigationControls.classList.remove('hidden');

        } else {
            showMessage("No path could be found between the selected locations.", "error");
            navigationControls.classList.add('hidden');
        }
    });

    moveForwardBtn.addEventListener('click', moveForward);
    turnLeftBtn.addEventListener('click', turnLeft);
    turnRightBtn.addEventListener('click', turnRight);

    // Initialize the application when the page loads
    init();
});
