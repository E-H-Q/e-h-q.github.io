// INPUT.JS: HANDLES USER INPUT

var isZoomedOut = false;
const trick = new MouseEvent('mousemove', {clientX: mouse_pos.clientX, clientY: mouse_pos.clientY});

var input = {
	init: function() {
		cursor.style.position = "absolute";
		cursor.style.visibility = "hidden";
		cursor.style.padding = (tileSize / 2) + "px";
		cursor.style.border = "1px solid #FF0000";
		cursor.style.pointerEvents = "auto"; // Make sure cursor can receive events
	},
	keyboard: function(event) {
		// Shift+E - Toggle Edit Mode
		if (event.shiftKey && event.keyCode === 69 && event.type === 'keydown') {
			edit.checked = !edit.checked;
			
			// If entering edit mode and not zoomed out, zoom out
			if (edit.checked && !isZoomedOut) {
				isZoomedOut = true;
				tileSize = tileSize / 2;
				viewportSize = viewportSize * 2;
				cursor.style.padding = (tileSize / 2) + "px";
				
				const currentEntity = entities[currentEntityIndex] || player;
				camera = {
					x: currentEntity.x - Math.round((viewportSize / 2)) + 1,
					y: currentEntity.y - Math.round((viewportSize / 2)) + 1
				};
				
				update();
				input.mouse(trick);
			}
			
			// Toggle size input visibility
			const sizeInput = document.getElementById('size-input-container');
			if (sizeInput) {
				sizeInput.style.display = edit.checked ? 'inline-block' : 'none';
			}
			
			return;
		}
		
		// Escape - Exit Edit Mode
		if (event.keyCode === 27 && event.type === 'keydown' && edit.checked) {
			edit.checked = false;
			
			// Zoom back in if zoomed out
			if (isZoomedOut) {
				isZoomedOut = false;
				tileSize = tileSize * 2;
				viewportSize = viewportSize / 2;
				cursor.style.padding = (tileSize / 2) + "px";
				
				const currentEntity = entities[currentEntityIndex] || player;
				camera = {
					x: currentEntity.x - Math.round((viewportSize / 2)) + 1,
					y: currentEntity.y - Math.round((viewportSize / 2)) + 1
				};
				
				update();
			}
			
			// Hide size input
			const sizeInput = document.getElementById('size-input-container');
			if (sizeInput) {
				sizeInput.style.display = 'none';
			}
			
			return;
		}
		
		// Number keys 1-9 - use items from inventory
		if (event.type === 'keydown' && event.keyCode >= 49 && event.keyCode <= 57) {
			const inventoryIndex = event.keyCode - 49; // 49 is keyCode for '1'
			if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
				if (typeof useItem !== 'undefined' && useItem(player, inventoryIndex)) {
					// Item was used successfully
					currentEntityTurnsRemaining--;
					
					// If this was the player's last turn, force end of turn
					if (currentEntityTurnsRemaining <= 0) {
						currentEntityIndex++;
						if (currentEntityIndex >= entities.length) {
							currentEntityIndex = 0;
						}
						currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
					}
				}
			}
			return;
		}
		
		// Period key - pass/wait (skip one turn)
		if (event.keyCode === 190 && event.type === 'keydown') {
			if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player && currentEntityTurnsRemaining > 0) {
				// Check for item pickup
				if (typeof pickupItem !== 'undefined') {
					pickupItem(entities[currentEntityIndex],entities[currentEntityIndex].x, entities[currentEntityIndex].y);
				}
				currentEntityTurnsRemaining--;
				console.log(player.name + " waits...");
				
				// If this was the player's last turn, force end of turn
				if (currentEntityTurnsRemaining <= 0) {
					currentEntityIndex++;
					if (currentEntityIndex >= entities.length) {
						currentEntityIndex = 0;
					}
					currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
				}
				
				update();
			}
			return;
		}
		
		// Left Shift key - toggle zoom (only works as toggle in edit mode, hold otherwise)
		if (event.keyCode === 16 && event.type === 'keydown') {
			if (edit.checked) {
				// In edit mode: toggle zoom on each press
				isZoomedOut = !isZoomedOut;
				
				if (isZoomedOut) {
					tileSize = tileSize / 2;
					viewportSize = viewportSize * 2;
				} else {
					tileSize = tileSize * 2;
					viewportSize = viewportSize / 2;
				}
				
				cursor.style.padding = (tileSize / 2) + "px";
				
				const currentEntity = entities[currentEntityIndex] || player;
				camera = {
					x: currentEntity.x - Math.round((viewportSize / 2)) + 1,
					y: currentEntity.y - Math.round((viewportSize / 2)) + 1
				};
				
				update();
				input.mouse(trick);
			} else if (!isZoomedOut) {
				// Not in edit mode: zoom out while holding
				isZoomedOut = true;
				
				tileSize = tileSize / 2;
				viewportSize = viewportSize * 2;
				cursor.style.padding = (tileSize / 2) + "px";
				
				const currentEntity = entities[currentEntityIndex] || player;
				camera = {
					x: currentEntity.x - Math.round((viewportSize / 2)) + 1,
					y: currentEntity.y - Math.round((viewportSize / 2)) + 1
				};
				
				update();
				input.mouse(trick);
			}
			
			return;
		}
		if (event.keyCode === 16 && event.type === 'keyup' && isZoomedOut && !edit.checked) {
			// Only zoom back in on release if NOT in edit mode
			isZoomedOut = false;
			
			tileSize = tileSize * 2;
			viewportSize = viewportSize / 2;
			cursor.style.padding = (tileSize / 2) + "px";
			
			const currentEntity = entities[currentEntityIndex] || player;
			camera = {
				x: currentEntity.x - Math.round((viewportSize / 2)) + 1,
				y: currentEntity.y - Math.round((viewportSize / 2)) + 1
			};
			
			update();
		}
		if (event.keyCode === 9 && event.type == "keydown") {
			event.preventDefault(); // Prevent tab from focusing HTML elements
			action.value = (action.value === "move") ? "attack" : "move";
			document.activeElement.blur();
			// tricks the mouse event listener into activating when attack mode is enabled, drawing the LOS line
			update();
			const trick = new MouseEvent('mousemove', {clientX: mouse_pos.clientX, clientY: mouse_pos.clientY});
			input.mouse(trick);
		}
	},
	mouse: function(event) {
		// Get canvas position relative to the viewport (accounts for scrolling)
		const rect = c.getBoundingClientRect();

		// Calculate mouse position within the canvas
		// clientX/clientY are already viewport-relative, so this works correctly
		const canvasX = event.clientX - rect.left;
		const canvasY = event.clientY - rect.top;
		
		// Store both for later use
		mouse_pos = {
			canvasX: canvasX,
			canvasY: canvasY,
			clientX: event.clientX,
			clientY: event.clientY
		};

		// Calculate grid position
		const gridX = Math.floor(canvasX / tileSize);
		const gridY = Math.floor(canvasY / tileSize);
		
		// Position cursor - add window scroll offset to convert viewport coords to page coords
		cursor.style.left = (rect.left + window.scrollX + gridX * tileSize) + "px";
		cursor.style.top = (rect.top + window.scrollY + gridY * tileSize) + "px";

		if (action.value === "attack") {	
			const endX = camera.x + gridX;
			const endY = camera.y + gridY;
			
			const look = {
				start: { x: player.x, y: player.y },
				end: { x: endX, y: endY }
			};
			
			const dist = calc.distance(player.x, endX, player.y, endY);
			let path = calc.los(look);
			
			// Limit path to player range and remove first element (player position)
			if (path.length > player.attack_range + 1) {
				path = path.slice(1, player.attack_range + 1);
			} else {
				path = path.slice(1);
			}
			
			// Hide red box if out of range
			if (dist > player.attack_range) {
				cursor.style.visibility = "hidden";
			} else {
				cursor.style.visibility = "visible";
			}
			
			update();
			canvas.los(path);
		} else {
			cursor.style.visibility = "visible";
		}
	},
	click: function() {
		const rect = c.getBoundingClientRect();
		const canvasX = mouse_pos.canvasX;
		const canvasY = mouse_pos.canvasY;
		
		const gridX = Math.floor(canvasX / tileSize);
		const gridY = Math.floor(canvasY / tileSize);
		
		const click_pos = {
			x: camera.x + gridX,
			y: camera.y + gridY
		};

		if (edit.checked) {
			// Prevent negative coordinates
			if (click_pos.x < 0 || click_pos.y < 0 || click_pos.x >= size || click_pos.y >= size) {
				return;
			}
			
			const dup = walls.findIndex(el => el.x === click_pos.x && el.y === click_pos.y);
			if (dup < 0) {
				walls.push(new calc.coordinate(click_pos.x, click_pos.y));
			} else {
				walls.splice(dup, 1);
			}
			update();
			return;
		}

		switch (action.value) {
			case "move": // PLAYER MOVES
				const validClick = valid.find(v => v.x === click_pos.x && v.y === click_pos.y);
				if (validClick) {
					turns.move(player, click_pos.x, click_pos.y);
				}
				break;
			case "attack": // PLAYER ATTACKS
				// Find which enemy was clicked
				let targetEnemy = null;
				for (let i = 0; i < allEnemies.length; i++) {
					if (click_pos.x === allEnemies[i].x && click_pos.y === allEnemies[i].y && allEnemies[i].hp > 0) {
						targetEnemy = allEnemies[i];
						break;
					}
				}
				
				if (!targetEnemy) return;
				
				const look = {
					start: { x: player.x, y: player.y },
					end: { x: targetEnemy.x, y: targetEnemy.y }
				};
				const check = calc.los(look);
				const dist = calc.distance(player.x, targetEnemy.x, player.y, targetEnemy.y);
				const lengthDiff = Math.abs(check.length - dist);
				
				// Check if LOS is blocked
				if (check.length < dist) {
					console.log("Blocked by wall");
					return;
				}
				if (dist > player.attack_range) {
					console.log("Target out of range!");
					return;
				}
				if (lengthDiff <= 1) {
					turns.attack(targetEnemy, player);
				} else {
					return;
				}
				update();
				break;
			default:
				update();
		}
	},
	right_click: function(event) {
		event.preventDefault(); // prevent regular browser right click menu
		const canvasX = mouse_pos.canvasX;
		const canvasY = mouse_pos.canvasY;
		
		const gridX = Math.floor(canvasX / tileSize);
		const gridY = Math.floor(canvasY / tileSize);
		
		const click_pos = {
			x: camera.x + gridX,
			y: camera.y + gridY
		};
		console.log(click_pos);
	}
};
