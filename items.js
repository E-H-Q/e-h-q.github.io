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
		effect: "attack_range",
		value: 4,
		displayName: "Scope"
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

function pickupItem(entity, x, y) {
	const itemIndex = mapItems.findIndex(i => i.x === x && i.y === y);
	
	if (!entity.inventory) {
		return;
	}

	if (itemIndex >= 0) {
		const item = mapItems[itemIndex];
		entity.inventory.push({
			itemType: item.itemType,
			id: item.id
		});
		
		console.log(entity.name + " picked up " + itemTypes[item.itemType].name);
		mapItems.splice(itemIndex, 1);
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
	if (itemDef.effect === "attack_range") {
		entity.attack_range -= itemDef.value;
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
	if (itemDef.effect === "attack_range") {
		entity.attack_range += itemDef.value;
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
