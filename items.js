// ITEMS.JS: ITEM DEFINITIONS AND ITEM-RELATED FUNCTIONS

var mapItems = [];
var nextItemId = 0;
var maxInventorySlots = 10;

const consumablesData = {
	healthPotion: {
		name: "Health Potion", type: "consumable", effect: "heal", value: 10, displayName: "HP Potion"
	},
	speedPotion: {
		name: "Speed Potion", type: "consumable", effect: "speed", value: 2, displayName: "Speed Potion"
	},
	grenade: {
		name: "Grenade", type: "consumable", effect: "grenade",
		damageRadius: 2, damage: 15, canDestroy: true, fuse: 2, displayName: "Grenade"
	}
};

const weaponsData = {
	knife: {
		name: "Knife", type: "equipment", slot: "weapon", aimStyle: "melee",
		effects: [{stat: "damage", value: 7}], displayName: "+7 Knife"
	},
	rifle: {
		name: "Rifle", type: "equipment", slot: "weapon", aimStyle: "direct", maxAmmo: 6,
		effects: [{stat: "damage", value: 3}, {stat: "attack_range", value: 4}], displayName: "+3 Rifle"
	},
	shotgun: {
		name: "Shotgun", type: "equipment", slot: "weapon", aimStyle: "cone", spread: 3, maxAmmo: 2,
		effects: [{stat: "damage", value: 5}], displayName: "+5 Shotgun"
	},
	rocketLauncher: {
		name: "Rocket Launcher", type: "equipment", slot: "weapon", aimStyle: "area",
		areaRadius: 2, canDestroy: true, grantsImmolate: true, maxAmmo: 1,
		effects: [{stat: "damage", value: 25}, {stat: "attack_range", value: 3}], displayName: "Rocket Launcher"
	},
	machinegun: {
		name: "Machine Gun", type: "equipment", slot: "weapon", aimStyle: "pierce", burst: 3, maxAmmo: 3,
		effects: [{stat: "damage", value: 3}, {stat: "attack_range", value: 1}], displayName: "Machine Gun"
	}
};

const equipmentData = {
	kevlarVest: {
		name: "Kevlar Vest", type: "equipment", slot: "armor",
		effects: [{stat: "armor", value: 3}], displayName: "Kevlar Vest"
	},
	scope: {
		name: "Scope", type: "equipment", slot: "accessory",
		effects: [{stat: "attack_range", value: 4}], displayName: "Scope"
	},
	breachingKit: {
		name: "Breaching Kit", type: "equipment", slot: "accessory",
		grantsDestroy: true, displayName: "Breaching Kit"
	},
	flameBadge: {
		name: "Flame Badge", type: "equipment", slot: "accessory",
		grantsImmolate: true, displayName: "Flame Badge"
	}
};

var itemTypes = {...consumablesData, ...weaponsData, ...equipmentData};

const itemLabels = {
	healthPotion: "HP+", speedPotion: "SP+", grenade: "Gnade", scope: "Scope",
	rifle: "Rifle", kevlarVest: "Vest", shotgun: "Shotgun", rocketLauncher: "RPG",
	machinegun: "SMG", breachingKit: "Breach", knife: "Knife", flameBadge: "Flame"
};

function getWeaponAimStyle(entity) {
	return entity.equipment?.weapon ? itemTypes[entity.equipment.weapon.itemType]?.aimStyle || "standard" : "standard";
}

function canEntityDestroyWalls(entity) {
	const accessoryDef = entity.equipment?.accessory ? itemTypes[entity.equipment.accessory.itemType] : null;
	const weaponDef    = entity.equipment?.weapon    ? itemTypes[entity.equipment.weapon.itemType]    : null;
	return !!(weaponDef?.canDestroy || accessoryDef?.grantsDestroy);
}

function canEntityImmolate(entity) {
	const weaponDef    = entity.equipment?.weapon    ? itemTypes[entity.equipment.weapon.itemType]    : null;
	const accessoryDef = entity.equipment?.accessory ? itemTypes[entity.equipment.accessory.itemType] : null;
	return !!(weaponDef?.grantsImmolate || accessoryDef?.grantsImmolate || helper.hasTrait(entity, "immolate"));
}

function getEntityAttackRange(entity) {
	const weaponDef = entity.equipment?.weapon ? itemTypes[entity.equipment.weapon.itemType] : null;
	return weaponDef?.aimStyle === "melee" ? 1 : entity.attack_range;
}

