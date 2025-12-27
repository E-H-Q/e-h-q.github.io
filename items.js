// ITEMS.JS: ITEM DEFINITIONS AND ITEM-RELATED FUNCTIONS

var mapItems = [];
var nextItemId = 0;

var itemTypes = {
	healthPotion: {
		name: "Health Potion",
		type: "consumable",
		effect: "heal",
		value: 10,
		displayName: "HP Potion"
	},
	speedPotion: {
		name: "Speed Potion",
		type: "consumable",
		effect: "speed",
		value: 2,
		displayName: "Speed Potion"
	},
	scope: {
		name: "Scope",
		type: "equipment",
		slot: "accessory",
		effects: [
			{stat: "attack_range", value: 4}
		],
		displayName: "Scope"
	},
	breachingKit: {
		name: "Breaching Kit",
		type: "equipment",
		slot: "accessory",
		grantsDestroy: true,
		displayName: "Breaching Kit"
	},
	rifle: {
		name: "Rifle",
		type: "equipment",
		slot: "weapon",
		aimStyle: "direct",
		effects: [
			{stat: "damage", value: 3},
			{stat: "attack_range", value: 4}
		],
		displayName: "+3 Rifle"
	},
	shotgun: {
		name: "Shotgun",
		type: "equipment",
		slot: "weapon",
		aimStyle: "cone",
		spread: 3,
		effects: [
			{stat: "damage", value: 5}
		],
		displayName: "+5 Shotgun"
	},
	kevlarVest: {
		name: "Kevlar Vest",
		type: "equipment",
		slot: "armor",
		effects: [
			{stat: "armor", value: 3}
		],
		displayName: "Kevlar Vest"
	},
	rocketLauncher: {
		name: "Rocket Launcher",
		type: "equipment",
		slot: "weapon",
		aimStyle: "area",
		areaRadius: 2,
		canDestroy: true,
		effects: [{stat: "damage", value: 25},
			{stat: "attack_range", value: 3}
		],
    		displayName: "Rocket Launcher"
	},
	machinegun: {
		name: "Machine Gun",
		type: "equipment",
		slot: "weapon",
		aimStyle: "pierce",
		burst: 3,
		effects: [{stat: "damage", value: 3},
			{stat: "attack_range", value: 1}
		],
    		displayName: "Machine Gun"
	}
};

const itemLabels = {
	healthPotion: "HP+",
	speedPotion: "SP+",
	scope: "Scope",
	rifle: "Rifle",
	kevlarVest: "Vest",
	shotgun: "Shotgun",
	rocketLauncher: "RPG",
	machinegun: "SMG",
	breachingKit: "Breach"
};

function getEntityAttackRange(entity) {
	return entity.attack_range;
}

function getWeaponAimStyle(entity) {
	const style = entity.equipment?.weapon ? itemTypes[entity.equipment.weapon.itemType]?.aimStyle : null;
	return style || "standard";
}

function canEntityDestroyWalls(entity) {
	const accessoryDef = entity.equipment?.accessory ? itemTypes[entity.equipment.accessory.itemType] : null;
	const weaponDef = entity.equipment?.weapon ? itemTypes[entity.equipment.weapon.itemType] : null;
	return weaponDef?.canDestroy || accessoryDef?.grantsDestroy;
}

function getDestroyableWallsInTiles(tiles, originX, originY, canDestroy) {
	if (!canDestroy) return [];
	
	const wallsToDestroy = [];
	const checkedTiles = new Set();
	
	for (let tile of tiles) {
		const tileKey = `${tile.x},${tile.y}`;
		if (checkedTiles.has(tileKey)) continue;
		checkedTiles.add(tileKey);
		
		const rayPath = line({x: originX, y: originY}, {x: tile.x, y: tile.y});
		
		for (let i = 1; i < rayPath.length; i++) {
			const point = rayPath[i];
			const isWall = walls.find(w => w.x === point.x && w.y === point.y);
			if (isWall) {
				const wallKey = `${point.x},${point.y}`;
				if (!wallsToDestroy.some(w => `${w.x},${w.y}` === wallKey)) {
					wallsToDestroy.push({x: point.x, y: point.y});
				}
				break;
			}
		}
	}
	
	return wallsToDestroy;
}

