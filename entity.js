// ENTITY.JS: UNIFIED ENTITY SYSTEM FOR ALL CHARACTERS

const EntitySystem = {
	hasLOS: function(entity, targetX, targetY, usePermissive = false) {
		if (usePermissive) return hasPermissiveLOS(entity.x, entity.y, targetX, targetY);
		
		const path = calc.los({start: {x: entity.x, y: entity.y}, end: {x: targetX, y: targetY}});
		const dist = calc.distance(entity.x, targetX, entity.y, targetY);
		
		if (path.length < dist + 1) return false;
		for (let i = 1; i < path.length - 1; i++) {
			if (walls.find(w => w.x === path[i].x && w.y === path[i].y)) return false;
		}
		return true;
	},
	
	calculateMovement: function(entity, specialMode = null) {
		if (specialMode === 'peek') {
			return helper.getAdjacentTiles(entity.x, entity.y, true).filter(tile => !helper.tileBlocked(tile.x, tile.y));
		}
		
		circle(entity.y, entity.x, entity.range);
		convert();
		if (!pts) return [];
		
		const graph = new Graph(pts, {diagonal: true});
		entities.forEach(e => {
			if (e !== entity && e.hp > 0 && pts[e.x]?.[e.y] !== undefined) pts[e.x][e.y] = 0;
		});
		
		const validMoves = [];
		const minX = Math.max(0, entity.x - entity.range - 1);
		const maxX = Math.min(pts.length - 1, entity.x + entity.range + 1);
		const minY = Math.max(0, entity.y - entity.range - 1);
		const maxY = Math.min(pts.length - 1, entity.y + entity.range + 1);
		
		for (let i = minX; i <= maxX; i++) {
			for (let j = minY; j <= maxY; j++) {
				if (pts[i][j] === 1) {
					const res = astar.search(graph, graph.grid[entity.x][entity.y], graph.grid[i][j]);
					if (res.length > 0) {
						// Calculate path cost with "every other diagonal = 2" rule
						let pathCost = 0;
						let consecutiveDiagonals = 0;
						
						for (let k = 0; k < res.length; k++) {
							if (k === 0) {
								// First step
								const isDiagonal = (res[k].x !== entity.x && res[k].y !== entity.y);
								if (isDiagonal) {
									pathCost += 1;
									consecutiveDiagonals = 1;
								} else {
									pathCost += 1;
									consecutiveDiagonals = 0;
								}
							} else {
								const prev = res[k - 1];
								const curr = res[k];
								const isDiagonal = (prev.x !== curr.x && prev.y !== curr.y);
								
								if (isDiagonal) {
									consecutiveDiagonals++;
									// Every other diagonal costs 2
									if (consecutiveDiagonals % 2 === 0) {
										pathCost += 2;
									} else {
										pathCost += 1;
									}
								} else {
									pathCost += 1;
									consecutiveDiagonals = 0;
								}
							}
						}
						
						if (pathCost <= entity.range) validMoves.push({x: i, y: j, path: res});
					}
				}
			}
		}
		return validMoves;
	},
	
	displayMovement: function(entity, specialMode = null) {
		this.calculateMovement(entity, specialMode).forEach(move => {
			const coord = new calc.coordinate(move.x, move.y);
			if (entity === player && !valid.find(item => item.x === coord.x && item.y === coord.y)) valid.push(coord);
			ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
			ctx.fillRect((coord.x - camera.x) * tileSize, (coord.y - camera.y) * tileSize, tileSize, tileSize);
		});
	},
	
	moveEntity: function(entity, x, y) {
		if (pts[x]?.[y] !== 0) {
			entity.x = x;
			entity.y = y;
			if (typeof pickupItem !== 'undefined') pickupItem(entity, x, y);
			return true;
		}
		return false;
	},
	
	canAttack: function(entity, target) {
		const dist = calc.distance(entity.x, target.x, entity.y, target.y);
		if (dist > entity.attack_range) return false;
		return this.hasLOS(entity, target.x, target.y, entity === player);
	},
	
	attack: function(attacker, target) {
		const hitRoll = calc.roll(6);
		
		if (hitRoll >= 4) {
			const baseDmg = calc.roll(6) + (attacker.damage || 0);
			const armor = target.armor || 0;
			const dmgRoll = Math.max(1, baseDmg - armor);
			
			target.hp -= dmgRoll;
			if (target.seenX !== undefined) {
				target.seenX = attacker.x;
				target.seenY = attacker.y;
			}
			
			console.log(attacker.name + " hits " + target.name + " for " + dmgRoll + " DMG!");
			if (target.hp <= 0) this.dropAllItems(target);
			return true;
		}
		console.log(attacker.name + " attacks and misses " + target.name + "...");
		return false;
	},
	
	destroyWalls: function(attacker, targetX, targetY) {
		if (!attacker.equipment?.weapon) return false;
		const weaponDef = itemTypes[attacker.equipment.weapon.itemType];
		const accessoryDef = attacker.equipment?.accessory ? itemTypes[attacker.equipment.accessory.itemType] : null;
		
		const canDestroy = weaponDef?.canDestroy || accessoryDef?.grantsDestroy;
		if (!canDestroy) return false;
		
		let destroyedAny = false;
		const targetingTiles = calculateEntityTargeting(attacker, targetX, targetY);
		targetingTiles.forEach(tile => {
			const wallIndex = walls.findIndex(w => w.x === tile.x && w.y === tile.y);
			if (wallIndex >= 0) {
				// Create fake wall "entity" and use existing attack function
				const wallEntity = {name: "wall", hp: 1, x: tile.x, y: tile.y, armor: 0};
				if (this.attack(attacker, wallEntity)) {
					walls.splice(wallIndex, 1);
					destroyedAny = true;
				}
			}
		});
		return destroyedAny;
	},
	
	dropAllItems: function(entity) {
		if (typeof mapItems === 'undefined' || typeof nextItemId === 'undefined') return;
		
		entity.inventory?.forEach(item => {
			mapItems.push({x: entity.x, y: entity.y, itemType: item.itemType, id: nextItemId++});
			console.log(entity.name + " dropped " + itemTypes[item.itemType].name);
		});
		entity.inventory = [];
		
		if (entity.equipment) {
			for (let slot in entity.equipment) {
				if (entity.equipment[slot]) {
					mapItems.push({x: entity.x, y: entity.y, itemType: entity.equipment[slot].itemType, id: nextItemId++});
					console.log(entity.name + " dropped " + itemTypes[entity.equipment[slot].itemType].name);
				}
			}
			entity.equipment = {};
		}
	},
	
	isAI: function(entity) {
		return entity !== player && entity.seenX !== undefined;
	},
	
	getValidTargets: function(entity) {
		return entities.filter(e => e !== entity && e.hp > 0 && this.canAttack(entity, e));
	}
};

window.EntitySystem = EntitySystem;