function hasAmmo(entity) {
	if (!entity.equipment?.weapon) return true;
	const weapon = entity.equipment.weapon;
	const weaponDef = itemTypes[weapon.itemType];
	if (weaponDef.maxAmmo === undefined) return true;
	if (weapon.currentAmmo === undefined) weapon.currentAmmo = weaponDef.maxAmmo;
	return weapon.currentAmmo > 0;
}

function consumeAmmo(entity) {
	if (!entity.equipment?.weapon) return;
	const weapon = entity.equipment.weapon;
	const weaponDef = itemTypes[weapon.itemType];
	if (weaponDef.maxAmmo === undefined) return;
	if (weapon.currentAmmo === undefined) weapon.currentAmmo = weaponDef.maxAmmo;
	weapon.currentAmmo = Math.max(0, weapon.currentAmmo - 1);
}

function reloadWeapon(entity) {
	if (!entity.equipment?.weapon) return false;
	const weapon = entity.equipment.weapon;
	const weaponDef = itemTypes[weapon.itemType];
	if (weaponDef.maxAmmo === undefined) { console.log(entity.name + "'s weapon doesn't need reloading!"); return false; }
	if (weapon.currentAmmo === undefined) weapon.currentAmmo = weaponDef.maxAmmo;
	if (weapon.currentAmmo >= weaponDef.maxAmmo) { console.log(entity.name + "'s weapon is already fully loaded!"); return false; }
	weapon.currentAmmo = weaponDef.maxAmmo;
	console.log(entity.name + " reloaded their " + weaponDef.name + "!");
	return true;
}

// Collects all tiles inside a circle blast area using the raw array buffer.
function collectAreaTiles(centerX, centerY, radius) {
	circle(centerY, centerX, radius);
	const tiles = [];
	for (let wx = Math.max(0, centerX - radius - 1); wx <= Math.min(size - 1, centerX + radius + 1); wx++) {
		for (let wy = Math.max(0, centerY - radius - 1); wy <= Math.min(size - 1, centerY + radius + 1); wy++) {
			if (array[wx * size + wy] === 1) tiles.push({x: wx, y: wy});
		}
	}
	convert();
	return tiles;
}

// Returns the tiles covered by an attack from attacker toward (endX, endY).
function calculateEntityTargeting(entity, endX, endY) {
	const aimStyle   = getWeaponAimStyle(entity);
	const canDestroy = canEntityDestroyWalls(entity);
	const range      = getEntityAttackRange(entity);

	let path = line({x: entity.x, y: entity.y}, {x: endX, y: endY});
	path = clipPathAtWall(path, canDestroy, true); // stopAtDoor so doors can be targeted
	path = path.length > range + 1 ? path.slice(1, range + 1) : path.slice(1);

	if (path.length === 0) {
		// canDestroy: still allow targeting a wall tile just outside reach
		if (canDestroy) {
			const isWall = walls.find(w => w.x === endX && w.y === endY);
			if (calc.distance(entity.x, endX, entity.y, endY) <= range && isWall) return [{x: endX, y: endY}];
		}
		return [];
	}

	if (aimStyle === "cone") {
		const spread = entity.equipment?.weapon ? itemTypes[entity.equipment.weapon.itemType]?.spread || 3 : 3;
		return calculateCone(path, entity.x, entity.y, endX, endY, range, spread);
	}

	if (aimStyle === "area") {
		const areaRadius = entity.equipment?.weapon ? itemTypes[entity.equipment.weapon.itemType]?.areaRadius || 2 : 2;
		const center     = path[path.length - 1];
		const areaTiles  = collectAreaTiles(center.x, center.y, areaRadius);
		const pathSet    = new Set(path.map(p => `${p.x},${p.y}`));
		return [...path, ...areaTiles.filter(t => !pathSet.has(`${t.x},${t.y}`))];
	}
	if (aimStyle === "direct") {
		// Direct fire hits only the first entity in the path
		for (const tile of tiles) {
			const targetted = entities.find(e => e.hp > 0 && e.x === tile.x && e.y === tile.y);
			if (targetted) return [targetted];
		}
		return [];
	}

	// pierce / melee / standard all just use the clipped path
	return path;
}

