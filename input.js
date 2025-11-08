// INPUT.JS: HANDLES USER INPUT

var isZoomedOut = false;
var isMouseDown = false;
var lastTile = null;

var input = {
	init: function() {
		cursor.style.position = "absolute";
		cursor.style.visibility = "hidden";
		cursor.style.padding = (tileSize / 2) + "px";
		cursor.style.border = "1px solid #FF0000";
		cursor.style.pointerEvents = "auto";
	},
	
	handleZoom: function(zoomOut) {
		isZoomedOut = zoomOut;
		tileSize = zoomOut ? tileSize / 2 : tileSize * 2;
		viewportSize = zoomOut ? viewportSize * 2 : viewportSize / 2;
		cursor.style.padding = (tileSize / 2) + "px";
		
		const currentEntity = entities[currentEntityIndex] || player;
		camera = {
			x: currentEntity.x - Math.round((viewportSize / 2)) + 1,
			y: currentEntity.y - Math.round((viewportSize / 2)) + 1
		};
		
		update();
		
		if (mouse_pos.clientX && mouse_pos.clientY) {
			const evt = new MouseEvent('mousemove', {
				clientX: mouse_pos.clientX,
				clientY: mouse_pos.clientY
			});
			input.mouse(evt);
		}
	},
	
	keyboard: function(event) {
		if (event.type !== 'keydown' && event.keyCode !== 16) return;
		
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
		
		if (event.keyCode === 16) {
			if (event.type === 'keydown') {
				if (edit.checked) {
					input.handleZoom(!isZoomedOut);
				} else if (!isZoomedOut) {
					input.handleZoom(true);
				}
			} else if (event.type === 'keyup' && isZoomedOut && !edit.checked) {
				input.handleZoom(false);
			}
			return;
		}
		
		if (event.keyCode === 9 || event.keyCode === 32) {
			event.preventDefault();
			if (isPeekMode && peekStep === 2) return;
			
			action.value = (action.value === "move") ? "attack" : "move";
			document.activeElement.blur();
			update();
			
			if (mouse_pos.clientX && mouse_pos.clientY) {
				const evt = new MouseEvent('mousemove', {
					clientX: mouse_pos.clientX,
					clientY: mouse_pos.clientY
				});
				input.mouse(evt);
			}
		}
	},
	
	mouse: function(event) {
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
		
		cursor.style.left = (rect.left + window.scrollX + gridX * tileSize) + "px";
		cursor.style.top = (rect.top + window.scrollY + gridY * tileSize) + "px";

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
			
			const dist = calc.distance(player.x, endX, player.y, endY);
			
			const targetingTiles = calculateEntityTargeting(player, endX, endY);
			const isInTargeting = targetingTiles.some(t => t.x === endX && t.y === endY);
			
			const hasLOS = hasPermissiveLOS(player.x, player.y, endX, endY) || isInTargeting;
			cursor.style.visibility = (dist > player.attack_range || !hasLOS) ? "hidden" : "visible";

			update();
			canvas.los(targetingTiles);
		} else {
			cursor.style.visibility = "visible";
		}
	},
	
	click: function() {
		if (edit.checked) return;
		
		const gridX = Math.floor(mouse_pos.canvasX / tileSize);
		const gridY = Math.floor(mouse_pos.canvasY / tileSize);
		
		const click_pos = {
			x: camera.x + gridX,
			y: camera.y + gridY
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
						turns.move(player, click_pos.x, click_pos.y);
					}
				}
				break;
				
			case "attack":
				const dist = calc.distance(player.x, click_pos.x, player.y, click_pos.y);
				
				if (dist > player.attack_range) {
					//console.log("Target out of range!");
					return;
				}
				const targetsInArea = getTargetedEntities(player, click_pos.x, click_pos.y);
				const enemies = targetsInArea.filter(e => e !== player && e.hp > 0);
				
				const targetingTiles = calculateEntityTargeting(player, click_pos.x, click_pos.y);
				const hasTargets = targetingTiles.length > 0 && (enemies.length > 0 || 
					targetingTiles.some(t => walls.find(w => w.x === t.x && w.y === t.y)));
				
				if (!hasTargets) return;
			
				if (isPeekMode && peekStep === 2) {
					const hadTargets = enemies.length > 0;
					for (let enemy of enemies) {
						EntitySystem.attack(player, enemy);
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
					for (let enemy of enemies) {
						EntitySystem.attack(player, enemy);
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
		const gridX = Math.floor(mouse_pos.canvasX / tileSize);
		const gridY = Math.floor(mouse_pos.canvasY / tileSize);
		
		const click_pos = {
			x: camera.x + gridX,
			y: camera.y + gridY
		};
		console.log(click_pos);
		
		document.getElementById('spawn_x').value = click_pos.x;
		document.getElementById('spawn_y').value = click_pos.y;
		document.getElementById('player_x').value = click_pos.x;
		document.getElementById('player_y').value = click_pos.y;
		document.getElementById('item_x').value = click_pos.x;
		document.getElementById('item_y').value = click_pos.y;
	},
	
	mousedown: function(event) {
		if (event.button === 0) {
			isMouseDown = true;
			
			if (edit.checked) {
				const rect = c.getBoundingClientRect();
				const canvasX = event.clientX - rect.left;
				const canvasY = event.clientY - rect.top;
				
				const gridX = Math.floor(canvasX / tileSize);
				const gridY = Math.floor(canvasY / tileSize);
				
				const click_pos = {
					x: camera.x + gridX,
					y: camera.y + gridY
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
