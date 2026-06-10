// ENTITY.JS: UNIFIED ENTITY SYSTEM FOR ALL CHARACTERS

const EntitySystem = {
	_explosionQueue: [],
	_explosionPending: false,

	hasLOS: function(entity, targetX, targetY, usePermissive = false) {
		if (usePermissive) return hasPermissiveLOS(entity.x, entity.y, targetX, targetY);
		const path = line({x: entity.x, y: entity.y}, {x: targetX, y: targetY});
		if (path.length < calc.distance(entity.x, targetX, entity.y, targetY) + 1) return false;
		for (let i = 1; i < path.length - 1; i++) {
			const wall = wallAt(path[i].x, path[i].y);
			if (wall && wall.type !== 'glass' && wall.type !== 'water' && wall.type !== 'fire' && !(wall.type === 'door' && wall.open)) return false;
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

		entities.forEach(e => {
			if (e !== entity && e.hp > 0 && !helper.isGrenadeEntity(e) && pts[e.x]?.[e.y] !== undefined) pts[e.x][e.y] = 0;
		});

		if (specialMode === 'peek') entity.range = Math.floor(savedPlayerRange / 2);

		// Dijkstra flood fill; state = tile + diagonal parity (diagonals cost 1,2,1,2...)
		const range = entity.range;
		const best = new Map();
		const start = (entity.x * size + entity.y) * 2;
		best.set(start, 0);
		const buckets = [[start]];
		const offs = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];

		for (let cost = 0; cost <= range; cost++) {
			for (const key of buckets[cost] || []) {
				if (best.get(key) !== cost) continue;
				const idx = key >> 1, parity = key & 1;
				const cx = (idx / size) | 0, cy = idx % size;
				for (const [dx, dy] of offs) {
					const nx = cx + dx, ny = cy + dy;
					if (nx < 0 || ny < 0 || nx >= size || ny >= size || pts[nx][ny] <= 0) continue;
					const diag = dx !== 0 && dy !== 0;
					const nCost = cost + (diag && parity ? 2 : 1) + (pts[nx][ny] === 2 ? 1 : 0);
					if (nCost > range) continue;
					const nKey = (nx * size + ny) * 2 + (diag ? parity ^ 1 : parity);
					if (best.get(nKey) <= nCost) continue;
					best.set(nKey, nCost);
					(buckets[nCost] = buckets[nCost] || []).push(nKey);
				}
			}
		}

		const validMoves = [];
		const seen = new Set();
		for (const key of best.keys()) {
			const idx = key >> 1;
			if (idx === start >> 1 || seen.has(idx)) continue;
			seen.add(idx);
			validMoves.push({x: (idx / size) | 0, y: idx % size});
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

		// Area weapons use explosion logic directly
		if (weaponDef?.aimStyle === 'area') {
			consumeAmmo(attacker);
			this._explosionQueue.push({
				name: attacker.name,
				x: targetX, y: targetY,
				traits: canEntityImmolate(attacker) ? ['explode', 'immolate'] : ['explode'],
				_damage: attacker.damage || 0,
				_radius: weaponDef.areaRadius
			});
			if (!this._explosionPending) this._processBatchExplosions();
			return true;
		}

		const targets      = getTargetedEntities(attacker, targetX, targetY);
		const enemies      = targets.filter(e => e !== attacker && e.hp > 0);
		let attackedAnyone = false;

		for (let burst = 0; burst < (weaponDef?.burst || 1); burst++) {
			if (this.destroyWalls(attacker, targetX, targetY)) attackedAnyone = true;

			for (const enemy of enemies) {
				if (enemy.hp <= 0) continue;
				if (calc.roll(6) >= 4) {
					let dmg = Math.max(1, calc.roll(6) + (attacker.damage || 0) - (enemy.armor || 0));
					enemy.hp -= dmg;
					if (enemy.lastAttacker !== undefined) enemy.lastAttacker = attacker;
					if (enemy.seenX !== undefined) { enemy.seenX = attacker.x; enemy.seenY = attacker.y; }
					console.log(attacker.name + " hits " + enemy.name + " for " + dmg + " DMG!");
					if (helper.hasTrait(attacker, 'lifesteal')) {
						if (enemy.name == "Grenade" && enemy.active) return; // No lifesteal when shooting grenades
						dmg = Math.min(dmg, enemy.hp);
						attacker.hp += dmg;
						console.log(attacker.name + " gained " + dmg + " HP from " + enemy.name);
					}
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
				const existing = wallAt(tile.x, tile.y);
				if (!existing) walls.push({x: tile.x, y: tile.y, type: 'fire'});
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
		const canDestroy = canEntityDestroyWalls(attacker);
		const canBreach  = canEntityBreach(attacker);
		let destroyedAny = false;

		for (const tile of calculateEntityTargeting(attacker, targetX, targetY)) {
			const idx = walls.findIndex(w => w.x === tile.x && w.y === tile.y);
			if (idx < 0) continue;
			const wall = walls[idx];
			if (wall.permanent) continue;
			if (wall.type === 'water' || wall.type === 'fire') continue;
			if (wall.type === 'glass' || (wall.type === 'door' && !wall.open)) {
				if (canDestroy || canBreach || wall.damaged) {
					walls.splice(idx, 1);
					console.log(attacker.name + " destroyed " + (wall.type === 'door' ? "a door!" : "glass!"));
				} else {
					wall.damaged = true;
				}
				destroyedAny = true;
			} else if (canDestroy) {
				if (wall.open) return destroyedAny;
				walls.splice(idx, 1);
				console.log(attacker.name + " destroyed a wall!");
				destroyedAny = true;
			} else if (canBreach) {
				if (wall.damaged) {
					walls.splice(idx, 1);
					console.log(attacker.name + " breached through a wall!");
				} else {
					wall.damaged = true;
					console.log(attacker.name + " damaged a wall!");
				}
				destroyedAny = true;
			}
		}
		return destroyedAny;
	},

	dropAllItems: function(entity) {
		if (typeof mapItems === 'undefined' || typeof nextItemId === 'undefined') return;

		if (entity.equipment) {
			for (const slot in entity.equipment) {
				if (entity.equipment[slot]) {
					const def = itemTypes[entity.equipment[slot].itemType];
					if (def) applyEquipmentEffects(entity, def, false);
					entity.equipment[slot] = null;
				}
			}
		}

		if (!entity.inventory) return;
		for (let i = 0; i < entity.inventory.length; i++) {
			const item = entity.inventory[i];
			if (!item) continue;
			const itemDef = itemTypes[item.itemType];
			const qty = (itemDef.type === "consumable" && item.quantity > 1) ? item.quantity : 1;
			for (let j = 0; j < qty; j++) {
				const dropped = {x: entity.x, y: entity.y, itemType: item.itemType, id: nextItemId++};
				if (item.currentAmmo !== undefined) dropped.currentAmmo = item.currentAmmo;
				mapItems.push(dropped);
			}
			console.log(entity.name + " dropped " + (qty > 1 ? qty + " " : "") + itemDef.name + (qty > 1 ? "s" : ""));
			entity.inventory[i] = null;
		}
	},

	death: function(entity) {
		if (entity.hp > 0) return;
		this.dropAllItems(entity);
		if (helper.hasTrait(entity, 'explode')) {
			this._explosionQueue.push(entity);
			if (!this._explosionPending) this._processBatchExplosions();
		}
	},

	_processBatchExplosions: function() {
		if (this._explosionPending || !this._explosionQueue.length) return;
		this._explosionPending = true;

		const delay = parseInt(document.getElementById("turn-delay").value) || 0;
		const firstGrenade = this._explosionQueue[0];
		camera = {
			x: firstGrenade.x - Math.round(viewportWidth / 2) + 1,
			y: firstGrenade.y - Math.round(viewportHeight / 2) + 1
		};
		canvas.init();
		update();

		setTimeout(() => {
			const exploded = [];
			while (this._explosionQueue.length) {
				const grenade = this._explosionQueue.shift();
				exploded.push(grenade);
				this._resolveExplosion(grenade);
			}
			exploded.forEach(g => canvas.grenadeAreas(g));
			setTimeout(() => { this._explosionPending = false; update(); }, delay);
		}, delay);
	},

	_resolveExplosion: function(grenade) {
		grenade.traits.push("immolate");

		const itemDef = itemTypes.grenade;
		const { x: ex, y: ey } = grenade;
		const r      = grenade._radius ?? itemDef.damageRadius;
		const damage = grenade._damage ?? itemDef.damage;

		console.log(grenade.name + " explodes at " + ex + ", " + ey + "!");

		const blastTiles = collectAreaTiles(ex, ey, r);

		if (itemDef.canDestroy) {
			for (const tile of blastTiles) {
				const wi = walls.findIndex(w => w.x === tile.x && w.y === tile.y && w.type !== 'water' && w.type !== 'fire' && !w.permanent);
				if (wi >= 0) walls.splice(wi, 1);
			}
		}

		for (const entity of getEntitiesInTiles(blastTiles)) {
			if (entity === grenade) continue;
			const dmg = Math.max(1, damage - (entity.armor || 0));
			console.log(entity.name + " takes " + dmg + " explosion damage!");
			entity.hp -= dmg;
			if (entity.hp <= 0) this.death(entity);
		}

		if (helper.hasTrait(grenade, 'immolate')) {
			for (const tile of blastTiles) {
				if (calc.roll(3) !== 1) continue;
				const existing = wallAt(tile.x, tile.y);
				if (existing?.permanent) continue;
				if (!existing) walls.push({x: tile.x, y: tile.y, type: 'fire'});
			}
		}
	},

	// Returns true if entity can reach any tile further than radius from (centerX, centerY)
	canMoveOutsideRadius: function(entity, centerX, centerY, radius) {
		return this.calculateMovement(entity).some(
			move => calc.distance(move.x, centerX, move.y, centerY) > radius
		);
	},

	triggerExplosion: function(grenade) {
		this._explosionQueue.push(grenade);
		this._processBatchExplosions();
	}
};

window.EntitySystem = EntitySystem;