// Returns entities that would be hit by an attack. Delegates tile calculation to
// calculateEntityTargeting so path/wall logic lives in exactly one place.
function getTargetedEntities(attacker, endX, endY) {
	const aimStyle = getWeaponAimStyle(attacker);
	const tiles    = calculateEntityTargeting(attacker, endX, endY);

	if (tiles.length === 0) return [];

	if (aimStyle === "direct") {
		// Direct fire hits only the first entity in the path
		for (const tile of tiles) {
			const found = entities.find(e => e.hp > 0 && e.x === tile.x && e.y === tile.y);
			if (found) return [found];
		}
		return [];
	}

	// All other styles (area, cone, pierce, melee, standard) hit every entity in the tile set
	return getEntitiesInTiles(tiles);
}

function calculateGrenadeTargeting(entity, endX, endY) {
	const itemDef   = itemTypes.grenade;
	const throwRange = entity.attack_range;

	let path = line({x: entity.x, y: entity.y}, {x: endX, y: endY});
	path = clipPathAtWall(path); // grenades stop at walls, can't destroy en route
	path = path.length > throwRange + 1 ? path.slice(1, throwRange + 1) : path.slice(1);

	if (path.length === 0) return [];

	const center    = path[path.length - 1];
	const areaTiles = collectAreaTiles(center.x, center.y, itemDef.damageRadius);
	const pathSet   = new Set(path.map(p => `${p.x},${p.y}`));
	return [...path, ...areaTiles.filter(t => !pathSet.has(`${t.x},${t.y}`))];
}

function throwItem(entity, inventoryIndex, targetX, targetY) {
	if (inventoryIndex < 0 || inventoryIndex >= entity.inventory.length) return false;
	const item    = entity.inventory[inventoryIndex];
	const itemDef = itemTypes[item.itemType];
	if (!item.isLive || itemDef.effect !== "grenade") return false;

	const dist = calc.distance(entity.x, targetX, entity.y, targetY);
	if (dist > entity.attack_range) return false;

	let path = line({x: entity.x, y: entity.y}, {x: targetX, y: targetY});
	path = clipPathAtWall(path);

	// Damage or destroy glass in path
	for (let i = 1; i < path.length; i++) {
		const wallIndex = walls.findIndex(w => w.x === path[i].x && w.y === path[i].y);
		if (wallIndex >= 0 && walls[wallIndex].type === 'glass') {
			if (walls[wallIndex].damaged) walls.splice(wallIndex, 1);
			else walls[wallIndex].damaged = true;
		}
	}

	if (path.length === 0) return false;

	const landingSpot = path[Math.min(path.length - 1, entity.attack_range)];
	const grenadeTraits = ['explode', 'active'];
	if (canEntityImmolate(entity)) grenadeTraits.push('immolate');

	allEnemies.push({
		name: "Grenade", hp: 1,
		x: landingSpot.x, y: landingSpot.y,
		range: 0, attack_range: 0, turns: 1,
		turnsRemaining: item.turnsRemaining,
		inventory: [], traits: grenadeTraits
	});
	entity.inventory.splice(inventoryIndex, 1);
	console.log(entity.name + " threw a grenade to (" + landingSpot.x + ", " + landingSpot.y + ")!");
	return true;
}

function spawnItem(itemType, x, y) {
	x = x || player.x;
	y = y || player.y;
	if (x < 0 || x >= size || y < 0 || y >= size) return false;

	const hasWall   = walls.find(w => w.x === x && w.y === y);
	const hasEntity = allEnemies.find(e => e.hp > 0 && e.x === x && e.y === y) ||
	                  allPlayers.find(e => e.hp > 0 && e.x === x && e.y === y) ||
	                  (player.x === x && player.y === y ? player : null);

	if (hasEntity) return giveItem(hasEntity, itemType);
	if (hasWall)   { console.log("Invalid spawn location for item!"); return false; }

	mapItems.push({x, y, itemType, id: nextItemId++});
	console.log("Spawned " + itemTypes[itemType].name + " at " + x + ", " + y);
	update();
	return true;
}

function sortInventory(entity) {
	if (!entity.inventory) return;
	const order = item => {
		const def = itemTypes[item.itemType];
		if (!def) return 3;
		if (def.type === 'consumable') return 0;
		if (def.type === 'equipment' && def.slot === 'weapon') return 1;
		if (def.type === 'equipment') return 2;
		return 3;
	};
	entity.inventory.sort((a, b) => order(a) - order(b));
}

