// ITEMS.JS: ITEM DEFINITIONS AND ITEM-RELATED FUNCTIONS

// Declare global variables at the top
var mapItems = []; // Array of items on the map: {x, y, itemType, id}
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
	}
};

function spawnItem(itemType, x, y) {
	if (!x || !y) {
		var x = player.x;
		var y = player.y;
	}
	// Use manual coordinates if provided
	if (x !== undefined && y !== undefined) {
		if (x >= 0 && x < size && y >= 0 && y < size) {
			const hasWall = walls.find(w => w.x === x && w.y === y);
			const hasEntity = allEnemies.find(e => e.hp > 0 && e.x === x && e.y === y);
			const hasPlayer = (player.x === x && player.y === y);
			const hasItem = mapItems.find(i => i.x === x && i.y === y);
			
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
	}
	
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
	
	// Auto-equip equipment for enemies if they spawn with it
	const itemDef = itemTypes[itemType];
	if (entity !== player && itemDef && itemDef.type === "equipment") {
		// Remove from inventory since we're about to equip it
		entity.inventory.pop();
		
		// Initialize equipment object if it doesn't exist
		if (!entity.equipment) {
			entity.equipment = {};
		}
		
		// Equip directly without going through inventory
		entity.equipment[itemDef.slot] = newItem;
		
		// Apply stat bonuses
		if (itemDef.effects) {
			for (let effect of itemDef.effects) {
				if (effect.stat === "attack_range") {
					entity.attack_range += effect.value;
				} else if (effect.stat === "damage") {
					if (!entity.damage) {
						entity.damage = 0;
					}
					entity.damage += effect.value;
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
	
	// Clear existing options
	itemDropdown.innerHTML = '';
	
	// Add items matching the selected category
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
	if (!entity.inventory) {
		return;
	}

	// Find all items at this location
	const itemsAtLocation = [];
	for (let i = 0; i < mapItems.length; i++) {
		if (mapItems[i].x === x && mapItems[i].y === y) {
			itemsAtLocation.push({index: i, item: mapItems[i]});
		}
	}
	
	if (itemsAtLocation.length > 0) {
		// Pick up the most recently added item (last in the array)
		const mostRecent = itemsAtLocation[itemsAtLocation.length - 1];
		const item = mostRecent.item;
		
		entity.inventory.push({
			itemType: item.itemType,
			id: item.id
		});
		
		console.log(entity.name + " picked up " + itemTypes[item.itemType].name);
		mapItems.splice(mostRecent.index, 1);
		return true;
	}
	
	return false;
}

function unequipItem(entity, slot) {
	if (!entity.equipment || !entity.equipment[slot]) {
		return false;
	}
	
	const equippedItem = entity.equipment[slot];
	const itemDef = itemTypes[equippedItem.itemType];
	
	// Remove stat bonuses
	if (itemDef.effects) {
		for (let effect of itemDef.effects) {
			if (effect.stat === "attack_range") {
				entity.attack_range -= effect.value;
			} else if (effect.stat === "damage") {
				if (entity.damage) {
					entity.damage -= effect.value;
				}
			}
		}
	}
	
	// Move back to inventory
	entity.inventory.push(equippedItem);
	entity.equipment[slot] = null;
	
	console.log(entity.name + " unequipped " + itemDef.name);
	return true;
}

function equipItem(entity, inventoryIndex) {
	if (inventoryIndex < 0 || inventoryIndex >= entity.inventory.length) {
		return false;
	}
	
	const item = entity.inventory[inventoryIndex];
	const itemDef = itemTypes[item.itemType];
	
	if (!itemDef || itemDef.type !== "equipment") {
		return false;
	}
	
	// Initialize equipment object if it doesn't exist
	if (!entity.equipment) {
		entity.equipment = {};
	}
	
	// Unequip any item in the same slot first
	if (entity.equipment[itemDef.slot]) {
		unequipItem(entity, itemDef.slot);
	}
	
	// Remove from inventory and equip
	entity.inventory.splice(inventoryIndex, 1);
	entity.equipment[itemDef.slot] = item;
	
	// Apply stat bonuses
	if (itemDef.effects) {
		for (let effect of itemDef.effects) {
			if (effect.stat === "attack_range") {
				entity.attack_range += effect.value;
			} else if (effect.stat === "damage") {
				if (!entity.damage) {
					entity.damage = 0;
				}
				entity.damage += effect.value;
			}
		}
	}
	
	console.log(entity.name + " equipped " + itemDef.name);
	return true;
}

function useItem(entity, inventoryIndex) {
	if (inventoryIndex < 0 || inventoryIndex >= entity.inventory.length) {
		return false;
	}
	
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
			// Remove consumable from inventory after use
			entity.inventory.splice(inventoryIndex, 1);
			break;
		case "equipment":
			// Equip the item instead of consuming it
			equipItem(entity, inventoryIndex);
			break;
	}
	
	update();
	return true;
}
