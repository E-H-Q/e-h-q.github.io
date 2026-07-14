// ITEMS.JS: ITEM DEFINITIONS AND ITEM-RELATED FUNCTIONS

var mapItems = [];
var nextItemId = 0;

// Inventory dimensions: 3 rows × 10 cols (top row is the hotbar)
const INVENTORY_COLS = 10;
const INVENTORY_ROWS = 2;
var maxInventorySlots = INVENTORY_COLS * INVENTORY_ROWS; // 30

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
	},
	key: {
		name: "Key", type: "consumable", effect: "key", displayName: "Key"
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
	},
	pistol: {
		name: "Pistol", type: "equipment", slot: "weapon", aimStyle: "default", maxAmmo: Infinity,
		effects: [{stat: "damage", value: 3}, {stat: "attack_range", value: 1}], displayName: "Pistol"
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
		grantsBreaching: true, displayName: "Breaching Kit"
	},
	flameBadge: {
		name: "Flame Badge", type: "equipment", slot: "accessory",
		grantsImmolate: true, displayName: "Flame Badge"
	}
};

var itemTypes = {...consumablesData, ...weaponsData, ...equipmentData};

// === SPARSE INVENTORY HELPERS ============================================

// Lazily ensures entity.inventory is a fixed-length sparse array of size maxInventorySlots.
// Pads or migrates legacy packed inventories. Returns the inventory array.
function getInventory(entity) {
	if (!entity.inventory) {
		entity.inventory = new Array(maxInventorySlots).fill(null);
		return entity.inventory;
	}
	if (entity.inventory.length < maxInventorySlots) {
		while (entity.inventory.length < maxInventorySlots) entity.inventory.push(null);
	} else if (entity.inventory.length > maxInventorySlots) {
		entity.inventory.length = maxInventorySlots;
	}
	for (let i = 0; i < entity.inventory.length; i++) {
		if (entity.inventory[i] === undefined) entity.inventory[i] = null;
	}
	return entity.inventory;
}

function findFirstEmptySlot(entity) {
	const inv = getInventory(entity);
	// Prefer slots below the hotbar — the hotbar (top row) only fills when
	// every non-hotbar slot is already taken.
	for (let i = INVENTORY_COLS; i < inv.length; i++) if (!inv[i]) return i;
	for (let i = 0; i < INVENTORY_COLS; i++) if (!inv[i]) return i;
	return -1;
}

// Returns the first empty hotbar slot (top row, 0..INVENTORY_COLS-1) or -1 if full.
function findFirstEmptyHotbarSlot(entity) {
	const inv = getInventory(entity);
	for (let i = 0; i < INVENTORY_COLS; i++) if (!inv[i]) return i;
	return -1;
}

// True if `item` is currently in one of entity.equipment's slots (by identity).
function isItemEquipped(entity, item) {
	if (!item || !entity.equipment) return false;
	for (const slot in entity.equipment) {
		if (entity.equipment[slot] === item) return true;
	}
	return false;
}

function swapInventorySlots(entity, fromIdx, toIdx) {
	const inv = getInventory(entity);
	if (fromIdx < 0 || fromIdx >= inv.length || toIdx < 0 || toIdx >= inv.length) return;
	const tmp = inv[fromIdx];
	inv[fromIdx] = inv[toIdx];
	inv[toIdx] = tmp;
}

// After loading from JSON, re-link entity.equipment[slot] objects to the actual
// item instance inside entity.inventory (so identity-based checks like
// isItemEquipped() work). If an equipped item isn't in the loaded inventory,
// it gets inserted into the first empty slot. Non-equipment values in equipment
// slots are dropped — only equipment items belong there.
function normalizeEntityInventory(entity) {
	getInventory(entity);
	if (!entity.equipment) return;
	for (const slot in entity.equipment) {
		const eq = entity.equipment[slot];
		if (!eq) continue;
		const eqDef = itemTypes[eq.itemType];
		if (!eqDef || eqDef.type !== "equipment") {
			entity.equipment[slot] = null;
			continue;
		}
		let linked = null;
		for (let item of entity.inventory) {
			if (item && item.id === eq.id && item.itemType === eq.itemType) { linked = item; break; }
		}
		if (!linked) {
			const emptyIdx = entity.inventory.findIndex(i => !i);
			if (emptyIdx >= 0) entity.inventory[emptyIdx] = eq;
			else entity.inventory[0] = eq; // force in if completely full (shouldn't happen normally)
			linked = eq;
		}
		entity.equipment[slot] = linked;
	}
}