function giveItem(entity, itemType) {
	if (!entity.inventory) entity.inventory = [];
	const itemDef = itemTypes[itemType];

	if (itemDef.type === "consumable") {
		for (let item of entity.inventory) {
			if (item.itemType === itemType && !item.isLive) {
				item.quantity = (item.quantity || 1) + 1;
				console.log(entity.name + " received another " + itemDef.name);
				update();
				return true;
			}
		}
	}

	if (isPlayerControlled(entity) && entity.inventory.length >= maxInventorySlots) {
		console.log("Inventory full!");
		return false;
	}

	const newItem = {itemType, id: nextItemId++};
	if (itemDef.type === "consumable") newItem.quantity = 1;
	if (itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) newItem.currentAmmo = itemDef.maxAmmo;

	entity.inventory.push(newItem);
	console.log(entity.name + " received " + itemDef.name);

	if (!isPlayerControlled(entity) && itemDef.type === "equipment") {
		if (!entity.equipment) entity.equipment = {};
		if (entity.equipment[itemDef.slot]) unequipItem(entity, itemDef.slot);
		const itemIndex = entity.inventory.findIndex(item => item.id === newItem.id);
		if (itemIndex >= 0) equipItem(entity, itemIndex);
	}

	update();
	return true;
}

function spawnItemFromUI() {
	spawnItem(document.getElementById('item_type').value,
		parseInt(document.getElementById('item_x').value),
		parseInt(document.getElementById('item_y').value));
}

function updateItemDropdown() {
	const category    = document.getElementById('item_category').value;
	const itemDropdown = document.getElementById('item_type');
	itemDropdown.innerHTML = '';
	for (let key in itemTypes) {
		const itemDef = itemTypes[key];
		const matches =
			(category === "consumables" && itemDef.type === "consumable") ||
			(category === "weapons"     && itemDef.type === "equipment" && itemDef.slot === "weapon") ||
			(category === "equipment"   && itemDef.type === "equipment" && itemDef.slot !== "weapon");
		if (matches) {
			const option = document.createElement('option');
			option.value = key;
			option.textContent = itemDef.name;
			itemDropdown.appendChild(option);
		}
	}
}

function pickupItem(entity, x, y) {
	if (!entity.inventory) return false;

	if (isPlayerControlled(entity)) {
		const itemsAtLocation = mapItems.filter(item => item.x === x && item.y === y);
		if (itemsAtLocation.length > 0) {
			if (typeof showItemPickupWindow !== 'undefined') showItemPickupWindow(x, y);
			return true;
		}
		return false;
	}

	const itemsAtLocation = mapItems.filter(item => item.x === x && item.y === y);
	if (itemsAtLocation.length === 0) return false;

	const mostRecent = itemsAtLocation[itemsAtLocation.length - 1];
	const itemDef    = itemTypes[mostRecent.itemType];

	if (itemDef.type === "equipment" && shouldEnemyEquip(entity, itemDef)) {
		if (!entity.equipment) entity.equipment = {};
		if (entity.equipment[itemDef.slot]) unequipItem(entity, itemDef.slot);
		const pickedItem = {itemType: mostRecent.itemType, id: mostRecent.itemType};
		if (itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) pickedItem.currentAmmo = itemDef.maxAmmo;
		entity.equipment[itemDef.slot] = pickedItem;
		applyEquipmentEffects(entity, itemDef, true);
		console.log(entity.name + " equipped " + itemDef.name);
		mapItems.splice(mapItems.indexOf(mostRecent), 1);
		return true;
	}

	if (itemDef.type === "consumable") {
		const stack = itemsAtLocation.filter(item => item.itemType === mostRecent.itemType);
		entity.inventory.push({itemType: mostRecent.itemType, id: nextItemId++, quantity: stack.length});
		console.log(entity.name + " picked up " + stack.length + " " + itemDef.name + (stack.length > 1 ? "s" : ""));
		for (let i = 0; i < stack.length; i++) {
			const idx = mapItems.findIndex(item => item.x === x && item.y === y && item.itemType === mostRecent.itemType);
			if (idx >= 0) mapItems.splice(idx, 1);
		}
		return true;
	}

	const newItem = {itemType: mostRecent.itemType, id: mostRecent.id};
	if (itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) newItem.currentAmmo = itemDef.maxAmmo;
	entity.inventory.push(newItem);
	console.log(entity.name + " picked up " + itemDef.name);
	mapItems.splice(mapItems.indexOf(mostRecent), 1);
	return true;
}

function shouldEnemyEquip(entity, itemDef) {
	if (!entity.equipment) entity.equipment = {};
	const currentItem = entity.equipment[itemDef.slot];
	if (!currentItem) return true;
	const newTotal     = itemDef.effects?.reduce((sum, e) => sum + e.value, 0) || 0;
	const currentTotal = itemTypes[currentItem.itemType].effects?.reduce((sum, e) => sum + e.value, 0) || 0;
	return newTotal > currentTotal;
}

