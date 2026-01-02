// INPUT.JS: HANDLES USER INPUT

var isZoomedOut = false;
var isMouseDown = false;
var lastTile = null;
var keyboardMode = false;
var cursorVisible = false;

var input = {
	init: function() {
		// Initialize cursor position
		window.cursorWorldPos = null;
		cursorVisible = false;
	},
	
	handleZoom: function(zoomOut) {
		isZoomedOut = zoomOut;
		tileSize = zoomOut ? tileSize / 2 : tileSize * 2;
		viewportSize = zoomOut ? viewportSize * 2 : viewportSize / 2;
		
		const currentEntity = entities[currentEntityIndex] || player;
		camera = {
			x: currentEntity.x - Math.round((viewportSize / 2)) + 1,
			y: currentEntity.y - Math.round((viewportSize / 2)) + 1
		};
		
		update();	
	},
	
	keyboard: function(event) {
		if (event.type !== 'keydown' && event.keyCode !== 16) return;
		// Guard: only allow zoom during player turn
		if (currentEntityIndex < 0 || entities[currentEntityIndex] !== player) return;
		
		if ([37, 38, 39, 40].includes(event.keyCode)) { // ARROW KEYS
			event.preventDefault();
			
			if (!keyboardMode) {
				window.cursorWorldPos = {x: player.x, y: player.y};
			}
			
			keyboardMode = true;
			cursorVisible = true;
			document.body.style.cursor = 'none';
			
			switch(event.keyCode) {
				case 37: window.cursorWorldPos.x--; break;
				case 38: window.cursorWorldPos.y--; break;
				case 39: window.cursorWorldPos.x++; break;
				case 40: window.cursorWorldPos.y++; break;
			}
			
			window.cursorWorldPos.x = Math.max(0, Math.min(size - 1, window.cursorWorldPos.x));
			window.cursorWorldPos.y = Math.max(0, Math.min(size - 1, window.cursorWorldPos.y));
			
			update();
			
			if (action.value === "attack") {
				const targetingTiles = calculateEntityTargeting(player, window.cursorWorldPos.x, window.cursorWorldPos.y);
				if (targetingTiles.length > 0) canvas.los(targetingTiles);
			}
			
			return;
		}
		
		if (event.keyCode === 13) { // ENTER
			event.preventDefault();
			if (keyboardMode && currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
				input.click();
			}
			return;
		}
		
		if (event.keyCode === 27) {
			if (isPeekMode) {
				exitPeekMode();
			} else if (edit.checked) {
				edit.checked = false;
				if (isZoomedOut) input.handleZoom(false);
				document.getElementById('size-input-container').style.display = 'none';
			}
			return;
		}
		
		if (event.shiftKey && event.keyCode === 69) {
			edit.checked = !edit.checked;
			if (edit.checked && !isZoomedOut) input.handleZoom(true);
			document.getElementById('size-input-container').style.display = edit.checked ? 'inline-block' : 'none';
			return;
		}
		
		if (event.keyCode === 222) {
			event.preventDefault();
			if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
				keyboardMode = true;
				cursorVisible = true;
				document.body.style.cursor = 'none';
				
				if (action.value === "attack") {
					const visibleEnemies = entities.filter(e => 
						e !== player && 
						e.hp > 0 && 
						(e.seenX !== 0 || e.seenY !== 0) &&
						EntitySystem.hasLOS(player, e.x, e.y, true)
					);
					
					if (visibleEnemies.length > 0) {
						if (window.targetIndex === undefined) {
							window.targetIndex = 0;
						} else {
							window.targetIndex = (window.targetIndex + 1) % visibleEnemies.length;
						}
						
						const target = visibleEnemies[window.targetIndex];
						window.cursorWorldPos = {x: target.x, y: target.y};
						update();
						
						const targetingTiles = calculateEntityTargeting(player, target.x, target.y);
						canvas.los(targetingTiles);
					}
				} else if (action.value === "move") {
					const visibleItems = mapItems.filter(item => {
						return hasPermissiveLOS(player.x, player.y, item.x, item.y);
					});
					
					if (visibleItems.length > 0) {
						if (window.itemTargetIndex === undefined) {
							window.itemTargetIndex = 0;
						} else {
							window.itemTargetIndex = (window.itemTargetIndex + 1) % visibleItems.length;
						}
						
						const target = visibleItems[window.itemTargetIndex];
						window.cursorWorldPos = {x: target.x, y: target.y};
						update();
					}
				}
			}
			return;
		}
		
		if (event.keyCode === 190) {
			if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player && currentEntityTurnsRemaining > 0) {
				if (typeof pickupItem !== 'undefined') {
					pickupItem(entities[currentEntityIndex],
					entities[currentEntityIndex].x, entities[currentEntityIndex].y);
				}
				currentEntityTurnsRemaining--;
				console.log(player.name + " waits...");
				
				if (currentEntityTurnsRemaining <= 0) {
					currentEntityIndex++;
					if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
					currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
				}
				update();
			}
			return;
		}
		
		// Number keys 1-9 and 0 for inventory slots
		if (event.keyCode >= 48 && event.keyCode <= 57) {
			if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
				let slotIndex = event.keyCode - 49; // 49 is keyCode for '1'
				if (event.keyCode === 48) slotIndex = 9; // 0 key maps to slot 10
				
				if (slotIndex >= 0 && slotIndex < player.inventory.length) {
					if (typeof useItem !== 'undefined') {
						useItem(player, slotIndex)
					}
				}
			}
			return;
		}
		
		if (event.keyCode === 16) { // SHIFT
			
			if (event.type === 'keydown') {
				if (!isZoomedOut) {
					input.handleZoom(true);
				} else if (isZoomedOut) {
					input.handleZoom(false);
				}
			}
			return;
		}
		
		if (event.keyCode === 9) { // TAB
			event.preventDefault();
			
			if (isPeekMode && peekStep === 2) return;
			
			action.value = (action.value === "move") ? "attack" : "move";
			document.activeElement.blur();
			
			window.targetIndex = 0;
			window.itemTargetIndex = 0;
			
			update();
			
			if (!keyboardMode && mouse_pos.clientX && mouse_pos.clientY) {
				const evt = new MouseEvent('mousemove', {
					clientX: mouse_pos.clientX,
					clientY: mouse_pos.clientY
				});
				input.mouse(evt);
			}
		}
	},
	
	mouse: function(event) {
		if (keyboardMode) {
			keyboardMode = false;
			document.body.style.cursor = '';
		}
		
		const rect = c.getBoundingClientRect();
		const canvasX = event.clientX - rect.left;
		const canvasY = event.clientY - rect.top;
		
		mouse_pos = {
			canvasX: canvasX,
			canvasY: canvasY,
			clientX: event.clientX,
			clientY: event.clientY
		};

		const gridX = Math.floor(canvasX / tileSize);
		const gridY = Math.floor(canvasY / tileSize);
		
		// Update cursor world position
		window.cursorWorldPos = {
			x: camera.x + gridX,
			y: camera.y + gridY
		};
		cursorVisible = true;

		if (edit.checked && isMouseDown) {
			const click_pos = {
				x: camera.x + gridX,
				y: camera.y + gridY
			};
			
			if (click_pos.x < 0 || click_pos.y < 0 || click_pos.x >= size || click_pos.y >= size) return;
			
			if (!lastTile || lastTile.x !== click_pos.x || lastTile.y !== click_pos.y) {
				lastTile = {x: click_pos.x, y: click_pos.y};
				
				const dup = walls.findIndex(el => el.x === click_pos.x && el.y === click_pos.y);
				if (dup < 0) {
					walls.push(new calc.coordinate(click_pos.x, click_pos.y));
				} else {
					walls.splice(dup, 1);
				}
				update();
			}
			return;
		}

		if (action.value === "attack") {	
			const endX = camera.x + gridX;
			const endY = camera.y + gridY;
			
			update();
			const targetingTiles = calculateEntityTargeting(player, endX, endY);
			if (targetingTiles.length > 0) {
				canvas.los(targetingTiles);
			}
		} else {
			update();
		}
	},
	
	click: function() {
		if (edit.checked) return;
		if (!window.cursorWorldPos) return;
		
		const click_pos = {
			x: window.cursorWorldPos.x,
			y: window.cursorWorldPos.y
		};


		switch (action.value) {
			case "move":
				const validClick = valid.find(v => v.x === click_pos.x && v.y === click_pos.y);
				if (validClick) {
					if (isPeekMode && peekStep === 1) {
						player.x = click_pos.x;
						player.y = click_pos.y;
						player.range = savedPlayerRange;
						
						peekStep = 2;
						action.value = "attack";
						action.disabled = true;
						currentEntityTurnsRemaining--;
						update();
					} else {
						// Store screen offset BEFORE move in keyboard mode
						let screenOffsetX, screenOffsetY;
						if (keyboardMode) {
							screenOffsetX = window.cursorWorldPos.x - camera.x;
							screenOffsetY = window.cursorWorldPos.y - camera.y;
						}
						
						turns.move(player, click_pos.x, click_pos.y);
						
						// Restore cursor to same screen position AFTER camera moves
						if (keyboardMode) {
							window.cursorWorldPos.x = camera.x + screenOffsetX;
							window.cursorWorldPos.y = camera.y + screenOffsetY;
							window.cursorWorldPos.x = Math.max(0, Math.min(size - 1, window.cursorWorldPos.x));
							window.cursorWorldPos.y = Math.max(0, Math.min(size - 1, window.cursorWorldPos.y));
							update();
						}
					}
				}
				break;
				
			case "attack":
				const targetsInArea = getTargetedEntities(player, click_pos.x, click_pos.y);
				const enemies = targetsInArea.filter(e => e !== player && e.hp > 0);
				
				const targetingTiles = calculateEntityTargeting(player, click_pos.x, click_pos.y);
				
				const accessoryDef = player.equipment?.accessory ? itemTypes[player.equipment.accessory.itemType] : null;
				const weaponDef = player.equipment?.weapon ? itemTypes[player.equipment.weapon.itemType] : null;
				const canDestroy = weaponDef?.canDestroy || accessoryDef?.grantsDestroy;
				
				const effectiveRange = getEntityAttackRange(player);
				const dist = calc.distance(player.x, click_pos.x, player.y, click_pos.y);
				const hasLOS = hasPermissiveLOS(player.x, player.y, click_pos.x, click_pos.y);
				
				if (dist > effectiveRange || !hasLOS) return;
				
				const hasWalls = canDestroy && targetingTiles.some(t => walls.find(w => w.x === t.x && w.y === t.y));
				const hasTargets = targetingTiles.length > 0 && (enemies.length > 0 || hasWalls);
				
				if (!hasTargets) return;

				if (isPeekMode && peekStep === 2) {
					const hadTargets = enemies.length > 0;
					
					const burstCount = weaponDef?.burst || 1;
					for (let burst = 0; burst < burstCount; burst++) {
						for (let enemy of enemies) {
							if (enemy.hp > 0) {
								EntitySystem.attack(player, enemy);
							}
						}
					}
					
					const destroyedWalls = EntitySystem.destroyWalls(player, click_pos.x, click_pos.y);
					
					if (hadTargets || destroyedWalls) {
						currentEntityTurnsRemaining--;
					}
					player.x = peekStartX;
					player.y = peekStartY;
					exitPeekMode();
				} else {
					const hadTargets = enemies.length > 0;
					
					const burstCount = weaponDef?.burst || 1;
					for (let burst = 0; burst < burstCount; burst++) {
						for (let enemy of enemies) {
							if (enemy.hp > 0) {
								EntitySystem.attack(player, enemy);
							}
						}
					}
					
					const destroyedWalls = EntitySystem.destroyWalls(player, click_pos.x, click_pos.y);
					
					if (hadTargets || destroyedWalls) {
						currentEntityTurnsRemaining--;
					}
					
					if (currentEntityTurnsRemaining <= 0) {
						currentEntityIndex++;
						if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
						currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
					}
					
					update();
					
					if (action.value === "attack") {
						const targetingTiles = calculateEntityTargeting(player, click_pos.x, click_pos.y);
						canvas.los(targetingTiles);
					}
				}
				break;
				
			default:
				update();
		}
	},
	
	right_click: function(event) {
		event.preventDefault();
		
		if (!window.cursorWorldPos) return;
		
		console.log(window.cursorWorldPos);
		
		document.getElementById('spawn_x').value = window.cursorWorldPos.x;
		document.getElementById('spawn_y').value = window.cursorWorldPos.y;
		document.getElementById('player_x').value = window.cursorWorldPos.x;
		document.getElementById('player_y').value = window.cursorWorldPos.y;
		document.getElementById('item_x').value = window.cursorWorldPos.x;
		document.getElementById('item_y').value = window.cursorWorldPos.y;
	},
	
	mousedown: function(event) {
		if (event.button === 0) {
			isMouseDown = true;
			
			if (edit.checked && window.cursorWorldPos) {
				const click_pos = {
					x: window.cursorWorldPos.x,
					y: window.cursorWorldPos.y
				};
				
				if (click_pos.x >= 0 && click_pos.y >= 0 && click_pos.x < size && click_pos.y < size) {
					lastTile = {x: click_pos.x, y: click_pos.y};
					
					const dup = walls.findIndex(el => el.x === click_pos.x && el.y === click_pos.y);
					if (dup < 0) {
						walls.push(new calc.coordinate(click_pos.x, click_pos.y));
					} else {
						walls.splice(dup, 1);
					}
					update();
				}
			}
		}
	},
	
	mouseup: function(event) {
		if (event.button === 0) {
			isMouseDown = false;
			lastTile = null;
		}
	}
};
