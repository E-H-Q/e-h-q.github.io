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
	rifle: {
		name: "Rifle",
		type: "equipment",
		slot: "weapon",
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
		effects: [
			{stat: "damage", value: 5}
		],
		displayName: "+5 Shotgun",
		special: "cone"
	},
	kevlarVest: {
		name: "Kevlar Vest",
		type: "equipment",
		slot: "armor",
		effects: [
			{stat: "armor", value: 3}
		],
		displayName: "Kevlar Vest"
	}
};

const itemLabels = {
	healthPotion: "HP+",
	speedPotion: "SP+",
	scope: "Scope",
	rifle: "Rifle",
	kevlarVest: "Vest",
	shotgun: "Shot Gun"
};

function spawnItem(itemType, x, y) {
	if (!x || !y) {
		x = player.x;
		y = player.y;
	}
	
	if (x >= 0 && x < size && y >= 0 && y < size) {
		const hasWall = walls.find(w => w.x === x && w.y === y);
		const hasEntity = allEnemies.find(e => e.hp > 0 && e.x === x && e.y === y);
		const hasPlayer = (player.x === x && player.y === y);
		const hasItem = mapItems.find(i => i.x === x && i.y === y);

		if (hasEntity) {
			giveItem(hasEntity, itemType);
			return;
		}
	
		if (hasPlayer) {
			giveItem(player, itemType);
			return;
		}
		// combine these two if statements ^^^

		if (!hasWall) {
			const newItem = {
				x: x,
				y: y,
				itemType: itemType,
				id: nextItemId++
			};

			mapItems.push(newItem);
			console.log("Spawned " + itemTypes[itemType].name + " at " + x + ", " + y);

			update();
			return true;
		} else {
			console.log("Invalid spawn location for item!");
			return false;
		}
	}
	return false;
}

function giveItem(entity, itemType) {
	if (!entity.inventory) {
		entity.inventory = [];
	}
	
	const newItem = {
		itemType: itemType,
		id: nextItemId++
	};
	
	entity.inventory.push(newItem);
	console.log(entity.name + " received " + itemTypes[itemType].name);
	
	const itemDef = itemTypes[itemType];
	if (entity !== player && itemDef && itemDef.type === "equipment") {
		entity.inventory.pop();
		
		if (!entity.equipment) {
			entity.equipment = {};
		}
		
		entity.equipment[itemDef.slot] = newItem;
		
		if (itemDef.effects) {
			for (let effect of itemDef.effects) {
				if (effect.stat === "attack_range") {
					entity.attack_range += effect.value;
				} else if (effect.stat === "damage") {
					entity.damage = (entity.damage || 0) + effect.value;
				} else if (effect.stat === "armor") {
					entity.armor = (entity.armor || 0) + effect.value;
				}
			}
		}
		
		console.log(entity.name + " equipped " + itemDef.name);
	}
	
	update();
	return true;
}

function spawnItemFromUI() {
	const itemType = document.getElementById('item_type').value;
	const itemX = document.getElementById('item_x').value;
	const itemY = document.getElementById('item_y').value;
	
	const x = parseInt(itemX);
	const y = parseInt(itemY);
	
	spawnItem(itemType, x, y);
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

	const itemsAtLocation = [];
	for (let i = 0; i < mapItems.length; i++) {
		if (mapItems[i].x === x && mapItems[i].y === y) {
			itemsAtLocation.push({index: i, item: mapItems[i]});
		}
	}
	
	if (itemsAtLocation.length > 0) {
		const mostRecent = itemsAtLocation[itemsAtLocation.length - 1];
		const item = mostRecent.item;
		const itemDef = itemTypes[item.itemType];
		
		// Enemy auto-equips if it improves stats
		if (entity !== player && itemDef.type === "equipment") {
			if (shouldEnemyEquip(entity, itemDef)) {
				if (!entity.equipment) entity.equipment = {};
				
				// Unequip old item if present
				if (entity.equipment[itemDef.slot]) {
					unequipItem(entity, itemDef.slot);
				}
				
				// Equip new item
				entity.equipment[itemDef.slot] = {itemType: item.itemType, id: item.id};
				applyEquipmentEffects(entity, itemDef, true);
				
				console.log(entity.name + " equipped " + itemDef.name);
				mapItems.splice(mostRecent.index, 1);
				return true;
			}
		}
		
		// Player or non-beneficial equipment: add to inventory
		entity.inventory.push({itemType: item.itemType, id: item.id});
		console.log(entity.name + " picked up " + itemDef.name);
		mapItems.splice(mostRecent.index, 1);
		return true;
	}
	
	return false;
}

function shouldEnemyEquip(entity, itemDef) {
	if (!entity.equipment) entity.equipment = {};
	
	const currentItem = entity.equipment[itemDef.slot];
	if (!currentItem) return true; // Empty slot, always equip
	
	const currentDef = itemTypes[currentItem.itemType];
	
	// Compare total stat bonuses
	let newTotal = 0;
	let currentTotal = 0;
	
	if (itemDef.effects) {
		for (let effect of itemDef.effects) {
			newTotal += effect.value;
		}
	}
	
	if (currentDef.effects) {
		for (let effect of currentDef.effects) {
			currentTotal += effect.value;
		}
	}
	
	return newTotal > currentTotal;
}

function applyEquipmentEffects(entity, itemDef, equip) {
	const multiplier = equip ? 1 : -1;
	
	if (itemDef.effects) {
		for (let effect of itemDef.effects) {
			if (effect.stat === "attack_range") {
				entity.attack_range += effect.value * multiplier;
			} else if (effect.stat === "damage") {
				entity.damage = (entity.damage || 0) + (effect.value * multiplier);
			} else if (effect.stat === "armor") {
				entity.armor = (entity.armor || 0) + (effect.value * multiplier);
			}
		}
	}
}

function unequipItem(entity, slot) {
	if (!entity.equipment || !entity.equipment[slot]) return false;
	
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
	
	if (entity.equipment[itemDef.slot]) {
		unequipItem(entity, itemDef.slot);
	}
	
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
	
	switch(itemDef.type) {
		case "consumable":
			switch(itemDef.effect) {
				case "heal":
					entity.hp += itemDef.value;
					console.log(entity.name + " heals for " + itemDef.value + "HP!");
					break;
				case "speed":
					entity.range += itemDef.value;
					console.log(entity.name + " feels themselves moving faster!");
					break;
			}
			entity.inventory.splice(inventoryIndex, 1);
			break;
		case "equipment":
			equipItem(entity, inventoryIndex);
			break;
	}
	
	update();
	return true;
}
