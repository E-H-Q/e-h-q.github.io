// ENTITY.JS: UNIFIED ENTITY SYSTEM FOR ALL CHARACTERS

const EntitySystem = {
	_explosionQueue: [],
	_explosionPending: false,

	hasLOS: function(entity, targetX, targetY, usePermissive = false) {
		if (usePermissive) return hasPermissiveLOS(entity.x, entity.y, targetX, targetY);
		const path = line({x: entity.x, y: entity.y}, {x: targetX, y: targetY});
		if (path.length < calc.distance(entity.x, targetX, entity.y, targetY) + 1) return false;
		for (let i = 1; i < path.length - 1; i++) {
			const wall = walls.find(w => w.x === path[i].x && w.y === path[i].y);
			if (wall && wall.type !== 'glass' && wall.type !== 'water' && wall.type !== 'fire') return false;
		}
		return true;
	},

	calculateMovement: function(entity, specialMode = null) {
		if (entity.range === 1) {
			return helper.getAdjacentTiles(entity.x, entity.y, true)
				.filter(tile => !helper.tileBlocked(tile.x, tile.y))
				.map(tile => ({x: tile.x, y: tile.y, path: [tile]}));
		}

		circle(entity.y, entity.x, entity.range);
		convert();
		if (!pts) return [];

		const graph = new Graph(pts, {diagonal: true});
		entities.forEach(e => {
			if (e !== entity && e.hp > 0 && pts[e.x]?.[e.y] !== undefined) pts[e.x][e.y] = 0;
		});

		if (specialMode === 'peek') entity.range = Math.floor(savedPlayerRange / 2);

		const validMoves = [];
		const minX = Math.max(0, entity.x - entity.range - 1);
		const maxX = Math.min(pts.length - 1, entity.x + entity.range + 1);
		const minY = Math.max(0, entity.y - entity.range - 1);
		const maxY = Math.min(pts.length - 1, entity.y + entity.range + 1);

		for (let i = minX; i <= maxX; i++) {
			for (let j = minY; j <= maxY; j++) {
				if (pts[i][j] <= 0) continue;
				const res = astar.search(graph, graph.grid[entity.x][entity.y], graph.grid[i][j]);
				if (!res.length) continue;
				let pathCost = 0, diagonalCount = 0;
				for (let k = 0; k < res.length; k++) {
					const prev = k === 0 ? {x: entity.x, y: entity.y} : res[k - 1];
					const curr = res[k];
					if (prev.x !== curr.x && prev.y !== curr.y) {
						pathCost += (++diagonalCount % 2 === 0) ? 2 : 1;
					} else {
						pathCost++;
					}
					if (pts[curr.x]?.[curr.y] === 2) pathCost++; // Water
				}
				if (pathCost <= entity.range) validMoves.push({x: i, y: j, path: res});
			}
		}
		return validMoves;
	},

	displayMovement: function(entity, specialMode = null) {
		ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
		this.calculateMovement(entity, specialMode).forEach(move => {
			const coord = new calc.coordinate(move.x, move.y);
			if (isPlayerControlled(entity) && !valid.find(v => v.x === coord.x && v.y === coord.y)) valid.push(coord);
			ctx.fillRect((coord.x - camera.x) * tileSize, (coord.y - camera.y) * tileSize, tileSize, tileSize);
		});
	},

	moveEntity: function(entity, x, y) {
		if (isAiming) { isAiming = false; update(); }
		if (pts[x]?.[y] === 0) return false;

		for (const step of line({x: entity.x, y: entity.y}, {x, y})) {
			const onFire  = walls.some(w => w.x === step.x && w.y === step.y && w.type === 'fire');
			const onWater = walls.some(w => w.x === step.x && w.y === step.y && w.type === 'water');
			if (onFire && !helper.hasTrait(entity, 'fire')) {
				if (!entity.traits) entity.traits = [];
				entity.traits.push('fire');
				console.log(entity.name + " caught fire!");
				break;
			}
			if (onWater && helper.hasTrait(entity, 'fire')) {
				entity.traits = entity.traits.filter(t => t !== "fire");
				console.log(entity.name + " got wet!");
				break;
			}
		}

		entity.x = x;
		entity.y = y;
		return true;
	},

	canAttack: function(entity, target) {
		return calc.distance(entity.x, target.x, entity.y, target.y) <= entity.attack_range &&
			this.hasLOS(entity, target.x, target.y, isPlayerControlled(entity));
	},

	attack: function(attacker, targetX, targetY) {
		if (isAiming) { isAiming = false; update(); }

		if (!hasAmmo(attacker)) {
			if (isPlayerControlled(attacker)) console.log("Out of ammo! Press R to reload.");
			return false;
		}

		const weaponDef = attacker.equipment?.weapon ? itemTypes[attacker.equipment.weapon.itemType] : null;
		const targets = getTargetedEntities(attacker, targetX, targetY);
		const enemies = targets.filter(e => e !== attacker && e.hp > 0);
		let attackedAnyone = false;

		for (let burst = 0; burst < (weaponDef?.burst || 1); burst++) {
			if (this.destroyWalls(attacker, targetX, targetY)) attackedAnyone = true;

			for (const enemy of enemies) {
				if (enemy.hp <= 0) continue;
				if (calc.roll(6) >= 4) {
					const dmg = Math.max(1, calc.roll(6) + (attacker.damage || 0) - (enemy.armor || 0));
					enemy.hp -= dmg;
					if (enemy.lastAttacker !== undefined) enemy.lastAttacker = attacker;
					if (enemy.seenX !== undefined) { enemy.seenX = attacker.x; enemy.seenY = attacker.y; }
					console.log(attacker.name + " hits " + enemy.name + " for " + dmg + " DMG!");
					if (enemy.hp <= 0) this.death(enemy);
				} else {
					console.log(attacker.name + " attacks and misses " + enemy.name + "...");
				}
				attackedAnyone = true;
			}
		}

		if (!attackedAnyone) return false;

		consumeAmmo(attacker);

		if (canEntityImmolate(attacker)) {
			for (const tile of calculateEntityTargeting(attacker, targetX, targetY)) {
				if (calc.roll(2) !== 1) continue;
				const existing = walls.find(w => w.x === tile.x && w.y === tile.y);
				if (!existing || existing.type === 'fire') walls.push({x: tile.x, y: tile.y, type: 'fire'});
				const ent = entities.find(e => e.hp > 0 && e.x === tile.x && e.y === tile.y);
				if (ent && !helper.hasTrait(ent, 'fire')) {
					if (!ent.traits) ent.traits = [];
					ent.traits.push("fire");
				}
			}
		}

		return true;
	},

	destroyWalls: function(attacker, targetX, targetY) {
		const weaponDef  = attacker.equipment?.weapon    ? itemTypes[attacker.equipment.weapon.itemType]    : null;
		const accessory  = attacker.equipment?.accessory ? itemTypes[attacker.equipment.accessory.itemType] : null;
		const canDestroy = weaponDef?.canDestroy || accessory?.grantsDestroy;
		let destroyedAny = false;

		for (const tile of calculateEntityTargeting(attacker, targetX, targetY)) {
			const idx = walls.findIndex(w => w.x === tile.x && w.y === tile.y);
			if (idx < 0) continue;
			const wall = walls[idx];
			if (wall.type == "fire") { // Prevent fire tiles from being destroyed
				let destroyedAny = false;
			} else if (wall.type === 'glass') {
				if (canDestroy || wall.damaged) {
					walls.splice(idx, 1);
					console.log(attacker.name + " destroyed glass!");
				} else {
					wall.damaged = true;
				}
				destroyedAny = true;
			} else if (canDestroy) {
				walls.splice(idx, 1);
				console.log(attacker.name + " destroyed a wall!");
				destroyedAny = true;
			}
		}
		return destroyedAny;
	},

	dropAllItems: function(entity) {
		if (typeof mapItems === 'undefined' || typeof nextItemId === 'undefined') return;

		entity.inventory?.forEach(item => {
			const itemDef = itemTypes[item.itemType];
			const qty = (itemDef.type === "consumable" && item.quantity > 1) ? item.quantity : 1;
			for (let i = 0; i < qty; i++) mapItems.push({x: entity.x, y: entity.y, itemType: item.itemType, id: nextItemId++});
			console.log(entity.name + " dropped " + (qty > 1 ? qty + " " : "") + itemDef.name + (qty > 1 ? "s" : ""));
		});
		entity.inventory = [];

		for (const slot in entity.equipment ?? {}) {
			if (!entity.equipment[slot]) continue;
			mapItems.push({x: entity.x, y: entity.y, itemType: entity.equipment[slot].itemType, id: nextItemId++});
			console.log(entity.name + " dropped " + itemTypes[entity.equipment[slot].itemType].name);
		}
		entity.equipment = {};
	},

	death: function(entity) {
		if (entity.hp > 0) return;
		if (helper.hasTrait(entity, 'explode')) {
			this._explosionQueue.push(entity);
			if (!this._explosionPending) this._processBatchExplosions();
			if (entity.name !== "Grenade") return;
		}
		this.dropAllItems(entity);
	},

	// Drains the entire queue synchronously (chains included), then one setTimeout for the flash
	_processBatchExplosions: function() {
		if (this._explosionPending || !this._explosionQueue.length) return;
		this._explosionPending = true;

		const exploded = [];
		while (this._explosionQueue.length) {
			const grenade = this._explosionQueue.shift();
			exploded.push(grenade);
			this._resolveExplosion(grenade); // sync — chain deaths re-queue, picked up by next iteration
		}

		const delay = parseInt(document.getElementById("turn-delay").value) || 0;
		setTimeout(() => {
			exploded.forEach(g => canvas.grenadeAreas(g));
			setTimeout(() => {
				this._explosionPending = false;
				update();
			}, delay);
		}, 0);
	},

	// Pure sync: damage + walls + immolate for one grenade
	_resolveExplosion: function(grenade) {
		const itemDef  = itemTypes.grenade;
		const { x: ex, y: ey } = grenade;
		const r = itemDef.damageRadius;

		console.log(grenade.name + " explodes at " + ex + ", " + ey + "!");

		if (itemDef.canDestroy) {
			for (let tx = Math.max(0, ex - r); tx <= Math.min(size - 1, ex + r); tx++) {
				for (let ty = Math.max(0, ey - r); ty <= Math.min(size - 1, ey + r); ty++) {
					if (Math.hypot(tx - ex, ty - ey) > r) continue;
					const wi = walls.findIndex(w => w.x === tx && w.y === ty && w.type !== 'water' && w.type !== 'fire');
					if (wi >= 0) walls.splice(wi, 1);
				}
			}
		}

		circle(ey, ex, r);
		convert();

		const tiles = [];
		for (let tx = Math.max(0, ex - r - 1); tx <= Math.min(size - 1, ex + r + 1); tx++) {
			for (let ty = Math.max(0, ey - r - 1); ty <= Math.min(size - 1, ey + r + 1); ty++) {
				if (pts[tx]?.[ty] === 1) tiles.push({x: tx, y: ty});
			}
		}

		// Collect unique entities in blast, then damage — avoids hitting the same entity twice
		const hit = [];
		for (const tile of tiles) {
			for (const entity of entities) {
				if (entity !== grenade && entity.hp > 0 && entity.x === tile.x && entity.y === tile.y && !hit.includes(entity))
					hit.push(entity);
			}
		}
		for (const entity of hit) {
			const dmg = Math.max(1, itemDef.damage - (entity.armor || 0));
			console.log(entity.name + " takes " + dmg + " explosion damage!");
			entity.hp -= dmg;
			if (entity.hp <= 0) this.death(entity);
		}

		if (helper.hasTrait(grenade, 'immolate')) {
			for (const tile of tiles) {
				if (calc.roll(3) !== 1) continue;
				const wi = walls.findIndex(w => w.x === tile.x && w.y === tile.y);
				if (wi >= 0) {
					if (walls[wi].type === 'fire') continue;
					walls.splice(wi, 1);
				}
				walls.push({x: tile.x, y: tile.y, type: 'fire'});
			}
		}
	},

	// Public entry point for turns.js grenade countdown
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