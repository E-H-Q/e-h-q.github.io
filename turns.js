// TURNS.JS: HANDLES TURN ORDER AND TURN ACTIONS

var currentEntityIndex = -1;
var currentEntityTurnsRemaining = 0;

var turns = {
	check: function() {
		if (player.hp < 1) {
			const music = new Audio('sound.wav');
			music.play();
			music.loop = false;
			music.playbackRate = 1.5;
			console.log("YOU DIED\n");
			return;
		}

		if (currentEntityTurnsRemaining <= 0) {
			const previousEntity = entities[currentEntityIndex];
			
			// Save cursor viewport position when player's turn ends
			if (previousEntity === player && window.cursorWorldPos) {
				window.savedPlayerCursorViewportX = window.cursorWorldPos.x - camera.x;
				window.savedPlayerCursorViewportY = window.cursorWorldPos.y - camera.y;
			}
			
			// OPTIMIZATION: Batch skip all out-of-viewport enemies
			const viewportMargin = 5;
			const minX = camera.x - viewportMargin;
			const maxX = camera.x + viewportSize + viewportMargin;
			const minY = camera.y - viewportMargin;
			const maxY = camera.y + viewportSize + viewportMargin;
			
			// Skip ahead to next entity that needs processing
			const startIndex = currentEntityIndex;
			let skipped = 0;
			while (true) {
				currentEntityIndex++;
				if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
				
				// Prevent infinite loop - if we've checked all entities, break
				skipped++;
				if (skipped > entities.length) {
					break;
				}
				
				const nextEntity = entities[currentEntityIndex];
				currentEntityTurnsRemaining = nextEntity.turns;
				
				// If it's the player or a grenade, process them
				if (nextEntity === player || nextEntity.isGrenade) {
					break;
				}
				
				// If enemy has seen the player (seenX/seenY is set), they need to take their turn
				const hasSeenPlayer = (nextEntity.seenX !== 0 || nextEntity.seenY !== 0);
				if (hasSeenPlayer) {
					break;
				}
				
				const inExtendedViewport = nextEntity.x >= minX && nextEntity.x <= maxX && 
				                           nextEntity.y >= minY && nextEntity.y <= maxY;
				
				if (inExtendedViewport) {
					break;
				}
				
				// Out of viewport and hasn't seen player - continue skipping
			}
			
			const currentEntity = entities[currentEntityIndex];
			
			// Process inventory grenades when turn changes (only for the entity whose turn just ended)
			if (previousEntity && typeof processInventoryGrenades !== 'undefined') {
   				processInventoryGrenades(previousEntity);
			}
			
			// Update enemy LOS states when transitioning to player turn
			if (currentEntity === player) {
				this.checkEnemyLOS();
			}
			
			camera = {
				x: currentEntity.x - Math.round(viewportSize / 2) + 1,
				y: currentEntity.y - Math.round(viewportSize / 2) + 1
			};
			
			// Restore cursor to same viewport position when player's turn begins
			if (currentEntity === player && window.savedPlayerCursorViewportX !== undefined) {
				window.cursorWorldPos = {
					x: camera.x + window.savedPlayerCursorViewportX,
					y: camera.y + window.savedPlayerCursorViewportY
				};
				// Clamp to world bounds
				window.cursorWorldPos.x = Math.max(0, Math.min(size - 1, window.cursorWorldPos.x));
				window.cursorWorldPos.y = Math.max(0, Math.min(size - 1, window.cursorWorldPos.y));
			}
			
			canvas.init();
			canvas.clear();
			canvas.grid();
			canvas.items();
			canvas.walls();
			//canvas.drawGrenades();
			canvas.player();
			canvas.enemy();
		}

		const currentEntity = entities[currentEntityIndex];
		
		// Grenade turn logic
		if (currentEntity.isGrenade && currentEntityTurnsRemaining > 0) {
			currentEntity.turnsRemaining--;
			console.log("Grenade countdown: " + currentEntity.turnsRemaining);
			
			if (currentEntity.turnsRemaining <= 0) {
				detonateGrenade(currentEntity);
			}
			
			currentEntityTurnsRemaining--;
			update();
			return;
		}
		
		if (currentEntity !== player && !currentEntity.isGrenade && currentEntityTurnsRemaining > 0) {
			const dist = calc.distance(currentEntity.x, player.x, currentEntity.y, player.y);
			const effectiveRange = getEntityAttackRange(currentEntity);
			const canSeePlayer = EntitySystem.hasLOS(currentEntity, player.x, player.y, false);
			const willAttack = canSeePlayer && dist <= effectiveRange;
			
			if (!willAttack) {
				calc.move(currentEntity);
			} else {
				const targetingTiles = calculateEntityTargeting(currentEntity, player.x, player.y);
				canvas.los(targetingTiles);
			}
			
			const enemyHasSeenPlayer = (currentEntity.seenX !== 0 || currentEntity.seenY !== 0);
			const enemyInViewport = this.isInViewport(currentEntity);
			const timeout = 250;
			
			if (enemyHasSeenPlayer && enemyInViewport) {
				setTimeout(() => {
					this.enemyTurn(currentEntity, canSeePlayer, dist, effectiveRange);
					update();
				}, timeout);
			} else {
				this.enemyTurn(currentEntity, canSeePlayer, dist, effectiveRange);
				update();
			}
			return;
		}

		if (currentEntity === player && action.value === "move") {
			calc.move(player);
			
			// Draw path to cursor if valid
			if (window.cursorWorldPos) {
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
		}
		if (currentEntity === player && action.value === "attack") {	
			const targetingTiles = calculateEntityTargeting(player, window.cursorWorldPos.x, window.cursorWorldPos.y);
			if (targetingTiles.length > 0) canvas.los(targetingTiles);
		}
		if (currentEntity === player) this.checkEnemyLOS();
	},
	
	isInViewport: function(entity) {
		return entity.x >= camera.x && entity.x <= camera.x + viewportSize - 1 && 
		       entity.y >= camera.y && entity.y <= camera.y + viewportSize - 1;
	},
	
	playerCanSeeEnemy: function(enemy) {
		return EntitySystem.hasLOS(player, enemy.x, enemy.y, true);
	},
	
	checkEnemyLOS: function() {
		allEnemies.forEach(enemy => {
			if (enemy.hp < 1) return;
			
			// Check if enemy can see player
			if (EntitySystem.hasLOS(enemy, player.x, player.y, false)) {
				// Enemy can see player - update last seen position
				enemy.seenX = player.x;
				enemy.seenY = player.y;
			} else {
				// Enemy cannot see player
				// If enemy hasn't seen player before (seenX/Y are 0), keep them at 0
				// If enemy has seen player before, keep the last known position (don't clear it here)
				// The position will be cleared in enemyTurn() when they reach it
			}
		});
	},
	
	hasStrictLOS: function(x1, y1, x2, y2) {
		const path = line({x: x1, y: y1}, {x: x2, y: y2});
		
		for (let i = 1; i < path.length - 1; i++) {
			const wall = walls.find(w => w.x === path[i].x && w.y === path[i].y);
			if (wall && wall.type !== 'glass') {
				return false;
			}
		}
		return true;
	},
	
	enemyTurn: function(entity, canSeePlayer, dist, effectiveRange) {
		if (entity.hp < 1) {
			currentEntityTurnsRemaining = 0;
			return;
		}

		if (canSeePlayer === undefined) {
			dist = calc.distance(entity.x, player.x, entity.y, player.y);
			canSeePlayer = EntitySystem.hasLOS(entity, player.x, player.y, false);
			effectiveRange = getEntityAttackRange(entity);
		}
		
		if (canSeePlayer) {
			entity.seenX = player.x;
			entity.seenY = player.y;
			
			if (dist <= effectiveRange) {
				if (!hasAmmo(entity)) {
					if (reloadWeapon(entity)) {
						currentEntityTurnsRemaining--;
					}
					return;
				}
				
				// CRITICAL FIX: Store whether walls were destroyed
				const wallCountBefore = walls.length;
				
				if (EntitySystem.attack(entity, player.x, player.y)) {
					currentEntityTurnsRemaining--;
					
					// If walls were destroyed, recalculate LOS and distance
					if (walls.length < wallCountBefore) {
						dist = calc.distance(entity.x, player.x, entity.y, player.y);
						canSeePlayer = EntitySystem.hasLOS(entity, player.x, player.y, false);
						effectiveRange = getEntityAttackRange(entity);
						
						// If enemy can still see player but is now out of range, move toward them
						if (canSeePlayer && dist > effectiveRange && currentEntityTurnsRemaining > 0) {
							this.enemyMoveToward(entity, player.x, player.y);
						}
					}
				}
			} else {
				this.enemyMoveToward(entity, player.x, player.y);
			}
		} else if (entity.seenX !== 0 || entity.seenY !== 0) {
			if (entity.x === entity.seenX && entity.y === entity.seenY) {
				entity.seenX = 0;
				entity.seenY = 0;
				this.enemyRandomMove(entity);
			} else {
				this.enemyMoveToward(entity, entity.seenX, entity.seenY);
			}
		} else {
			this.enemyRandomMove(entity);
		}
	},
	
	enemyRandomMove: function(entity) {
		const moves = [[-1,-1],[0,-1],[1,-1],[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1]];
		
		for (let i = moves.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[moves[i], moves[j]] = [moves[j], moves[i]];
		}
		
		for (let [dx, dy] of moves) {
			const newX = entity.x + dx;
			const newY = entity.y + dy;
			
			if (newX < 0 || newY < 0 || newX >= size || newY >= size) continue;
			
			const isWall = walls.some(w => w.x === newX && w.y === newY);
			const isOccupied = entities.some(e => e !== entity && e.hp > 0 && e.x === newX && e.y === newY);
			
			if (!isWall && !isOccupied) {
				entity.x = newX;
				entity.y = newY;
				if (typeof pickupItem !== 'undefined') pickupItem(entity, entity.x, entity.y);
				break;
			}
		}
		
		currentEntityTurnsRemaining--;
	},
	
	enemyMove: function(entity) {
		this.enemyRandomMove(entity);
	},
	
	enemyMoveToward: function(entity, targetX, targetY) {
		// CRITICAL FIX: Always rebuild pathfinding grid with current wall state
		populate.reset();
		
		// Mark walls as impassable
		walls.forEach(wall => {
			if (pts[wall.x]?.[wall.y] !== undefined) {
				pts[wall.x][wall.y] = 0;
			}
		});
		
		if (!pts) {
			currentEntityTurnsRemaining--;
			return;
		}
		
		if (targetX < 0 || targetX >= size || targetY < 0 || targetY >= size) {
			entity.seenX = 0;
			entity.seenY = 0;
			currentEntityTurnsRemaining--;
			return;
		}
		
		const diagonalGraph = new Graph(pts, { diagonal: true });
		
		// Mark other entities as impassable (except target position)
		entities.forEach(e => {
			if (e !== entity && e.hp > 0 && !(e.x === targetX && e.y === targetY)) {
				if (diagonalGraph.grid[e.x]?.[e.y]) {
					diagonalGraph.grid[e.x][e.y].weight = 0;
				}
			}
		});
		
		if (!diagonalGraph.grid[entity.x]?.[entity.y] || !diagonalGraph.grid[targetX]?.[targetY]) {
			entity.seenX = 0;
			entity.seenY = 0;
			currentEntityTurnsRemaining--;
			return;
		}
		
		const path = astar.search(
			diagonalGraph, 
			diagonalGraph.grid[entity.x][entity.y], 
			diagonalGraph.grid[targetX][targetY], 
			{ closest: true, heuristic: astar.heuristics.diagonal }
		);
		
		if (!path || path.length === 0) {
			entity.seenX = 0;
			entity.seenY = 0;
			this.enemyRandomMove(entity);
			return;
		}
		
		let distanceMoved = 0;
		let finalX = entity.x;
		let finalY = entity.y;
		
		for (let step of path) {
			const isDiagonal = (step.x !== finalX && step.y !== finalY);
			const stepCost = isDiagonal ? 1 : 1;
			
			if (distanceMoved + stepCost <= entity.range) {
				const occupied = entities.some(e => 
					e !== entity && e.hp > 0 && e.x === step.x && e.y === step.y
				);
				
				const isWall = walls.some(w => w.x === step.x && w.y === step.y);
				
				if (!occupied && !isWall) {
					finalX = step.x;
					finalY = step.y;
					distanceMoved += stepCost;
				} else break;
			} else break;
		}
		
		if (finalX !== entity.x || finalY !== entity.y) {
			entity.x = finalX;
			entity.y = finalY;
			if (typeof pickupItem !== 'undefined') pickupItem(entity, entity.x, entity.y);
		}
		
		currentEntityTurnsRemaining--;
	},
	
	move: function(entity, x, y) {
		const wasKeyboardMode = keyboardMode;
		let screenOffsetX, screenOffsetY;
		
		if (wasKeyboardMode && window.cursorWorldPos) {
			screenOffsetX = window.cursorWorldPos.x - camera.x;
			screenOffsetY = window.cursorWorldPos.y - camera.y;
		}
		
		if (EntitySystem.moveEntity(entity, x, y)) {
			currentEntityTurnsRemaining--;
			
			if (entity === player) this.checkEnemyLOS();
			
			// Store keyboard mode state BEFORE calling update()
			const needsKeyboardRedraw = wasKeyboardMode && window.cursorWorldPos;
			
			update();
			
			// After update(), if in keyboard mode, redraw with correct cursor position
			if (needsKeyboardRedraw) {
				window.cursorWorldPos.x = camera.x + screenOffsetX;
				window.cursorWorldPos.y = camera.y + screenOffsetY;
				window.cursorWorldPos.x = Math.max(0, Math.min(size - 1, window.cursorWorldPos.x));
				window.cursorWorldPos.y = Math.max(0, Math.min(size - 1, window.cursorWorldPos.y));
				
				// Redraw canvas to show updated cursor position
				canvas.clear();
				canvas.grid();
				canvas.walls();
				canvas.items();
				canvas.drawOnionskin();
				canvas.player();
				canvas.enemy();
				canvas.drawGrenades();
				
				// Show valid moves if it's still the player's turn
				if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player && action.value === "move") {
					calc.move(player);
				}
				
				// Show targeting if in attack mode
				if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player && action.value === "attack") {
					const targetingTiles = calculateEntityTargeting(player, window.cursorWorldPos.x, window.cursorWorldPos.y);
					if (targetingTiles.length > 0) canvas.los(targetingTiles);
				}
				
				// Draw cursor AFTER movement/targeting overlays
				canvas.cursor();
			}
		}

		if (currentEntityIndex < 0 || entities[currentEntityIndex] !== player) return;
		
		if (!keyboardMode && mouse_pos.clientX && mouse_pos.clientY) {
			const evt = new MouseEvent('mousemove', {
				clientX: mouse_pos.clientX,
				clientY: mouse_pos.clientY
			});
			input.mouse(evt);
		}
	},
	
	attack: function(target, entity) {
		EntitySystem.attack(entity, target);
		
		currentEntityTurnsRemaining--;
		
		if (entity === player && currentEntityTurnsRemaining <= 0) {
			currentEntityIndex++;
			if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
			currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
		}
	}
};