function calculateEntityTargeting(entity, endX, endY) {
	const aimStyle = getWeaponAimStyle(entity);
	const canDestroy = canEntityDestroyWalls(entity);
	
	// Get wall-blocked path (stops at walls)
	let path = calc.los({start: {x: entity.x, y: entity.y}, end: {x: endX, y: endY}});
	if (path.length > entity.attack_range + 1) {
		path = path.slice(1, entity.attack_range + 1);
	} else {
		path = path.slice(1);
	}
	
	// If can destroy walls, check if next tile in raw path is a wall and include it
	if (canDestroy && path.length > 0) {
		const rawPath = line({x: entity.x, y: entity.y}, {x: endX, y: endY});
		const pathEnd = path[path.length - 1];
		
		// Find where we are in the raw path and check the next tile
		for (let i = 0; i < rawPath.length - 1; i++) {
			if (rawPath[i].x === pathEnd.x && rawPath[i].y === pathEnd.y) {
				const nextTile = rawPath[i + 1];
				if (nextTile && walls.find(w => w.x === nextTile.x && w.y === nextTile.y)) {
					path.push(nextTile);
				}
				break;
			}
		}
	}
	
	if (path.length === 0) return [];
	
	if (aimStyle === "cone") {
		const spread = entity.equipment?.weapon ? itemTypes[entity.equipment.weapon.itemType]?.spread || 3 : 3;
		// Use the last tile in the path as the cone endpoint (respects range limit)
		const coneEndpoint = path[path.length - 1];
		let tiles = calculateCone(path, entity.x, entity.y, coneEndpoint.x, coneEndpoint.y, entity.attack_range, spread);
		
		if (canDestroy) {
			const wallsToDestroy = getDestroyableWallsInTiles(tiles, entity.x, entity.y, canDestroy);
			return [...tiles, ...wallsToDestroy];
		}
		return tiles;
	} else if (aimStyle === "area") {
		const areaRadius = entity.equipment?.weapon ? itemTypes[entity.equipment.weapon.itemType]?.areaRadius || 2 : 2;
		const center = path[path.length - 1];
		circle(center.y, center.x, areaRadius);
		convert();
		
		const areaTiles = [];
		for (let x = Math.max(0, center.x - areaRadius - 1); x <= Math.min(size - 1, center.x + areaRadius + 1); x++) {
			for (let y = Math.max(0, center.y - areaRadius - 1); y <= Math.min(size - 1, center.y + areaRadius + 1); y++) {
				if (pts[x] && pts[x][y] === 1) {
					areaTiles.push({x, y});
				}
			}
		}

		const pathSet = new Set(path.map(p => `${p.x},${p.y}`));
		const uniqueAreaTiles = areaTiles.filter(tile => !pathSet.has(`${tile.x},${tile.y}`));
		
		const allTiles = [...path, ...uniqueAreaTiles];
		if (canDestroy) {
			const wallsToDestroy = getDestroyableWallsInTiles(allTiles, center.x, center.y, canDestroy);
			return [...allTiles, ...wallsToDestroy];
		}
		return allTiles;
	} else if (aimStyle === "pierce") {
		return path;
 	}
	
	return path;
}

