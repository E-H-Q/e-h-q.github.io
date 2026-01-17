// ITEMS.JS: ITEM DEFINITIONS AND ITEM-RELATED FUNCTIONS

var mapItems = [];
var nextItemId = 0;
var maxInventorySlots = 10;
var maxStackSize = 10;

// Consumables data
const consumablesData = {
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
    grenade: {
        name: "Grenade",
        type: "consumable",
        effect: "grenade",
        damageRadius: 2,
        damage: 15,
        canDestroy: true,
        fuse: 2,
        displayName: "Grenade"
    }
};

// Weapons data
const weaponsData = {
    knife: {
        name: "Knife",
        type: "equipment",
        slot: "weapon",
        aimStyle: "melee",
        effects: [
            {stat: "damage", value: 7}
        ],
        displayName: "+7 Knife"
    },
    rifle: {
        name: "Rifle",
        type: "equipment",
        slot: "weapon",
        aimStyle: "direct",
        maxAmmo: 6,
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
        maxAmmo: 2,
        effects: [
            {stat: "damage", value: 5}
        ],
        displayName: "+5 Shotgun"
    },
    rocketLauncher: {
        name: "Rocket Launcher",
        type: "equipment",
        slot: "weapon",
        aimStyle: "area",
        areaRadius: 2,
        canDestroy: true,
        maxAmmo: 1,
        effects: [
            {stat: "damage", value: 25},
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
        maxAmmo: 3,
        effects: [
            {stat: "damage", value: 3},
            {stat: "attack_range", value: 1}
        ],
        displayName: "Machine Gun"
    }
};

// Equipment data (armor & accessories)
const equipmentData = {
    kevlarVest: {
        name: "Kevlar Vest",
        type: "equipment",
        slot: "armor",
        effects: [
            {stat: "armor", value: 3}
        ],
        displayName: "Kevlar Vest"
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
    }
};

// Combine all item types
var itemTypes = {...consumablesData, ...weaponsData, ...equipmentData};
var itemsLoaded = true;

const itemLabels = {
    healthPotion: "HP+",
    speedPotion: "SP+",
    grenade: "Gnade",
    scope: "Scope",
    rifle: "Rifle",
    kevlarVest: "Vest",
    shotgun: "Shotgun",
    rocketLauncher: "RPG",
    machinegun: "SMG",
    breachingKit: "Breach",
    knife: "Knife"
};

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

function getEntityAttackRange(entity) {
    const weaponDef = entity.equipment?.weapon ? itemTypes[entity.equipment.weapon.itemType] : null;

    if (weaponDef?.aimStyle === "melee") {
        return 1;
    }

    return entity.attack_range;
}

function hasAmmo(entity) {
    if (!entity.equipment?.weapon) return true;
    const weapon = entity.equipment.weapon;
    const weaponDef = itemTypes[weapon.itemType];
    
    if (weaponDef.maxAmmo === undefined) return true;
    
    if (weapon.currentAmmo === undefined) {
        weapon.currentAmmo = weaponDef.maxAmmo;
    }
    
    return weapon.currentAmmo > 0;
}

function consumeAmmo(entity) {
    if (!entity.equipment?.weapon) return;
    const weapon = entity.equipment.weapon;
    const weaponDef = itemTypes[weapon.itemType];
    
    if (weaponDef.maxAmmo === undefined) return;
    
    if (weapon.currentAmmo === undefined) {
        weapon.currentAmmo = weaponDef.maxAmmo;
    }
    
    weapon.currentAmmo = Math.max(0, weapon.currentAmmo - 1);
}

function reloadWeapon(entity) {
    if (!entity.equipment?.weapon) return false;
    const weapon = entity.equipment.weapon;
    const weaponDef = itemTypes[weapon.itemType];
    
    if (weaponDef.maxAmmo === undefined) {
        console.log(entity.name + "'s weapon doesn't need reloading!");
        return false;
    }
    
    if (weapon.currentAmmo === undefined) {
        weapon.currentAmmo = weaponDef.maxAmmo;
    }
    
    if (weapon.currentAmmo >= weaponDef.maxAmmo) {
        console.log(entity.name + "'s weapon is already fully loaded!");
        return false;
    }
    
    weapon.currentAmmo = weaponDef.maxAmmo;
    console.log(entity.name + " reloaded their " + weaponDef.name + "!");
    return true;
}

function calculateEntityTargeting(entity, endX, endY) {
    const aimStyle = getWeaponAimStyle(entity);
    const canDestroy = canEntityDestroyWalls(entity);
    const effectiveRange = getEntityAttackRange(entity);

    let path = line({x: entity.x, y: entity.y}, {x: endX, y: endY});
    
    if (!canDestroy) {
        for (let i = 1; i < path.length; i++) {
            const wall = walls.find(w => w.x === path[i].x && w.y === path[i].y);
            if (wall && wall.type !== 'glass') {
                path = path.slice(0, i);
                break;
            }
        }
    }
    
    if (path.length > effectiveRange + 1) {
        path = path.slice(1, effectiveRange + 1);
    } else {
        path = path.slice(1);
    }

    if (path.length === 0) {
        if (canDestroy) {
            const dist = calc.distance(entity.x, endX, entity.y, endY);
            const isWall = walls.find(w => w.x === endX && w.y === endY);
            if (dist <= effectiveRange && isWall) {
                return [{x: endX, y: endY}];
            }
        }
        return [];
    }

    if (aimStyle === "cone") {
        const spread = entity.equipment?.weapon ? itemTypes[entity.equipment.weapon.itemType]?.spread || 3 : 3;
        
        let tiles = calculateCone(path, entity.x, entity.y, endX, endY, effectiveRange, spread);

        if (canDestroy) {
            const wallsToDestroy = [];
            const checkedWalls = new Set();
            
            for (let tile of tiles) {
                const isWall = walls.find(w => w.x === tile.x && w.y === tile.y);
                if (isWall) {
                    const wallKey = `${tile.x},${tile.y}`;
                    if (!checkedWalls.has(wallKey)) {
                        checkedWalls.add(wallKey);
                        wallsToDestroy.push({x: tile.x, y: tile.y});
                    }
                }
            }
            
            const tileSet = new Set(tiles.map(t => `${t.x},${t.y}`));
            const uniqueWalls = wallsToDestroy.filter(w => !tileSet.has(`${w.x},${w.y}`));
            return [...tiles, ...uniqueWalls];
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
    } else if (aimStyle === "melee") {
        return path;
     }

    return path;
}

function getTargetedEntities(attacker, endX, endY) {
    const aimStyle = getWeaponAimStyle(attacker);
    const effectiveRange = getEntityAttackRange(attacker);

    if (aimStyle === "standard" || aimStyle === "melee") {
        let path = line({x: attacker.x, y: attacker.y}, {x: endX, y: endY});
        
        for (let i = 1; i < path.length; i++) {
            const wall = walls.find(w => w.x === path[i].x && w.y === path[i].y);
            if (wall && wall.type !== 'glass') {
                path = path.slice(0, i);
                break;
            }
        }
        
        path = path.length > effectiveRange + 1 ? path.slice(1, effectiveRange + 1) : path.slice(1);

        for (let tile of path) {
            for (let entity of entities) {
                if (entity.x === tile.x && entity.y === tile.y && entity.hp > 0) {
                    return [entity];
                }
            }
        }
        return [];
    } else if (aimStyle === "area") {
        let path = line({x: attacker.x, y: attacker.y}, {x: endX, y: endY});
        
        const canDestroy = canEntityDestroyWalls(attacker);
        if (!canDestroy) {
            for (let i = 1; i < path.length; i++) {
                const wall = walls.find(w => w.x === path[i].x && w.y === path[i].y);
                if (wall && wall.type !== 'glass') {
                    path = path.slice(0, i);
                    break;
                }
            }
        }
        
        if (path.length === 0) return [];

        path = path.length > effectiveRange + 1 ? path.slice(1, effectiveRange + 1) : path.slice(1);
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
        let path = line({x: attacker.x, y: attacker.y}, {x: endX, y: endY});
        
        for (let i = 1; i < path.length; i++) {
            const wall = walls.find(w => w.x === path[i].x && w.y === path[i].y);
            if (wall && wall.type !== 'glass') {
                path = path.slice(0, i);
                break;
            }
        }
        
        path = path.length > effectiveRange + 1 ? path.slice(1, effectiveRange + 1) : path.slice(1);
        return getEntitiesInPath(path);
    } else if (aimStyle === "cone") {
        let path = line({x: attacker.x, y: attacker.y}, {x: endX, y: endY});
        
        for (let i = 1; i < path.length; i++) {
            const wall = walls.find(w => w.x === path[i].x && w.y === path[i].y);
            if (wall && wall.type !== 'glass') {
                path = path.slice(0, i);
                break;
            }
        }
        
        path = path.length > effectiveRange + 1 ? path.slice(1, effectiveRange + 1) : path.slice(1);

        if (path.length === 0) return [];

        const spread = attacker.equipment?.weapon ? itemTypes[attacker.equipment.weapon.itemType]?.spread || 3 : 3;
        return getEntitiesInCone(path, attacker.x, attacker.y, endX, endY, effectiveRange, spread);
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
	const itemDef = itemTypes[itemType];
	
	if (itemDef.type === "consumable") {
		for (let item of entity.inventory) {
			if (item.itemType === itemType && (item.quantity || 1) < maxStackSize) {
				item.quantity = (item.quantity || 1) + 1;
				console.log(entity.name + " received another " + itemDef.name);
				update();
				return true;
			}
		}
	}
	
	if (entity === player && entity.inventory.length >= maxInventorySlots) {
		console.log("Inventory full!");
		return false;
	}

	const newItem = {itemType, id: nextItemId++};
	if (itemDef.type === "consumable") {
		newItem.quantity = 1;
	}
	
	if (itemDef.type === "equipment" && itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) {
		newItem.currentAmmo = itemDef.maxAmmo;
	}
	
	entity.inventory.push(newItem);
	console.log(entity.name + " received " + itemDef.name);

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

		if (itemDef.aimStyle === "melee") {
			entity.attack_range = 1;
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
		const itemDef = itemTypes[key];
		let matches = false;
		
		if (category === "consumables" && itemDef.type === "consumable") {
			matches = true;
		} else if (category === "weapons" && itemDef.type === "equipment" && itemDef.slot === "weapon") {
			matches = true;
		} else if (category === "equipment" && itemDef.type === "equipment" && itemDef.slot !== "weapon") {
			matches = true;
		}
		
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

	const itemsAtLocation = mapItems.map((item, index) => item.x === x && item.y === y ? {index, item} : null).filter(Boolean);

	if (itemsAtLocation.length > 0) {
		const mostRecent = itemsAtLocation[itemsAtLocation.length - 1];
		const itemDef = itemTypes[mostRecent.item.itemType];

		if (entity !== player && itemDef.type === "equipment" && shouldEnemyEquip(entity, itemDef)) {
			if (!entity.equipment) entity.equipment = {};
			if (entity.equipment[itemDef.slot]) unequipItem(entity, itemDef.slot);
			
			const pickedItem = {itemType: mostRecent.item.itemType, id: mostRecent.item.id};
			if (itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) {
				pickedItem.currentAmmo = itemDef.maxAmmo;
			}
			
			entity.equipment[itemDef.slot] = pickedItem;
			applyEquipmentEffects(entity, itemDef, true);
			console.log(entity.name + " equipped " + itemDef.name);
			mapItems.splice(mostRecent.index, 1);
			return true;
		}

		if (itemDef.type === "consumable") {
			for (let item of entity.inventory) {
				if (item.itemType === mostRecent.item.itemType && (item.quantity || 1) < maxStackSize) {
					item.quantity = (item.quantity || 1) + 1;
					console.log(entity.name + " picked up another " + itemDef.name);
					mapItems.splice(mostRecent.index, 1);
					return true;
				}
			}
		}
		
		if (entity === player && entity.inventory.length >= maxInventorySlots) {
			console.log("Inventory full!");
			return false;
		}

		const newItem = {itemType: mostRecent.item.itemType, id: mostRecent.item.id};
		if (itemDef.type === "consumable") {
			newItem.quantity = 1;
		}
		
		if (itemDef.type === "equipment" && itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) {
			newItem.currentAmmo = itemDef.maxAmmo;
		}
		
		entity.inventory.push(newItem);
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
			
			if (item.quantity && item.quantity > 1) {
				item.quantity--;
			} else {
				entity.inventory.splice(inventoryIndex, 1);
			}
		} else if (itemDef.effect === "speed") {
			entity.range += itemDef.value;
			console.log(entity.name + " feels themselves moving faster!");
			
			if (item.quantity && item.quantity > 1) {
				item.quantity--;
			} else {
				entity.inventory.splice(inventoryIndex, 1);
			}
		} else if (itemDef.effect === "grenade") {
			// Separate one grenade from stack and activate it
			if (item.quantity && item.quantity > 1) {
				item.quantity--;
			} else {
				entity.inventory.splice(inventoryIndex, 1);
			}
			
			// Create new live grenade item in inventory
			const liveGrenade = {
				itemType: 'grenade',
				id: nextItemId++,
				isLive: true,
				turnsRemaining: itemDef.fuse,
				quantity: 1
			};
			entity.inventory.push(liveGrenade);
			
			console.log(entity.name + " activated a grenade! " + itemDef.fuse + " turns until detonation!");
			update();
			return true;
		}

		currentEntityTurnsRemaining--;
		if (isPeekMode) {
			exitPeekMode();
			return;
		}
	} else if (itemDef.type === "equipment") {
		equipItem(entity, inventoryIndex);
	}

	update();
	return true;
}

function detonateGrenade(grenade, x, y) {
	const itemDef = itemTypes.grenade;
	const explodeX = x !== undefined ? x : grenade.x;
	const explodeY = y !== undefined ? y : grenade.y;
	
	console.log("GRENADE EXPLODES at " + explodeX + ", " + explodeY + "!");
	
	circle(explodeY, explodeX, itemDef.damageRadius);
	convert();
	
	const explosionTiles = [];
	for (let tx = Math.max(0, explodeX - itemDef.damageRadius - 1); tx <= Math.min(size - 1, explodeX + itemDef.damageRadius + 1); tx++) {
		for (let ty = Math.max(0, explodeY - itemDef.damageRadius - 1); ty <= Math.min(size - 1, explodeY + itemDef.damageRadius + 1); ty++) {
			if (pts[tx] && pts[tx][ty] === 1) {
				explosionTiles.push({x: tx, y: ty});
			}
		}
	}
	
	// Damage entities
	for (let tile of explosionTiles) {
		for (let entity of entities) {
			if (entity.x === tile.x && entity.y === tile.y && entity.hp > 0 && !entity.isGrenade) {
				const armor = entity.armor || 0;
				const dmg = Math.max(1, itemDef.damage - armor);
				entity.hp -= dmg;
				console.log(entity.name + " takes " + dmg + " damage from explosion!");
			}
		}
	}
	
	// Destroy walls in explosion radius
	if (itemDef.canDestroy) {
    	for (let tx = Math.max(0, explodeX - itemDef.damageRadius); tx <= Math.min(size - 1, explodeX + itemDef.damageRadius); tx++) {
    	    for (let ty = Math.max(0, explodeY - itemDef.damageRadius); ty <= Math.min(size - 1, explodeY + itemDef.damageRadius); ty++) {
    	        const dist = Math.sqrt((tx - explodeX) ** 2 + (ty - explodeY) ** 2);
    	        if (dist <= itemDef.damageRadius) {
    	            for (let i = walls.length - 1; i >= 0; i--) {
    	                if (walls[i].x === tx && walls[i].y === ty) {
    	                    //console.log("Grenade destroyed wall at " + tx + ", " + ty);
    	                    walls.splice(i, 1);
    	                    break;
    	                }
    	            }
    	        }
    	    }
    	}
	}
	
	if (grenade && grenade.hp !== undefined) {
		grenade.hp = 0;
	}
}

function processInventoryGrenades(entity) {
	if (!entity.inventory) return;
	
	for (let i = entity.inventory.length - 1; i >= 0; i--) {
		const item = entity.inventory[i];
		const itemDef = itemTypes[item.itemType];
		
		if (item.isLive && itemDef && itemDef.effect === "grenade") {
			item.turnsRemaining--;
			console.log(entity.name + "'s inventory grenade: " + item.turnsRemaining + " turns remaining");
			
			if (item.turnsRemaining <= 0) {
				entity.inventory.splice(i, 1);
				detonateGrenade(null, entity.x, entity.y);
			}
		}
	}
}
