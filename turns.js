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
			currentEntityIndex++;
			if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
			currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
			
			const currentEntity = entities[currentEntityIndex];
			
			// Process inventory grenades when turn changes
			if (currentEntity && typeof processInventoryGrenades !== 'undefined') {
   				processInventoryGrenades(currentEntity);
			}
			
			camera = {
				x: currentEntity.x - Math.round(viewportSize / 2) + 1,
				y: currentEntity.y - Math.round(viewportSize / 2) + 1
			};
			
			canvas.init();
			canvas.clear();
			canvas.grid();
			canvas.walls();
			canvas.items();
			canvas.drawGrenades();
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

		if (currentEntity === player && action.value === "move") calc.move(player);
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
			
			if (EntitySystem.hasLOS(enemy, player.x, player.y, false)) {
				enemy.seenX = player.x;
				enemy.seenY = player.y;
			}
		});
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
				
				if (EntitySystem.attack(entity, player.x, player.y)) {
					currentEntityTurnsRemaining--;
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
		if (EntitySystem.moveEntity(entity, x, y)) {
			currentEntityTurnsRemaining--;
			
			if (entity === player && currentEntityTurnsRemaining <= 0) {
				currentEntityIndex++;
				if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
				currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
				
				// Process inventory grenades when player's turn ends
				if (typeof processInventoryGrenades !== 'undefined') {
					processInventoryGrenades(player);
				}
			}
			
			if (entity === player) this.checkEnemyLOS();
			update();
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