// === WEAPON / EQUIPMENT LOOKUPS ==========================================

function getWeaponAimStyle(entity) {
	return entity.equipment?.weapon ? itemTypes[entity.equipment.weapon.itemType]?.aimStyle || "standard" : "standard";
}

function canEntityDestroyWalls(entity) {
	const accessoryDef = entity.equipment?.accessory ? itemTypes[entity.equipment.accessory.itemType] : null;
	const weaponDef    = entity.equipment?.weapon    ? itemTypes[entity.equipment.weapon.itemType]    : null;
	return !!(weaponDef?.canDestroy || accessoryDef?.grantsDestroy);
}

function canEntityBreach(entity) {
	const acc = entity.equipment?.accessory;
	if (!acc) return false;
	return acc.itemType === 'breachingKit';
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
	if (!weaponDef.maxAmmo || weaponDef.maxAmmo === Infinity) return true;
	if (weapon.currentAmmo === undefined) weapon.currentAmmo = weaponDef.maxAmmo;
	return weapon.currentAmmo > 0;
}

function consumeAmmo(entity) {
	if (!entity.equipment?.weapon) return;
	const weapon = entity.equipment.weapon;
	const weaponDef = itemTypes[weapon.itemType];
	if (!weaponDef.maxAmmo || weaponDef.maxAmmo === Infinity) return;
	if (weapon.currentAmmo === undefined) weapon.currentAmmo = weaponDef.maxAmmo;
	weapon.currentAmmo = Math.max(0, weapon.currentAmmo - 1);
}

function findGrenadeInInventory(entity, live) {
	if (!entity.inventory) return -1;
	for (let i = 0; i < entity.inventory.length; i++) {
		const item = entity.inventory[i];
		if (!item || item.itemType !== 'grenade') continue;
		if (live === true && !item.isLive) continue;
		if (live === false && item.isLive) continue;
		return i;
	}
	return -1;
}

function pullGrenadePin(entity, slotIdx) {
	const inv = getInventory(entity);
	const item = inv[slotIdx];
	if (!item || item.itemType !== 'grenade' || item.isLive) return -1;
	const itemDef = itemTypes.grenade;
	const liveGrenade = {itemType: 'grenade', id: nextItemId++, isLive: true, turnsRemaining: itemDef.fuse, quantity: 1};
	if (item.quantity > 1) {
		let destIdx = findFirstEmptyHotbarSlot(entity);
		if (destIdx < 0) destIdx = findFirstEmptySlot(entity);
		if (destIdx < 0) return -1;
		item.quantity--;
		inv[destIdx] = liveGrenade;
		return destIdx;
	}
	const sourceInHotbar = slotIdx < INVENTORY_COLS;
	const hotbarIdx = sourceInHotbar ? -1 : findFirstEmptyHotbarSlot(entity);
	if (hotbarIdx >= 0) {
		inv[slotIdx] = null;
		inv[hotbarIdx] = liveGrenade;
		return hotbarIdx;
	}
	inv[slotIdx] = liveGrenade;
	return slotIdx;
}

function getOrActivateGrenade(entity) {
	const inv = getInventory(entity);
	let bestIdx = -1, bestTurns = Infinity;
	for (let i = 0; i < inv.length; i++) {
		const item = inv[i];
		if (item?.itemType === 'grenade' && item.isLive && item.turnsRemaining < bestTurns) {
			bestTurns = item.turnsRemaining;
			bestIdx = i;
		}
	}
	if (bestIdx >= 0) return bestIdx;
	const nonLiveIdx = findGrenadeInInventory(entity, false);
	if (nonLiveIdx < 0) return -1;
	return pullGrenadePin(entity, nonLiveIdx);
}