function applyEquipmentEffects(entity, itemDef, equip) {
	const m = equip ? 1 : -1;
	if (itemDef.effects) {
		for (let effect of itemDef.effects) {
			if      (effect.stat === "attack_range") entity.attack_range += effect.value * m;
			else if (effect.stat === "damage")       entity.damage = (entity.damage || 0) + effect.value * m;
			else if (effect.stat === "armor")        entity.armor  = (entity.armor  || 0) + effect.value * m;
		}
	}
}

function unequipItem(entity, slot) {
	if (!entity.equipment?.[slot]) return false;
	const equippedItem = entity.equipment[slot];
	const itemDef      = itemTypes[equippedItem.itemType];
	applyEquipmentEffects(entity, itemDef, false);
	entity.inventory.push(equippedItem);
	entity.equipment[slot] = null;
	console.log(entity.name + " unequipped " + itemDef.name);
	return true;
}

function equipItem(entity, inventoryIndex) {
	if (inventoryIndex < 0 || inventoryIndex >= entity.inventory.length) return false;
	const item    = entity.inventory[inventoryIndex];
	const itemDef = itemTypes[item.itemType];
	if (!itemDef || itemDef.type !== "equipment") return false;
	if (!entity.equipment) entity.equipment = {};
	if (entity.equipment[itemDef.slot]) unequipItem(entity, itemDef.slot);
	entity.inventory.splice(inventoryIndex, 1);
	entity.equipment[itemDef.slot] = item;
	applyEquipmentEffects(entity, itemDef, true);
	console.log(entity.name + " equipped " + itemDef.name);
	window.throwingGrenadeIndex = undefined;
	return true;
}

function useItem(entity, inventoryIndex) {
	if (inventoryIndex < 0 || inventoryIndex >= entity.inventory.length) return false;
	const item    = entity.inventory[inventoryIndex];
	const itemDef = itemTypes[item.itemType];
	if (!itemDef) return false;

	if (itemDef.type === "consumable") {
		if (itemDef.effect === "heal") {
			entity.hp += itemDef.value;
			console.log(entity.name + " heals for " + itemDef.value + "HP!");
			item.quantity > 1 ? item.quantity-- : entity.inventory.splice(inventoryIndex, 1);
		} else if (itemDef.effect === "speed") {
			entity.range += itemDef.value;
			console.log(entity.name + " feels themselves moving faster!");
			item.quantity > 1 ? item.quantity-- : entity.inventory.splice(inventoryIndex, 1);
		} else if (itemDef.effect === "grenade") {
			if (item.isLive) {
				window.throwingGrenadeIndex = inventoryIndex;
				action.value = "attack";
				console.log("Select target to throw grenade (range: " + entity.attack_range + ")");
				update();
				return true;
			} else {
				item.quantity > 1 ? item.quantity-- : entity.inventory.splice(inventoryIndex, 1);
				entity.inventory.push({itemType: 'grenade', id: nextItemId++, isLive: true, turnsRemaining: itemDef.fuse, quantity: 1});
				console.log(entity.name + " pulled the pin! Use/click to throw!");
				update();
				return true;
			}
		}
		currentEntityTurnsRemaining--;
		if (isPeekMode) { exitPeekMode(); return true; }
	} else if (itemDef.type === "equipment") {
		equipItem(entity, inventoryIndex);
	}

	update();
	return true;
}

function processInventoryGrenades(entity) {
	if (!entity.inventory) return;
	for (let i = entity.inventory.length - 1; i >= 0; i--) {
		const item    = entity.inventory[i];
		const itemDef = itemTypes[item.itemType];
		if (!item.isLive || itemDef?.effect !== "grenade") continue;

		item.turnsRemaining--;
		if (item.turnsRemaining <= 0) {
			entity.inventory.splice(i, 1);
			const grenadeTraits = ['explode', 'active'];
			if (canEntityImmolate(entity)) grenadeTraits.push('immolate');
			const grenadeEntity = { // Spawns the grenade that is exploding in the inventory
				name: "Grenade", hp: 0,
				x: entity.x, y: entity.y,
				range: 0, attack_range: 0, turns: 1, turnsRemaining: 0,
				inventory: [], traits: grenadeTraits
			};
			allEnemies.push(grenadeEntity);
			EntitySystem.triggerExplosion(grenadeEntity);
		}
	}
}