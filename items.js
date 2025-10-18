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
	}
};

function spawnItem(itemType, x, y) {
	// Use manual coordinates if provided
	if (x !== undefined && y !== undefined) {
		if (x >= 0 && x < size && y >= 0 && y < size) {
			const hasWall = walls.find(w => w.x === x && w.y === y);
			const hasEntity = allEnemies.find(e => e.hp > 0 && e.x === x && e.y === y);
			const hasPlayer = (player.x === x && player.y === y);
			const hasItem = mapItems.find(i => i.x === x && i.y === y);
			
			if (!hasWall && !hasEntity && !hasPlayer && !hasItem) {
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
			}
		}
	}
	
	console.log("Invalid spawn location for item!");
	return false;
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

function useItem(entity, inventoryIndex) {
	if (inventoryIndex < 0 || inventoryIndex >= entity.inventory.length) {
		return false;
	}
	
	const item = entity.inventory[inventoryIndex];
	const itemDef = itemTypes[item.itemType];
	
	if (!itemDef) return false;
	
	switch(itemDef.type) {
		case "consumable":
			if (itemDef.effect === "heal") {
				entity.hp += itemDef.value;
				console.log(entity.name + " used " + itemDef.name + " and healed for " + itemDef.value + " HP!");
			}
			// Remove consumable from inventory after use
			entity.inventory.splice(inventoryIndex, 1);
			break;
	}
	
	update();
	return true;
}