function reloadWeapon(entity) {
	if (!entity.equipment?.weapon) return false;
	const weapon = entity.equipment.weapon;
	const weaponDef = itemTypes[weapon.itemType];
	if (!weaponDef.maxAmmo || weaponDef.maxAmmo === Infinity) { console.log(entity.name + "'s weapon doesn't need reloading!"); return false; }
	if (weapon.currentAmmo === undefined) weapon.currentAmmo = weaponDef.maxAmmo;
	if (weapon.currentAmmo >= weaponDef.maxAmmo) { console.log(entity.name + "'s weapon is already fully loaded!"); return false; }
	weapon.currentAmmo = weaponDef.maxAmmo;
	console.log(entity.name + " reloaded their " + weaponDef.name + "!");
	return true;
}

// === TARGETING =========================================================

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
	const canBreach  = canEntityBreach(entity);
	const range      = getEntityAttackRange(entity);

	let path = line({x: entity.x, y: entity.y}, {x: endX, y: endY});
	path = clipPathAtWall(path, canDestroy, true, canBreach);
	path = path.length > range + 1 ? path.slice(1, range + 1) : path.slice(1);

	if (path.length === 0) {
		if (canDestroy) {
			const isWall = walls.find(w => w.x === endX && w.y === endY);
			if (calc.distance(entity.x, endX, entity.y, endY) <= range && isWall) return [{x: endX, y: endY}];
		}
		if (canBreach) {
			const isWall = walls.find(w => w.x === endX && w.y === endY && w.type !== 'glass' && w.type !== 'water' && w.type !== 'fire' && w.type !== 'door');
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
	// direct / pierce / melee / standard all just use the clipped path
	return path;
}

// Returns entities that would be hit by an attack. Delegates tile calculation to
// calculateEntityTargeting so path/wall logic lives in exactly one place.
function getTargetedEntities(attacker, endX, endY) {
	const aimStyle = getWeaponAimStyle(attacker);
	const tiles    = calculateEntityTargeting(attacker, endX, endY);

	if (!tiles || tiles.length === 0) return [];

	if (aimStyle === "default" || aimStyle === "standard") {
		for (const tile of tiles) {
			const found = entities.find(e => e.hp > 0 && e.x === tile.x && e.y === tile.y);
			if (found) return [found];
		}
		return [];
	}

	if (aimStyle === "direct") {
		const cursorInPath = tiles.some(t => t.x === endX && t.y === endY);
		const atCursor = cursorInPath ? entities.find(e => e.hp > 0 && e.x === endX && e.y === endY) : null;
		if (atCursor) return [atCursor];
		for (const tile of tiles) {
			const found = entities.find(e => e.hp > 0 && e.x === tile.x && e.y === tile.y);
			if (found) return [found];
		}
		return [];
	}

	return getEntitiesInTiles(tiles);
}

function calculateGrenadeTargeting(entity, endX, endY) {
	const itemDef    = itemTypes.grenade;
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

// === ITEM ACTIONS =======================================================

function throwItem(entity, inventoryIndex, targetX, targetY) {
	const inv = getInventory(entity);
	if (inventoryIndex < 0 || inventoryIndex >= inv.length) return false;
	const item = inv[inventoryIndex];
	if (!item) return false;
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
	inv[inventoryIndex] = null;
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

function giveItem(entity, itemType) {
	const inv = getInventory(entity);
	const itemDef = itemTypes[itemType];

	// Stack consumables into an existing slot if possible
	if (itemDef.type === "consumable") {
		for (let item of inv) {
			if (item && item.itemType === itemType && !item.isLive) {
				item.quantity = (item.quantity || 1) + 1;
				console.log(entity.name + " received another " + itemDef.name);
				update();
				return true;
			}
		}
	}

	const emptySlot = findFirstEmptySlot(entity);
	if (emptySlot < 0) {
		if (isPlayerControlled(entity)) console.log("Inventory full!");
		return false;
	}

	const newItem = {itemType, id: nextItemId++};
	if (itemDef.type === "consumable") newItem.quantity = 1;
	if (itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) newItem.currentAmmo = itemDef.maxAmmo;

	inv[emptySlot] = newItem;
	console.log(entity.name + " received " + itemDef.name);

	// Enemies auto-equip equipment
	if (!isPlayerControlled(entity) && itemDef.type === "equipment") {
		if (!entity.equipment) entity.equipment = {};
		if (entity.equipment[itemDef.slot]) unequipItem(entity, itemDef.slot);
		equipItem(entity, emptySlot);
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
	const inv = getInventory(entity);

	if (isPlayerControlled(entity)) {
		const itemsAtLocation = mapItems.filter(item => item.x === x && item.y === y);
		const grenadesAtLocation = allEnemies.filter(e => helper.isGrenadeEntity(e) && e.hp > 0 && e.x === x && e.y === y);
		if (itemsAtLocation.length > 0 || grenadesAtLocation.length > 0) {
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
		const emptySlot = findFirstEmptySlot(entity);
		if (emptySlot < 0) return false;
		const pickedItem = {itemType: mostRecent.itemType, id: nextItemId++};
		if (itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) {
			pickedItem.currentAmmo = mostRecent.currentAmmo !== undefined ? mostRecent.currentAmmo : itemDef.maxAmmo;
		}
		inv[emptySlot] = pickedItem;
		entity.equipment[itemDef.slot] = pickedItem;
		applyEquipmentEffects(entity, itemDef, true);
		console.log(entity.name + " equipped " + itemDef.name);
		mapItems.splice(mapItems.indexOf(mostRecent), 1);
		return true;
	}

	if (itemDef.type === "consumable") {
		const stack = itemsAtLocation.filter(item => item.itemType === mostRecent.itemType);
		let stacked = false;
		for (let invItem of inv) {
			if (invItem && invItem.itemType === mostRecent.itemType && !invItem.isLive) {
				invItem.quantity = (invItem.quantity || 1) + stack.length;
				stacked = true;
				break;
			}
		}
		if (!stacked) {
			const emptySlot = findFirstEmptySlot(entity);
			if (emptySlot < 0) return false;
			inv[emptySlot] = {itemType: mostRecent.itemType, id: nextItemId++, quantity: stack.length};
		}
		console.log(entity.name + " picked up " + stack.length + " " + itemDef.name + (stack.length > 1 ? "s" : ""));
		for (let i = 0; i < stack.length; i++) {
			const idx = mapItems.findIndex(item => item.x === x && item.y === y && item.itemType === mostRecent.itemType);
			if (idx >= 0) mapItems.splice(idx, 1);
		}
		return true;
	}

	const emptySlot = findFirstEmptySlot(entity);
	if (emptySlot < 0) return false;
	const newItem = {itemType: mostRecent.itemType, id: mostRecent.id};
	if (itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) {
		newItem.currentAmmo = mostRecent.currentAmmo !== undefined ? mostRecent.currentAmmo : itemDef.maxAmmo;
	}
	inv[emptySlot] = newItem;
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

// Equipped items now stay in inventory; equipment[slot] just references them.
function unequipItem(entity, slot) {
	if (!entity.equipment?.[slot]) return false;
	const equippedItem = entity.equipment[slot];
	const itemDef      = itemTypes[equippedItem.itemType];
	applyEquipmentEffects(entity, itemDef, false);
	entity.equipment[slot] = null;
	console.log(entity.name + " unequipped " + itemDef.name);
	if (slot === 'weapon' && isPlayerControlled(entity)) exitSpecialMode(false);
	return true;
}

function equipItem(entity, inventoryIndex) {
	const inv = getInventory(entity);
	if (inventoryIndex < 0 || inventoryIndex >= inv.length) return false;
	const item = inv[inventoryIndex];
	if (!item) return false;
	const itemDef = itemTypes[item.itemType];
	if (!itemDef || itemDef.type !== "equipment") return false;
	if (!entity.equipment) entity.equipment = {};
	if (entity.equipment[itemDef.slot] === item) return false; // already equipped
	if (entity.equipment[itemDef.slot]) unequipItem(entity, itemDef.slot);
	entity.equipment[itemDef.slot] = item;
	applyEquipmentEffects(entity, itemDef, true);
	console.log(entity.name + " equipped " + itemDef.name);
	window.throwingGrenadeIndex = undefined;
	if (itemDef.slot === 'weapon' && isPlayerControlled(entity)) exitSpecialMode(false);
	return true;
}

function useItem(entity, inventoryIndex) {
	const inv = getInventory(entity);
	if (inventoryIndex < 0 || inventoryIndex >= inv.length) return false;
	const item = inv[inventoryIndex];
	if (!item) return false;
	const itemDef = itemTypes[item.itemType];
	if (!itemDef) return false;

	if (itemDef.type === "consumable") {
		const consume = () => {
			if (item.quantity > 1) item.quantity--;
			else inv[inventoryIndex] = null;
		};
		if (itemDef.effect === "heal") {
			entity.hp += itemDef.value;
			console.log(entity.name + " heals for " + itemDef.value + "HP!");
			consume();
		} else if (itemDef.effect === "speed") {
			entity.range += itemDef.value;
			console.log(entity.name + " feels themselves moving faster!");
			consume();
		} else if (itemDef.effect === "grenade") {
			if (item.isLive) {
				window.throwingGrenadeIndex = inventoryIndex;
				action.value = "attack";
				console.log("Select target to throw grenade (range: " + entity.attack_range + ")");
				update();
				return true;
			} else {
				if (pullGrenadePin(entity, inventoryIndex) < 0) {
					console.log("No inventory space for live grenade!");
					return false;
				}
				console.log(entity.name + " pulled the pin! Use/click to throw!");
				update();
				return true;
			}
		} else if (itemDef.effect === "key") {
			activateDoorMode(true);
			return true;
		}
		currentEntityTurnsRemaining--;
		if (specialMode === 'peek') { exitSpecialMode(); return true; }
	} else if (itemDef.type === "equipment") {
		// Toggle equip/unequip
		if (isItemEquipped(entity, item)) unequipItem(entity, itemDef.slot);
		else equipItem(entity, inventoryIndex);
	}

	update();
	return true;
}

// Drops a single inventory slot's item onto the entity's tile.
function dropInventoryItemAtSlot(entity, slotIdx) {
	const inv = getInventory(entity);
	if (slotIdx < 0 || slotIdx >= inv.length) return false;
	const item = inv[slotIdx];
	if (!item) return false;
	const itemDef = itemTypes[item.itemType];

	if (isItemEquipped(entity, item)) unequipItem(entity, itemDef.slot);

	if (item.isLive && itemDef.effect === "grenade") {
		const grenadeEntity = {
			name: "Grenade", hp: 1,
			x: entity.x, y: entity.y,
			range: 0, attack_range: 0, turns: 1,
			turnsRemaining: item.turnsRemaining,
			inventory: [], traits: ['explode', 'active']
		};
		allEnemies.push(grenadeEntity);
		console.log(entity.name + " dropped a LIVE grenade with " + item.turnsRemaining + " turns remaining!");
	} else {
		const quantity = item.quantity || 1;
		for (let i = 0; i < quantity; i++) {
			const dropped = {x: entity.x, y: entity.y, itemType: item.itemType, id: nextItemId++};
			if (item.currentAmmo !== undefined) dropped.currentAmmo = item.currentAmmo;
			mapItems.push(dropped);
		}
		console.log(entity.name + " dropped " + quantity + " " + itemDef.name + (quantity > 1 ? "s" : ""));
	}
	inv[slotIdx] = null;
	update();
	return true;
}

function processInventoryGrenades(entity) {
	const inv = getInventory(entity);
	for (let i = inv.length - 1; i >= 0; i--) {
		const item = inv[i];
		if (!item) continue;
		const itemDef = itemTypes[item.itemType];
		if (!item.isLive || itemDef?.effect !== "grenade") continue;

		item.turnsRemaining--;
		if (item.turnsRemaining <= 0) {
			inv[i] = null;
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