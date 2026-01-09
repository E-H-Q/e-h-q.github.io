// INPUT.JS: HANDLES USER INPUT

var isZoomedOut = false;
var isMouseDown = false;
var lastTile = null;
var keyboardMode = false;
var cursorVisible = false;

var input = {
	init: function() {
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
		if (currentEntityIndex < 0 || entities[currentEntityIndex] !== player) return;
		
		if ([37, 38, 39, 40].includes(event.keyCode)) { // ARROW KEYS
			event.preventDefault();
			
			if (!keyboardMode) window.cursorWorldPos = {x: player.x, y: player.y};
			
			keyboardMode = true;
			cursorVisible = true;
			document.body.style.cursor = 'none';
			
			switch(event.keyCode) {
				case 37: window.cursorWorldPos.x--; break;
				case 38: window.cursorWorldPos.y--; break;
				case 39: window.cursorWorldPos.x++; break;
				case 40: window.cursorWorldPos.y++; break;
			}
			
			window.cursorWorldPos.x = Math.max(camera.x, Math.min(camera.x + viewportSize - 1, window.cursorWorldPos.x));
			window.cursorWorldPos.y = Math.max(camera.y, Math.min(camera.y + viewportSize - 1, window.cursorWorldPos.y));
			window.cursorWorldPos.x = Math.max(0, Math.min(size - 1, window.cursorWorldPos.x));
			window.cursorWorldPos.y = Math.max(0, Math.min(size - 1, window.cursorWorldPos.y));
			
			update();
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
		
		if (event.keyCode === 82) { // R - Reload
			event.preventDefault();
			if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
				if (reloadWeapon(player)) {
					exitPeekMode();
					currentEntityTurnsRemaining--;
					
					if (currentEntityTurnsRemaining <= 0) {
						currentEntityIndex++;
						if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
						currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
					}
					
					update();
				}
			}
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
						EntitySystem.hasLOS(player, e.x, e.y, true) &&
						e.x >= camera.x && e.x < camera.x + viewportSize &&
						e.y >= camera.y && e.y < camera.y + viewportSize
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
					}
				} else if (action.value === "move") {
					const visibleItems = mapItems.filter(item => {
						return hasPermissiveLOS(player.x, player.y, item.x, item.y) &&
						       item.x >= camera.x && item.x < camera.x + viewportSize &&
						       item.y >= camera.y && item.y < camera.y + viewportSize;
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
					pickupItem(entities[currentEntityIndex], entities[currentEntityIndex].x, entities[currentEntityIndex].y);
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
		
		if (event.keyCode >= 48 && event.keyCode <= 57) {
			if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
				let slotIndex = event.keyCode - 49;
				if (event.keyCode === 48) slotIndex = 9;
				
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
			
			if (keyboardMode && window.cursorWorldPos) {
				update();
			} else {
				update();
				
				if (mouse_pos.clientX && mouse_pos.clientY) {
					const evt = new MouseEvent('mousemove', {
						clientX: mouse_pos.clientX,
						clientY: mouse_pos.clientY
					});
					input.mouse(evt);
				}
			}
		}
		if (event.keyCode === 80) { // P - Peek mode
			event.preventDefault();
			activatePeekMode()
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
				
				const tileType = document.getElementById('tile-type').value;
				const dup = walls.findIndex(el => el.x === click_pos.x && el.y === click_pos.y);
				
				if (dup < 0) {
					walls.push({x: click_pos.x, y: click_pos.y, type: tileType});
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
						let screenOffsetX, screenOffsetY;
						if (keyboardMode) {
							screenOffsetX = window.cursorWorldPos.x - camera.x;
							screenOffsetY = window.cursorWorldPos.y - camera.y;
						}
						
						turns.move(player, click_pos.x, click_pos.y);
						
						if (keyboardMode) {
							window.cursorWorldPos.x = camera.x + screenOffsetX;
							window.cursorWorldPos.y = camera.y + screenOffsetY;
							window.cursorWorldPos.x = Math.max(0, Math.min(size - 1, window.cursorWorldPos.x));
							window.cursorWorldPos.y = Math.max(0, Math.min(size - 1, window.cursorWorldPos.y));
							
							canvas.init();
							valid = [];
							canvas.clear();
							canvas.grid();
							canvas.walls();
							canvas.items();
							canvas.drawOnionskin();
							canvas.player();
							canvas.enemy();
							
							populate.reset();
							populate.enemies();
							populate.player();
							
							if (entities[currentEntityIndex] === player && action.value === "move") {
								calc.move(player);
							}
							
							if (action.value === "move" && window.cursorWorldPos) {
								const endX = window.cursorWorldPos.x;
								const endY = window.cursorWorldPos.y;
								
								const isValid = valid.find(v => v.x === endX && v.y === endY);
								
								if (isValid && endX >= 0 && endX < size && endY >= 0 && endY < size) {
									const graph = new Graph(pts, {diagonal: true});
									const pathResult = astar.search(graph, graph.grid[player.x][player.y], graph.grid[endX][endY]);
									if (pathResult && pathResult.length > 0) {
										canvas.path(pathResult);
									}
								}
							}
							
							canvas.cursor();
							updateTurnOrder();
							updateInventory();
							updateEquipment();
							updatePeekButton();
						}
					}
				}
				break;
				
			case "attack":
				if (!hasAmmo(player)) {
					console.log("Out of ammo! Press R to reload.");
					return;
				}
				
				const effectiveRange = getEntityAttackRange(player);
				const dist = calc.distance(player.x, click_pos.x, player.y, click_pos.y);
				
				// Use permissive LOS that sees through glass
				const hasLOS = hasPermissiveLOS(player.x, player.y, click_pos.x, click_pos.y);
				
				if (dist > effectiveRange || !hasLOS) return;
				
				const targetingTiles = calculateEntityTargeting(player, click_pos.x, click_pos.y);
				const accessoryDef = player.equipment?.accessory ? itemTypes[player.equipment.accessory.itemType] : null;
				const weaponDef = player.equipment?.weapon ? itemTypes[player.equipment.weapon.itemType] : null;
				const canDestroy = weaponDef?.canDestroy || accessoryDef?.grantsDestroy;
				
				const targetsInArea = getTargetedEntities(player, click_pos.x, click_pos.y);
				const enemies = targetsInArea.filter(e => e !== player && e.hp > 0);
				const hasWalls = canDestroy && targetingTiles.some(t => {
					const w = walls.find(w => w.x === t.x && w.y === t.y);
					return w && w.type !== 'glass';
				});
				const hasGlass = targetingTiles.some(t => walls.find(w => w.x === t.x && w.y === t.y && w.type === 'glass'));
				const hasTargets = targetingTiles.length > 0 && (enemies.length > 0 || hasWalls || hasGlass);
				
				if (!hasTargets) return;

				if (isPeekMode && peekStep === 2) {
					if (EntitySystem.attack(player, click_pos.x, click_pos.y)) {
						currentEntityTurnsRemaining--;
					}
					player.x = peekStartX;
					player.y = peekStartY;
					exitPeekMode();
				} else {
					if (EntitySystem.attack(player, click_pos.x, click_pos.y)) {
						currentEntityTurnsRemaining--;
					}
					
					if (currentEntityTurnsRemaining <= 0) {
						currentEntityIndex++;
						if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
						currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
					}
					
					update();
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
					
					const tileType = document.getElementById('tile-type').value;
					const dup = walls.findIndex(el => el.x === click_pos.x && el.y === click_pos.y);
					
					if (dup < 0) {
						walls.push({x: click_pos.x, y: click_pos.y, type: tileType});
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
