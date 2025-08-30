
        document.addEventListener('DOMContentLoaded', () => {
            const canvas = document.getElementById('map-canvas');
            const ctx = canvas.getContext('2d');
            const findPathBtn = document.getElementById('find-path-btn');
            const startRoomSelect = document.getElementById('start-room');
            const endRoomSelect = document.getElementById('end-room');
            const messageBox = document.getElementById('message-box');
            const currentInstructionBox = document.getElementById('current-instruction-box');
            const currentInstruction = document.getElementById('current-instruction');
            
            const gridSize = 25;
            const gridWidth = 35;
            const gridHeight = 25;
            const headingTolerance = 25; // Degrees of tolerance for a turn
            const moveThresholdTime = 2000; // Time in milliseconds for a steady heading
            let lastValidHeadingTime = null;

            let gridLayout;
            let nodes;
            let roomCoordinates = {};
            let currentPath = [];
            let playerPathIndex = 0;
            let playerHeading = 0;

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
                    drawGrid(); // Draw initial grid

                    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                        DeviceOrientationEvent.requestPermission()
                            .then(permissionState => {
                                if (permissionState === 'granted') {
                                    window.addEventListener('deviceorientation', handleOrientation);
                                } else {
                                    showMessage("Permission for device orientation was denied. Compass will not work.", "error");
                                }
                            })
                            .catch(console.error);
                    } else {
                        window.addEventListener('deviceorientation', handleOrientation);
                    }
                } catch (error) {
                    console.error('Error loading map data:', error);
                    showMessage('Failed to load map data. Please ensure "stitched.json" is in the same directory.', "error");
                }
            }

            function handleOrientation(event) {
                if (event.alpha !== null) {
                    playerHeading = 360 - event.alpha;
                    updateNavigation();
                }
                redrawMap();
            }

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
                
                // Draw the grid normally
                for (let y = 0; y < gridHeight; y++) {
                    for (let x = 0; x < gridWidth; x++) {
                        const cell = gridLayout[y] && gridLayout[y][x] ? gridLayout[y][x] : { type: 'empty' };
                        const color = getCellColor(cell);
                        ctx.fillStyle = color;
                        ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
                        
                        ctx.strokeStyle = '#d1d5db';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(x * gridSize, y * gridSize, gridSize, gridSize);

                        if (cell.type === 'girls_toilet') {
                            ctx.fillStyle = '#1f2937';
                            ctx.font = '9px sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText("Girls", x * gridSize + gridSize / 2, y * gridSize + gridSize / 2 - 5);
                            ctx.fillText("Toilet", x * gridSize + gridSize / 2, y * gridSize + gridSize / 2 + 5);
                        } else if (cell.type === 'boys_toilet') {
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

            function drawTracker() {
                if (currentPath.length > 0 && playerPathIndex < currentPath.length) {
                    const playerNode = currentPath[playerPathIndex];
                    const playerCoord = roomCoordinates[playerNode];
                    
                    if (playerCoord) {
                        const x = playerCoord.x * gridSize + gridSize / 2;
                        const y = playerCoord.y * gridSize + gridSize / 2;
                        const arrowSize = 8;
                        
                        ctx.fillStyle = '#2563eb';
                        ctx.save();
                        ctx.translate(x, y);
                        ctx.rotate(playerHeading * Math.PI / 180);
                        
                        ctx.beginPath();
                        ctx.moveTo(0, -arrowSize);
                        ctx.lineTo(-arrowSize, arrowSize);
                        ctx.lineTo(arrowSize, arrowSize);
                        ctx.closePath();
                        ctx.fill();
                        ctx.restore();
                    }
                }
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

            function getRequiredHeading(fromNode, toNode) {
                const fromCoord = roomCoordinates[fromNode];
                const toCoord = roomCoordinates[toNode];

                if (!fromCoord || !toCoord) return 0;

                const dx = toCoord.x - fromCoord.x;
                const dy = toCoord.y - fromCoord.y;

                const angle = Math.atan2(dx, -dy) * 180 / Math.PI;
                return (angle + 360) % 360;
            }

            function getNextDirectionInstruction() {
                if (playerPathIndex >= currentPath.length - 1) {
                    return "You have arrived at your destination!";
                }

                const fromNodeName = currentPath[playerPathIndex];
                const toNodeName = currentPath[playerPathIndex + 1];
                const fromCoord = roomCoordinates[fromNodeName];
                const toCoord = roomCoordinates[toNodeName];

                if (!fromCoord || !toCoord) {
                    return `Go straight towards ${toNodeName}.`;
                }
                
                const dx = toCoord.x - fromCoord.x;
                const dy = toCoord.y - fromCoord.y;

                if (dx > 0) {
                    return `Turn right towards ${toNodeName}.`;
                } else if (dx < 0) {
                    return `Turn left towards ${toNodeName}.`;
                } else if (dy < 0) {
                    return `Go straight towards ${toNodeName}.`;
                } else if (dy > 0) {
                    return `Turn around and go straight towards ${toNodeName}.`;
                }

                return `Go straight towards ${toNodeName}.`;
            }

            function updateInstructions() {
                if (currentPath.length > 0) {
                    const instruction = getNextDirectionInstruction();
                    currentInstruction.textContent = instruction;
                    if (playerPathIndex >= currentPath.length - 1) {
                         currentInstructionBox.classList.add('hidden');
                    } else {
                        currentInstructionBox.classList.remove('hidden');
                    }
                }
            }
            
            function showMessage(message, type = 'info') {
                messageBox.textContent = message;
                messageBox.classList.remove('hidden', 'error', 'success', 'info');
                messageBox.classList.add(type);
            }

            function redrawMap() {
                drawGrid();
                if (currentPath.length > 0) {
                    drawPath(findPathCoordinates(currentPath));
                    drawTracker();
                }
            }

            function updateNavigation() {
                if (currentPath.length > 0 && playerPathIndex < currentPath.length - 1) {
                    const playerNodeName = currentPath[playerPathIndex];
                    const nextNodeName = currentPath[playerPathIndex + 1];
                    const neededHeading = getRequiredHeading(playerNodeName, nextNodeName);
                    
                    const delta = Math.abs(neededHeading - playerHeading);
                    const isFacingCorrectly = delta < headingTolerance || delta > 360 - headingTolerance;

                    if (isFacingCorrectly) {
                        if (lastValidHeadingTime === null) {
                            lastValidHeadingTime = Date.now();
                        }
                        const timeElapsed = Date.now() - lastValidHeadingTime;
                        if (timeElapsed >= moveThresholdTime) {
                            playerPathIndex++;
                            lastValidHeadingTime = null;
                            
                            if (playerPathIndex >= currentPath.length - 1) {
                                currentInstruction.textContent = "You have arrived at your destination!";
                                showMessage("You have arrived!", "success");
                                currentInstructionBox.classList.add('hidden');
                            } else {
                                const nextInstruction = getNextDirectionInstruction();
                                currentInstruction.textContent = nextInstruction;
                                showMessage(`Following path...`, "info");
                            }
                        }
                    } else {
                        lastValidHeadingTime = null;
                    }
                }
                redrawMap();
            }
            
            findPathBtn.addEventListener('click', () => {
                const startRoom = startRoomSelect.value;
                const endRoom = endRoomSelect.value;

                if (!startRoom || !endRoom) {
                    showMessage("Please select both a start and end location.", "error");
                    currentInstructionBox.classList.add('hidden');
                    return;
                }

                if (startRoom === endRoom) {
                    showMessage("Start and end locations are the same. No path to show.", "info");
                    currentInstructionBox.classList.add('hidden');
                    return;
                }

                let actualEndRoom = endRoom;
                if (['girls_toilet', 'boys_toilet', 'lift', 'stair'].includes(endRoom)) {
                    const nearestAmenity = findNearestAmenity(startRoom, endRoom);
                    if (nearestAmenity) {
                        actualEndRoom = nearestAmenity;
                    } else {
                        showMessage(`No ${endRoom.replace('_', ' ')}s found.`, "error");
                        currentInstructionBox.classList.add('hidden');
                        return;
                    }
                }

                currentPath = bfs(startRoom, actualEndRoom);

                if (currentPath) {
                    playerPathIndex = 0;
                    
                    redrawMap();
                    updateInstructions();
                    
                    showMessage(`Path found from ${startRoom} to ${actualEndRoom}!`, "success");
                    currentInstructionBox.classList.remove('hidden');

                } else {
                    showMessage("No path could be found between the selected locations.", "error");
                    currentInstructionBox.classList.add('hidden');
                }
            });

            init();
        });