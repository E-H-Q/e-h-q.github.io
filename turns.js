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

		if (currentEntityTurnsRemaining <= 0) {
			currentEntityIndex++;
			if (currentEntityIndex >= entities.length) {
				currentEntityIndex = 0;
			}
			currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
			
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
		
		if (currentEntity !== player && currentEntityTurnsRemaining > 0) {
			calc.move(currentEntity);
			
			const dist = calc.distance(currentEntity.x, player.x, currentEntity.y, player.y);
			if (dist <= currentEntity.attack_range) {
				const lookAtPlayer = {
					start: { x: currentEntity.x, y: currentEntity.y },
					end: { x: player.x, y: player.y }
				};
				const pathToPlayer = calc.los(lookAtPlayer);
				if (pathToPlayer.length > 1) {
					canvas.los(pathToPlayer.slice(1));
				}
			}
			
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

		if (currentEntity === player && action.value === "move") {
			calc.move(player);
		}
		
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
		return hasPermissiveLOS(player.x, player.y, enemy.x, enemy.y);
	},
	
	checkEnemyLOS: function() {
		for (let i = 0; i < allEnemies.length; i++) {
			const enemy = allEnemies[i];
			if (enemy.hp < 1) continue;
			
			// Use strict LOS for vision
			const look = {
				start: { x: enemy.x, y: enemy.y },
				end: { x: player.x, y: player.y }
			};
			const path = calc.los(look);
			const dist = calc.distance(enemy.x, player.x, enemy.y, player.y);
			
			if (Math.abs(path.length - dist) <= 1 && path.length >= dist) {
				enemy.seenX = player.x;
				enemy.seenY = player.y;
			}
		}
	},
	
	hasValidAttackLOS: function(fromX, fromY, toX, toY) {
		// Use the strict LOS calculation that respects walls
		const look = {
			start: { x: fromX, y: fromY },
			end: { x: toX, y: toY }
		};
		const path = calc.los(look);
		const dist = calc.distance(fromX, toX, fromY, toY);
		
		// Path length should be equal to distance + 1 (includes start point)
		// If a wall blocks, path gets truncated
		return path.length > dist;
	},
	
	enemyTurn: function(entity) {
		if (entity.hp < 1) {
			currentEntityTurnsRemaining = 0;
			return;
		}
		
		if (entity.x === entity.seenX && entity.y === entity.seenY) {
			entity.seenX = 0;
			entity.seenY = 0;
		}
		
		const dist = calc.distance(entity.x, player.x, entity.y, player.y);
		
		// Use strict LOS for vision
		const look = {
			start: { x: entity.x, y: entity.y },
			end: { x: player.x, y: player.y }
		};
		const path = calc.los(look);
		const canSeePlayer = (Math.abs(path.length - dist) <= 1 && path.length >= dist);
		
		if (canSeePlayer) {
			entity.seenX = player.x;
			entity.seenY = player.y;
			
			if (dist <= entity.attack_range && this.hasValidAttackLOS(entity.x, entity.y, player.x, player.y)) {
				this.attack(player, entity);
			} else {
				this.enemyMoveToward(entity, player.x, player.y);
			}
		} else if (entity.seenX !== 0 || entity.seenY !== 0) {
			// Move toward last seen position using pathfinding
			this.enemyMoveToward(entity, entity.seenX, entity.seenY);
		} else {
			// Random movement
			this.enemyRandomMove(entity);
		}
	},
	
	enemyRandomMove: function(entity) {
		const moves = [
			[-1, -1], [0, -1], [1, -1],
			[-1, 0], [0, 0], [1, 0],
			[-1, 1], [0, 1], [1, 1]
		];
		const direction = Math.floor(Math.random() * 9);
		const [dx, dy] = moves[direction];
		
		const newX = entity.x + dx;
		const newY = entity.y + dy;
		
		if (newX < 0 || newY < 0 || newX >= size || newY >= size) {
			currentEntityTurnsRemaining--;
			return;
		}
		
		if (pts[newX] && pts[newX][newY] !== 0) {
			entity.x = newX;
			entity.y = newY;
			
			if (typeof pickupItem !== 'undefined') {
				pickupItem(entity, entity.x, entity.y);
			}
		}
		currentEntityTurnsRemaining--;
	},
	
	enemyMove: function(entity) {
		// This function is now just an alias for backwards compatibility
		this.enemyRandomMove(entity);
	},
	
	enemyMoveToward: function(entity, targetX, targetY) {
		if (!pts) {
			currentEntityTurnsRemaining--;
			return;
		}
		
		const diagonalGraph = new Graph(pts, { diagonal: true });
		
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
		
		if (finalX !== entity.x || finalY !== entity.y) {
			entity.x = finalX;
			entity.y = finalY;
			
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
			
			if (typeof pickupItem !== 'undefined') {
				pickupItem(entity, x, y);
			}
			
			currentEntityTurnsRemaining--;
			
			if (entity === player && currentEntityTurnsRemaining <= 0) {
				currentEntityIndex++;
				if (currentEntityIndex >= entities.length) {
					currentEntityIndex = 0;
				}
				currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
			}
			
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
			
			if (entity.damage) {
				dmgRoll += entity.damage;
			}
			
			target.hp -= dmgRoll;
			target.seenX = entity.x;
			target.seenY = entity.y;
			console.log(entity.name + " hits " + target.name + " for " + dmgRoll + "DMG!");
			
			if (target.hp <= 0) {
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
		
		if (entity === player && currentEntityTurnsRemaining <= 0) {
			currentEntityIndex++;
			if (currentEntityIndex >= entities.length) {
				currentEntityIndex = 0;
			}
			currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
		}
	}
};
