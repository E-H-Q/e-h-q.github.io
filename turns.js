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
		
		// During player turn, check enemy LOS to player
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
		// Check if any enemies can see the player
		for (let i = 0; i < allEnemies.length; i++) {
			const enemy = allEnemies[i];
			if (enemy.hp < 1) continue;
			
			// Only check enemies the player can see
			if (!this.playerCanSeeEnemy(enemy)) continue;
			
			const look = {
				start: { x: enemy.x, y: enemy.y },
				end: { x: player.x, y: player.y }
			};
			const check = calc.los(look);
			const dist = calc.distance(enemy.x, player.x, enemy.y, player.y);
			const lengthDiff = Math.abs(check.length - dist);
			
			// Enemy can see player clearly
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
		
		// Move without calling update() to avoid recursion
		if (pts[entity.x + dx] && pts[entity.x + dx][entity.y + dy] !== 0) {
			entity.x += dx;
			entity.y += dy;
		}
		currentEntityTurnsRemaining--;
	},
	
	enemyMoveToward: function(entity, targetX, targetY) {
		calc.move(entity);
		
		if (!graph || !pts) {
			currentEntityTurnsRemaining--;
			return;
		}
		
		// Use A* to find path to target
		const path = astar.search(graph, graph.grid[entity.x][entity.y], graph.grid[targetX][targetY], {
			closest: true
		});
		
		// Move up to entity's range along the path
		const maxSteps = Math.min(entity.range, path.length);
		if (path.length > 0 && maxSteps > 0) {
			const targetStep = path[maxSteps - 1];
			if (pts[targetStep.x] && pts[targetStep.x][targetStep.y] !== 0) {
				entity.x = targetStep.x;
				entity.y = targetStep.y;
			}
			
			// Check if reached last seen position
			if (entity.x === entity.seenX && entity.y === entity.seenY) {
				entity.seenX = 0;
				entity.seenY = 0;
			}
		}
		currentEntityTurnsRemaining--;
	},
	
	move: function(entity, x, y) {	
		if (pts[x] && pts[x][y] !== 0) {
			entity.x = x;
			entity.y = y;
			currentEntityTurnsRemaining--;
			
			// If this was the player's last turn, force end of turn
			if (entity === player && currentEntityTurnsRemaining <= 0) {
				currentEntityIndex++;
				if (currentEntityIndex >= entities.length) {
					currentEntityIndex = 0;
				}
				currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
			}
			
			update();
		}
	},
	
	attack: function(target, entity) {
		const hitRoll = calc.roll(6, 1);
		
		if (hitRoll >= 4) {
			const dmgRoll = calc.roll(6, 1);
			target.hp -= dmgRoll;
			target.seenX = entity.x;// makes entity aware of what attacked them
			target.seenY = entity.y;
			console.log(entity.name + " hits " + target.name + " for " + dmgRoll + "DMG!");
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