function getTargetedEntities(attacker, endX, endY) {
	const aimStyle = getWeaponAimStyle(attacker);
	
	if (aimStyle === "standard") {
		let path = calc.los({start: {x: attacker.x, y: attacker.y}, end: {x: endX, y: endY}});
		path = path.length > attacker.attack_range + 1 ? path.slice(1, attacker.attack_range + 1) : path.slice(1);
		
		for (let tile of path) {
			for (let entity of entities) {
				if (entity.x === tile.x && entity.y === tile.y && entity.hp > 0) {
					return [entity];
				}
			}
		}
		return [];
	} else if (aimStyle === "area") {
		let path = calc.los({start: {x: attacker.x, y: attacker.y}, end: {x: endX, y: endY}});
		if (path.length === 0) return [];
		
		path = path.length > attacker.attack_range + 1 ? path.slice(1, attacker.attack_range + 1) : path.slice(1);
		if (path.length === 0) return [];
		
		const areaRadius = attacker.equipment?.weapon ? itemTypes[attacker.equipment.weapon.itemType]?.areaRadius || 2 : 2;
		const center = path[path.length - 1];
		circle(center.y, center.x, areaRadius);
		convert();
		
		const areaTiles = [];
		for (let x = Math.max(0, center.x - areaRadius - 1); x <= Math.min(size - 1, center.x + areaRadius + 1); x++) {
			for (let y = Math.max(0, center.y - areaRadius - 1); y <= Math.min(size - 1, center.y + areaRadius + 1); y++) {
				if (pts[x] && pts[x][y] === 1) {
					areaTiles.push({x, y});
				}
			}
		}
		
		return getEntitiesInArea(areaTiles);
	} else if (aimStyle === "pierce") {
		let path = calc.los({start: {x: attacker.x, y: attacker.y}, end: {x: endX, y: endY}});
		path = path.length > attacker.attack_range + 1 ? path.slice(1, attacker.attack_range + 1) : path.slice(1);
		return getEntitiesInPath(path);
	} else if (aimStyle === "cone") {
		let path = calc.los({start: {x: attacker.x, y: attacker.y}, end: {x: endX, y: endY}});
		path = path.length > attacker.attack_range + 1 ? path.slice(1, attacker.attack_range + 1) : path.slice(1);
		
		if (path.length === 0) return [];
		
		const spread = attacker.equipment?.weapon ? itemTypes[attacker.equipment.weapon.itemType]?.spread || 3 : 3;
		// Use the last tile in path as cone endpoint (respects range limit)
		const coneEndpoint = path[path.length - 1];
		return getEntitiesInCone(path, attacker.x, attacker.y, coneEndpoint.x, coneEndpoint.y, attacker.attack_range, spread);
	}
	
	for (let entity of entities) {
		if (entity.x === endX && entity.y === endY && entity.hp > 0) {
			return [entity];
		}
	}
	return [];
}

function spawnItem(itemType, x, y) {
	x = x || player.x;
	y = y || player.y;
	
	if (x >= 0 && x < size && y >= 0 && y < size) {
		const hasWall = walls.find(w => w.x === x && w.y === y);
		const hasEntity = allEnemies.find(e => e.hp > 0 && e.x === x && e.y === y) || (player.x === x && player.y === y ? player : null);
		
		if (hasEntity) return giveItem(hasEntity, itemType);
		
		if (!hasWall) {
			mapItems.push({x, y, itemType, id: nextItemId++});
			console.log("Spawned " + itemTypes[itemType].name + " at " + x + ", " + y);
			update();
			return true;
		}
		console.log("Invalid spawn location for item!");
	}
	return false;
}

function giveItem(entity, itemType) {
	if (!entity.inventory) entity.inventory = [];
	
	const newItem = {itemType, id: nextItemId++};
	entity.inventory.push(newItem);
	console.log(entity.name + " received " + itemTypes[itemType].name);
	
	const itemDef = itemTypes[itemType];
	if (entity !== player && itemDef?.type === "equipment") {
		entity.inventory.pop();
		if (!entity.equipment) entity.equipment = {};
		entity.equipment[itemDef.slot] = newItem;
		
		if (itemDef.effects) {
			for (let effect of itemDef.effects) {
				if (effect.stat === "attack_range") entity.attack_range += effect.value;
				else if (effect.stat === "damage") entity.damage = (entity.damage || 0) + effect.value;
				else if (effect.stat === "armor") entity.armor = (entity.armor || 0) + effect.value;
			}
		}
		console.log(entity.name + " equipped " + itemDef.name);
	}
	
	update();
	return true;
}

function spawnItemFromUI() {
	spawnItem(document.getElementById('item_type').value, 
		parseInt(document.getElementById('item_x').value), 
		parseInt(document.getElementById('item_y').value));
	document.getElementById('item_x').value = "";
	document.getElementById('item_y').value = "";
}

function updateItemDropdown() {
	const category = document.getElementById('item_category').value;
	const itemDropdown = document.getElementById('item_type');
	itemDropdown.innerHTML = '';
	
	for (let key in itemTypes) {
		if (itemTypes[key].type === category) {
			const option = document.createElement('option');
			option.value = key;
			option.textContent = itemTypes[key].name;
			itemDropdown.appendChild(option);
		}
	}
}

