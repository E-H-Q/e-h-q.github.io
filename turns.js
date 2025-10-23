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
			c.style = "pointer-events: none;";
			console.log("YOU DIED\n");
			return;
		}

		// Initialize turn system
		if (currentEntityTurnsRemaining <= 0) {
			currentEntityIndex++;
			if (currentEntityIndex >= entities.length) {
				currentEntityIndex = 0;
			}
			currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
			
			// Update camera to center on new current entity
			const currentEntity = entities[currentEntityIndex];
			camera = {
				x: currentEntity.x - Math.round((viewportSize / 2)) + 1,
				y: currentEntity.y - Math.round((viewportSize / 2)) + 1
			};
			canvas.init();
			canvas.clear();
			canvas.grid();
			canvas.walls();
			canvas.items();
			canvas.player();
			canvas.enemy();
		}

		const currentEntity = entities[currentEntityIndex];
		
		// Handle AI turns with delay
		if (currentEntity !== player && currentEntityTurnsRemaining > 0) {
			// Show enemy movement range
			calc.move(currentEntity);
			
			// Only show LOS if player is within attack range
			const dist = calc.distance(currentEntity.x, player.x, currentEntity.y, player.y);
			if (dist <= currentEntity.attack_range) {
				const lookAtPlayer = {
					start: { x: currentEntity.x, y: currentEntity.y },
					end: { x: player.x, y: player.y }
				};
				const pathToPlayer = calc.los(lookAtPlayer);
				if (pathToPlayer.length > 1) {
					canvas.los(pathToPlayer.slice(1)); // Don't draw over enemy
				}
			}
			
			// Delay if enemy has seen player and is within viewport
			const enemyHasSeenPlayer = (currentEntity.seenX !== 0 || currentEntity.seenY !== 0);
			const enemyInViewport = this.isInViewport(currentEntity);
			
			if (enemyHasSeenPlayer && enemyInViewport) {
				setTimeout(() => {
					this.enemyTurn(currentEntity);
					update();
				}, 250);
			} else {
				this.enemyTurn(currentEntity);
				update();
			}
			return;
		}

		// Show valid moves for player
		if (currentEntity === player && action.value === "move") {
			calc.move(player);
		}
		
		// Always check enemy LOS during player turn
		if (currentEntity === player) {
			this.checkEnemyLOS();
		}
	},
	
	isInViewport: function(entity) {
		const minX = camera.x;
		const maxX = camera.x + viewportSize - 1;
		const minY = camera.y;
		const maxY = camera.y + viewportSize - 1;
		
		return entity.x >= minX && entity.x <= maxX && entity.y >= minY && entity.y <= maxY;
	},
	
	playerCanSeeEnemy: function(enemy) {
		const dist = calc.distance(player.x, enemy.x, player.y, enemy.y);
		const look = {
			start: { x: player.x, y: player.y },
			end: { x: enemy.x, y: enemy.y }
		};
		const check = calc.los(look);
		const lengthDiff = Math.abs(check.length - dist);
		
		return (lengthDiff <= 1 && check.length >= dist);
	},
	
	checkEnemyLOS: function() {
		// Check if any enemies can see the player and update their memory
		for (let i = 0; i < allEnemies.length; i++) {
			const enemy = allEnemies[i];
			if (enemy.hp < 1) continue;
			
			const look = {
				start: { x: enemy.x, y: enemy.y },
				end: { x: player.x, y: player.y }
			};
			const check = calc.los(look);
			const dist = calc.distance(enemy.x, player.x, enemy.y, player.y);
			const lengthDiff = Math.abs(check.length - dist);
			
			// Only UPDATE seenX/seenY if enemy can currently see player
			// Don't clear it if they can't see player
			if (lengthDiff <= 1 && check.length >= dist) {
				enemy.seenX = player.x;
				enemy.seenY = player.y;
			}
		}
	},
	
	enemyTurn: function(entity) {
		if (entity.hp < 1) {
			currentEntityTurnsRemaining = 0;
			return;
		}
		
		// Check if reached last seen position - clear memory
		if (entity.x === entity.seenX && entity.y === entity.seenY) {
			entity.seenX = 0;
			entity.seenY = 0;
		}
		
		const look = {
			start: { x: entity.x, y: entity.y },
			end: { x: player.x, y: player.y }
		};
		const check = calc.los(look);
		const dist = calc.distance(entity.x, player.x, entity.y, player.y);
		
		if (!check || check.length === 0) {
			this.enemyMove(entity);
			return;
		}
		
		// Check if LOS is blocked
		if (check.length < dist) {
			this.enemyMove(entity);
			return;
		}
		
		const lengthDiff = Math.abs(check.length - dist);
		if (lengthDiff <= 1) {
			// Can see player clearly
			entity.seenX = player.x;
			entity.seenY = player.y;
			
			// Check if in attack range
			if (dist <= entity.attack_range) {
				this.attack(player, entity);
			} else {
				// Out of range, move closer using pathfinding
				this.enemyMoveToward(entity, player.x, player.y);
			}
		} else {
			this.enemyMove(entity);
		}
	},
	
	enemyMove: function(entity) {
		calc.move(entity);
		
		let dx = 0, dy = 0;
		
		// If enemy has seen the player, move toward last seen position
		if (entity.seenX !== 0 || entity.seenY !== 0) {
			// Use pathfinding to move toward last seen position
			this.enemyMoveToward(entity, entity.seenX, entity.seenY);
			return;
		} else {
			// Random movement if haven't seen player
			const moves = [
				[-1, -1], [0, -1], [1, -1],
				[-1, 0], [0, 0], [1, 0],
				[-1, 1], [0, 1], [1, 1]
			];
			const direction = Math.floor(Math.random() * 9);
			[dx, dy] = moves[direction];
		}
		
		// Check for negative coordinates and out of bounds
		const newX = entity.x + dx;
		const newY = entity.y + dy;
		
		if (newX < 0 || newY < 0 || newX >= size || newY >= size) {
			currentEntityTurnsRemaining--;
			return;
		}
		
		// Move without calling update() to avoid recursion
		if (pts[newX] && pts[newX][newY] !== 0) {
			entity.x = newX;
			entity.y = newY;
			
			// Check for item pickup
			if (typeof pickupItem !== 'undefined') {
				pickupItem(entity, entity.x, entity.y);
			}
		}
		currentEntityTurnsRemaining--;
	},
	
	enemyMoveToward: function(entity, targetX, targetY) {
		if (!pts) {
			currentEntityTurnsRemaining--;
			return;
		}
		
		// Create a diagonal graph for pathfinding
		const diagonalGraph = new Graph(pts, { diagonal: true });
		
		// Block tiles occupied by other entities
		for (let i = 0; i < entities.length; i++) {
			if (entities[i] !== entity && entities[i].hp > 0) {
				if (diagonalGraph.grid[entities[i].x] && diagonalGraph.grid[entities[i].x][entities[i].y]) {
					diagonalGraph.grid[entities[i].x][entities[i].y].weight = 0;
				}
			}
		}
		
		const path = astar.search(
			diagonalGraph, 
			diagonalGraph.grid[entity.x][entity.y], 
			diagonalGraph.grid[targetX][targetY], 
			{
				closest: true,
				heuristic: astar.heuristics.diagonal
			}
		);
		
		// Calculate how far we can move along the path
		let distanceMoved = 0;
		let finalX = entity.x;
		let finalY = entity.y;
		
		for (let i = 0; i < path.length; i++) {
			const step = path[i];
			const isDiagonal = (step.x !== finalX && step.y !== finalY);
			const stepCost = isDiagonal ? 1.5 : 1;
			
			if (distanceMoved + stepCost <= entity.range) {
				finalX = step.x;
				finalY = step.y;
				distanceMoved += stepCost;
			} else {
				break;
			}
		}
		
		// Move to the farthest valid position
		if (finalX !== entity.x || finalY !== entity.y) {
			entity.x = finalX;
			entity.y = finalY;
			
			// Check for item pickup
			if (typeof pickupItem !== 'undefined') {
				pickupItem(entity, entity.x, entity.y);
			}
		}
		
		currentEntityTurnsRemaining--;
	},
	
	move: function(entity, x, y) {	
		if (pts[x] && pts[x][y] !== 0) {
			entity.x = x;
			entity.y = y;
			
			// Check for item pickup
			if (typeof pickupItem !== 'undefined') {
				pickupItem(entity, x, y);
			}
			
			currentEntityTurnsRemaining--;
			
			// If this was the player's last turn, force end of turn
			if (entity === player && currentEntityTurnsRemaining <= 0) {
				currentEntityIndex++;
				if (currentEntityIndex >= entities.length) {
					currentEntityIndex = 0;
				}
				currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
			}
			
			// Check enemy LOS after player moves
			if (entity === player) {
				this.checkEnemyLOS();
			}
			
			update();
		}
	},
	
	attack: function(target, entity) {
		const hitRoll = calc.roll(6, 1);
		
		if (hitRoll >= 4) {
			let dmgRoll = calc.roll(6, 1);
			
			// Check for weapon damage bonus
			if (entity.damage) {
				dmgRoll += entity.damage;
			}
			
			target.hp -= dmgRoll;
			target.seenX = entity.x;// makes entity aware of what attacked them
			target.seenY = entity.y;
			console.log(entity.name + " hits " + target.name + " for " + dmgRoll + "DMG!");
			
			// Drop items and equipment on death
			if (target.hp <= 0) {
				// Drop inventory items
				if (target.inventory && target.inventory.length > 0) {
					for (let i = 0; i < target.inventory.length; i++) {
						if (typeof mapItems !== 'undefined' && typeof nextItemId !== 'undefined') {
							const droppedItem = {
								x: target.x,
								y: target.y,
								itemType: target.inventory[i].itemType,
								id: nextItemId++
							};
							mapItems.push(droppedItem);
							console.log(target.name + " dropped " + itemTypes[target.inventory[i].itemType].name);
						}
					}
					target.inventory = [];
				}
				
				// Drop equipped items
				if (target.equipment) {
					for (let slot in target.equipment) {
						if (target.equipment[slot]) {
							if (typeof mapItems !== 'undefined' && typeof nextItemId !== 'undefined') {
								const droppedItem = {
									x: target.x,
									y: target.y,
									itemType: target.equipment[slot].itemType,
									id: nextItemId++
								};
								mapItems.push(droppedItem);
								console.log(target.name + " dropped " + itemTypes[target.equipment[slot].itemType].name);
							}
						}
					}
					target.equipment = {};
				}
			}
		} else {
			console.log(entity.name + " attacks and misses " + target.name + "...");
		}
		currentEntityTurnsRemaining--;
		
		// If this was the player's last turn, force end of turn
		if (entity === player && currentEntityTurnsRemaining <= 0) {
			currentEntityIndex++;
			if (currentEntityIndex >= entities.length) {
				currentEntityIndex = 0;
			}
			currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
		}
	}
};
