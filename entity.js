// ENTITY.JS: UNIFIED ENTITY SYSTEM FOR ALL CHARACTERS

const EntitySystem = {
	// Queue for pending chain explosions - prevents overlapping setTimeout stacks
	_explosionQueue: [],
	_explosionPending: false,

	hasLOS: function(entity, targetX, targetY, usePermissive = false) {
		if (usePermissive) return hasPermissiveLOS(entity.x, entity.y, targetX, targetY);

		const path = line({x: entity.x, y: entity.y}, {x: targetX, y: targetY});
		const dist = calc.distance(entity.x, targetX, entity.y, targetY);

		if (path.length < dist + 1) return false;
		for (let i = 1; i < path.length - 1; i++) {
			const wall = walls.find(w => w.x === path[i].x && w.y === path[i].y);
			if (wall && wall.type !== 'glass' && wall.type !== 'water' && wall.type !== 'fire') return false;
		}
		return true;
	},

	calculateMovement: function(entity, specialMode = null) {
		if (entity.range === 1) {
			const adjacentTiles = helper.getAdjacentTiles(entity.x, entity.y, true)
				.filter(tile => !helper.tileBlocked(tile.x, tile.y));
			return adjacentTiles.map(tile => ({x: tile.x, y: tile.y, path: [tile]}));
		}

		circle(entity.y, entity.x, entity.range);
		convert();
		if (!pts) return [];

		const graph = new Graph(pts, {diagonal: true});
		entities.forEach(e => {
			if (e !== entity && e.hp > 0 && pts[e.x]?.[e.y] !== undefined) pts[e.x][e.y] = 0;
		});

		if (specialMode === 'peek') {
			entity.range = Math.floor(savedPlayerRange / 2);
		}

		const validMoves = [];
		const minX = Math.max(0, entity.x - entity.range - 1);
		const maxX = Math.min(pts.length - 1, entity.x + entity.range + 1);
		const minY = Math.max(0, entity.y - entity.range - 1);
		const maxY = Math.min(pts.length - 1, entity.y + entity.range + 1);

		for (let i = minX; i <= maxX; i++) {
			for (let j = minY; j <= maxY; j++) {
				if (pts[i][j] > 0) {
					const res = astar.search(graph, graph.grid[entity.x][entity.y], graph.grid[i][j]);
					if (res.length > 0) {
						let pathCost = 0;
						let diagonalCount = 0;
						for (let k = 0; k < res.length; k++) {
							const prev = k === 0 ? {x: entity.x, y: entity.y} : res[k - 1];
							const curr = res[k];
							const isDiagonal = (prev.x !== curr.x && prev.y !== curr.y);
							if (isDiagonal) {
								diagonalCount++;
								pathCost += (diagonalCount % 2 === 0) ? 2 : 1;
							} else {
								pathCost += 1;
							}
							if (pts[curr.x]?.[curr.y] === 2) pathCost += 1; // Water
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
			if (isPlayerControlled(entity) && !valid.find(item => item.x === coord.x && item.y === coord.y)) {
				valid.push(coord);
			}
			ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
			ctx.fillRect((coord.x - camera.x) * tileSize, (coord.y - camera.y) * tileSize, tileSize, tileSize);
		});
	},

	moveEntity: function(entity, x, y) {
		if (isAiming) {
			isAiming = false;
			update();
		}

		if (pts[x]?.[y] !== 0) {
			const path = line({x: entity.x, y: entity.y}, {x: x, y: y});
			for (let i = 0; i < path.length; i++) {
				const step = path[i];
				const fireTile = walls.some(w => w.x === step.x && w.y === step.y && w.type === 'fire');
				const waterTile = walls.some(w => w.x === step.x && w.y === step.y && w.type === 'water');

				if (fireTile && !helper.hasTrait(entity, 'fire')) {
					if (!entity.traits) entity.traits = [];
					entity.traits.push('fire');
					console.log(entity.name + " caught fire!");
					break;
				}
				if (waterTile && helper.hasTrait(entity, 'fire')) {
					entity.traits = entity.traits.filter(t => t !== "fire");
					console.log(entity.name + " got wet!");
					break;
				}
			}

			entity.x = x;
			entity.y = y;
			return true;
		}
		return false;
	},

	canAttack: function(entity, target) {
		const dist = calc.distance(entity.x, target.x, entity.y, target.y);
		if (dist > entity.attack_range) return false;
		return this.hasLOS(entity, target.x, target.y, isPlayerControlled(entity));
	},

	attack: function(attacker, targetX, targetY) {
		if (isAiming) {
			isAiming = false;
			update();
		}

		if (!hasAmmo(attacker)) {
			if (isPlayerControlled(attacker)) {
				console.log("Out of ammo! Press R to reload.");
			}
			return false;
		}

		const weaponDef = attacker.equipment?.weapon ? itemTypes[attacker.equipment.weapon.itemType] : null;
		const aimStyle = getWeaponAimStyle(attacker);
		const targets = getTargetedEntities(attacker, targetX, targetY);
		const enemies = targets.filter(e => e !== attacker && e.hp > 0);

		let attackedAnyone = false;

		const burstCount = weaponDef?.burst || 1;
		for (let burst = 0; burst < burstCount; burst++) {
			if (this.destroyWalls(attacker, targetX, targetY)) {
				attackedAnyone = true;
			}

			for (let enemy of enemies) {
				if (enemy.hp > 0) {
					const hitRoll = calc.roll(6);
					if (hitRoll >= 4) {
						const baseDmg = calc.roll(6) + (attacker.damage || 0);
						const armor = enemy.armor || 0;
						const dmgRoll = Math.max(1, baseDmg - armor);
						const previousHp = enemy.hp;
						enemy.hp -= dmgRoll;

						if (enemy.hp < previousHp && enemy.lastAttacker !== undefined) {
							enemy.lastAttacker = attacker;
						}
						if (enemy.seenX !== undefined) {
							enemy.seenX = attacker.x;
							enemy.seenY = attacker.y;
						}

						console.log(attacker.name + " hits " + enemy.name + " for " + dmgRoll + " DMG!");

						if (enemy.hp <= 0) {
							this.death(enemy);
						}
					} else {
						console.log(attacker.name + " attacks and misses " + enemy.name + "...");
					}
					attackedAnyone = true;
				}
			}
		}

		if (attackedAnyone) {
			consumeAmmo(attacker);

			if (canEntityImmolate(attacker)) {
				const tilesToIgnite = calculateEntityTargeting(attacker, targetX, targetY);
				for (let tile of tilesToIgnite) {
					if (calc.roll(2) === 1) {
						const existingWall = walls.find(w => w.x === tile.x && w.y === tile.y);
						const hasEntity = entities.find(e => e.hp > 0 && e.x === tile.x && e.y === tile.y);
						if (!existingWall || existingWall.type === 'fire') {
							walls.push({x: tile.x, y: tile.y, type: 'fire'});
						}
						if (hasEntity && !helper.hasTrait(hasEntity, 'fire')) {
							if (!hasEntity.traits) hasEntity.traits = [];
							hasEntity.traits.push("fire");
						}
					}
				}
			}

			return true;
		}
		return false;
	},

	destroyWalls: function(attacker, targetX, targetY) {
		const weaponDef = attacker.equipment?.weapon ? itemTypes[attacker.equipment.weapon.itemType] : null;
		const accessoryDef = attacker.equipment?.accessory ? itemTypes[attacker.equipment.accessory.itemType] : null;
		const canDestroy = weaponDef?.canDestroy || accessoryDef?.grantsDestroy;

		const targetingTiles = calculateEntityTargeting(attacker, targetX, targetY);
		let destroyedAny = false;

		targetingTiles.forEach(tile => {
			const wallIndex = walls.findIndex(w => w.x === tile.x && w.y === tile.y);
			if (wallIndex >= 0) {
				const wall = walls[wallIndex];
				if (wall.type === 'glass') {
					if (canDestroy || wall.damaged) {
						walls.splice(wallIndex, 1);
						console.log(attacker.name + " destroyed glass!");
						destroyedAny = true;
					} else {
						wall.damaged = true;
						destroyedAny = true;
					}
				} else if (canDestroy) {
					walls.splice(wallIndex, 1);
					console.log(attacker.name + " destroyed a wall!");
					destroyedAny = true;
				}
			}
		});

		return destroyedAny;
	},

	dropAllItems: function(entity) {
		if (typeof mapItems === 'undefined' || typeof nextItemId === 'undefined') return;

		entity.inventory?.forEach(item => {
			const itemDef = itemTypes[item.itemType];
			if (itemDef.type === "consumable" && item.quantity && item.quantity > 1) {
				for (let i = 0; i < item.quantity; i++) {
					mapItems.push({x: entity.x, y: entity.y, itemType: item.itemType, id: nextItemId++});
				}
				console.log(entity.name + " dropped " + item.quantity + " " + itemDef.name + (item.quantity > 1 ? "s" : ""));
			} else {
				mapItems.push({x: entity.x, y: entity.y, itemType: item.itemType, id: nextItemId++});
				console.log(entity.name + " dropped " + itemDef.name);
			}
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

	// Unified death handler - queues explosion entities for batch processing
	death: function(entity) {
		if (entity.hp > 0) return;

		if (helper.hasTrait(entity, 'explode')) {
			this._explosionQueue.push(entity);
			if (!this._explosionPending) {
				this._processBatchExplosions();
			}
			if (entity.name !== "Grenade") return;
		}

		this.dropAllItems(entity);
	},

	// Drain the entire queue synchronously (chains included), then do ONE setTimeout for the flash
	_processBatchExplosions: function() {
		if (this._explosionPending || this._explosionQueue.length === 0) return;
		this._explosionPending = true;

		const exploded = [];
		while (this._explosionQueue.length > 0) {
			const grenade = this._explosionQueue.shift();
			exploded.push(grenade);
			this._resolveExplosion(grenade); // sync: may push more onto _explosionQueue via death()
		}

		const delay = parseInt(document.getElementById("turn-delay").value) || 0;
		setTimeout(() => {
			exploded.forEach(g => canvas.grenadeAreas(g));
			setTimeout(() => {
				this._explosionPending = false;
				if (currentEntityTurnsRemaining <= 0) {
					currentEntityIndex++;
					if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
					currentEntityTurnsRemaining = entities[currentEntityIndex]?.turns || 1;
				}
				update();
			}, delay);
		}, 0);
	},

	// Pure sync: damage, walls, immolate. Chain deaths re-queue; the while loop above picks them up.
	_resolveExplosion: function(grenade) {
		const itemDef = itemTypes.grenade;
		const explodeX = grenade.x;
		const explodeY = grenade.y;

		console.log(grenade.name + " explodes at " + explodeX + ", " + explodeY + "!");

		if (itemDef.canDestroy) {
			for (let tx = Math.max(0, explodeX - itemDef.damageRadius); tx <= Math.min(size - 1, explodeX + itemDef.damageRadius); tx++) {
				for (let ty = Math.max(0, explodeY - itemDef.damageRadius); ty <= Math.min(size - 1, explodeY + itemDef.damageRadius); ty++) {
					if (Math.sqrt((tx - explodeX) ** 2 + (ty - explodeY) ** 2) <= itemDef.damageRadius) {
						for (let i = walls.length - 1; i >= 0; i--) {
							if (walls[i].x === tx && walls[i].y === ty && walls[i].type !== 'water' && walls[i].type !== 'fire') {
								walls.splice(i, 1);
								break;
							}
						}
					}
				}
			}
		}

		circle(explodeY, explodeX, itemDef.damageRadius);
		convert();

		const explosionTiles = [];
		for (let tx = Math.max(0, explodeX - itemDef.damageRadius - 1); tx <= Math.min(size - 1, explodeX + itemDef.damageRadius + 1); tx++) {
			for (let ty = Math.max(0, explodeY - itemDef.damageRadius - 1); ty <= Math.min(size - 1, explodeY + itemDef.damageRadius + 1); ty++) {
				if (pts[tx] && pts[tx][ty] === 1) explosionTiles.push({x: tx, y: ty});
			}
		}

		const entitiesToDamage = [];
		for (let tile of explosionTiles) {
			for (let entity of entities) {
				if (entity.x === tile.x && entity.y === tile.y && entity.hp > 0 && entity !== grenade) {
					if (!entitiesToDamage.includes(entity)) entitiesToDamage.push(entity);
				}
			}
		}

		for (let entity of entitiesToDamage) {
			const dmg = Math.max(1, itemDef.damage - (entity.armor || 0));
			console.log(entity.name + " takes " + dmg + " explosion damage!");
			entity.hp -= dmg;
			if (entity.hp <= 0) this.death(entity);
		}

		if (helper.hasTrait(grenade, 'immolate')) {
			for (let tile of explosionTiles) {
				if (calc.roll(3) === 1) {
					const existingWall = walls.find(w => w.x === tile.x && w.y === tile.y);
					if (!existingWall) {
						walls.push({x: tile.x, y: tile.y, type: 'fire'});
					} else if (existingWall.type !== 'fire') {
						walls.splice(walls.indexOf(existingWall), 1);
						walls.push({x: tile.x, y: tile.y, type: 'fire'});
					}
				}
			}
		}
	},

	// Public entry point for external callers (turns.js grenade countdown)
	triggerExplosion: function(grenade) {
		this._explosionQueue.push(grenade);
		this._processBatchExplosions();
	},

	isAI: function(entity) {
		return !isPlayerControlled(entity) && entity.seenX !== undefined;
	},

	getValidTargets: function(entity) {
		return entities.filter(e => e !== entity && e.hp > 0 && this.canAttack(entity, e));
	}
};

window.EntitySystem = EntitySystem;