function pickupItem(entity, x, y) {
	if (!entity.inventory) return false;
	
	const itemsAtLocation = mapItems.map((item, index) => item.x === x && item.y === y ? {index, item} : null).filter(Boolean);
	
	if (itemsAtLocation.length > 0) {
		const mostRecent = itemsAtLocation[itemsAtLocation.length - 1];
		const itemDef = itemTypes[mostRecent.item.itemType];
		
		if (entity !== player && itemDef.type === "equipment" && shouldEnemyEquip(entity, itemDef)) {
			if (!entity.equipment) entity.equipment = {};
			if (entity.equipment[itemDef.slot]) unequipItem(entity, itemDef.slot);
			entity.equipment[itemDef.slot] = {itemType: mostRecent.item.itemType, id: mostRecent.item.id};
			applyEquipmentEffects(entity, itemDef, true);
			console.log(entity.name + " equipped " + itemDef.name);
			mapItems.splice(mostRecent.index, 1);
			return true;
		}
		
		entity.inventory.push({itemType: mostRecent.item.itemType, id: mostRecent.item.id});
		console.log(entity.name + " picked up " + itemDef.name);
		mapItems.splice(mostRecent.index, 1);
		return true;
	}
	return false;
}

function shouldEnemyEquip(entity, itemDef) {
	if (!entity.equipment) entity.equipment = {};
	const currentItem = entity.equipment[itemDef.slot];
	if (!currentItem) return true;
	
	const currentDef = itemTypes[currentItem.itemType];
	const newTotal = itemDef.effects?.reduce((sum, e) => sum + e.value, 0) || 0;
	const currentTotal = currentDef.effects?.reduce((sum, e) => sum + e.value, 0) || 0;
	return newTotal > currentTotal;
}

function applyEquipmentEffects(entity, itemDef, equip) {
	const multiplier = equip ? 1 : -1;
	if (itemDef.effects) {
		for (let effect of itemDef.effects) {
			if (effect.stat === "attack_range") entity.attack_range += effect.value * multiplier;
			else if (effect.stat === "damage") entity.damage = (entity.damage || 0) + (effect.value * multiplier);
			else if (effect.stat === "armor") entity.armor = (entity.armor || 0) + (effect.value * multiplier);
		}
	}
}

function unequipItem(entity, slot) {
	if (!entity.equipment?.[slot]) return false;
	const equippedItem = entity.equipment[slot];
	const itemDef = itemTypes[equippedItem.itemType];
	applyEquipmentEffects(entity, itemDef, false);
	entity.inventory.push(equippedItem);
	entity.equipment[slot] = null;
	console.log(entity.name + " unequipped " + itemDef.name);
	return true;
}

function equipItem(entity, inventoryIndex) {
	if (inventoryIndex < 0 || inventoryIndex >= entity.inventory.length) return false;
	const item = entity.inventory[inventoryIndex];
	const itemDef = itemTypes[item.itemType];
	if (!itemDef || itemDef.type !== "equipment") return false;
	
	if (!entity.equipment) entity.equipment = {};
	if (entity.equipment[itemDef.slot]) unequipItem(entity, itemDef.slot);
	
	entity.inventory.splice(inventoryIndex, 1);
	entity.equipment[itemDef.slot] = item;
	applyEquipmentEffects(entity, itemDef, true);
	console.log(entity.name + " equipped " + itemDef.name);
	return true;
}

function useItem(entity, inventoryIndex) {
	if (inventoryIndex < 0 || inventoryIndex >= entity.inventory.length) return false;
	const item = entity.inventory[inventoryIndex];
	const itemDef = itemTypes[item.itemType];
	if (!itemDef) return false;
	
	if (itemDef.type === "consumable") {
		if (itemDef.effect === "heal") {
			entity.hp += itemDef.value;
			console.log(entity.name + " heals for " + itemDef.value + "HP!");
		} else if (itemDef.effect === "speed") {
			entity.range += itemDef.value;
			console.log(entity.name + " feels themselves moving faster!");
		}
		entity.inventory.splice(inventoryIndex, 1);
	} else if (itemDef.type === "equipment") {
		equipItem(entity, inventoryIndex);
		if (entity === player && typeof currentEntityTurnsRemaining !== 'undefined') currentEntityTurnsRemaining++;
	}
	
	update();
	return true;
}
