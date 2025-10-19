// SCRIPT.JS: RUNS ALL THE FUNCTIONS IN THIER CORRECT ORDER ***THIS FILE RUNS THE WHOLE THING***

input.init(); // sets up the cursor

function updateTurnOrder() {
	var turnOrder = document.getElementById("turn-order");
	var html = '';
	
	for (let i = 0; i < entities.length; i++) {
		const entity = entities[i];
		
		// Skip enemies not in active combat (haven't seen player or player can't see them)
		if (entity !== player) {
			const hasSeenPlayer = (entity.seenX !== 0 || entity.seenY !== 0);
			const playerCanSeeEnemy = turns.playerCanSeeEnemy(entity);
			
			if (!hasSeenPlayer && !playerCanSeeEnemy) {
				continue; // Skip this enemy from turn order display
			}
		}
		
		const isActive = (i === currentEntityIndex);
		const turnsDisplay = isActive ? ` (${currentEntityTurnsRemaining}/${entity.turns})` : ` (${entity.turns})`;
		
		// Add X button for all entities except player
		const killButton = entity !== player ? 
			`<button onclick="killEntity(${i})" style="float: right; background: #ff0000; color: #fff; border: none; margin-left: 6px; cursor: pointer; position: absolute;">X</button>` : '';
		
		html += '<div class="turn-entity ' + (isActive ? 'active' : '') + '">' + 
		        entity.name.toUpperCase() + turnsDisplay + killButton + '</div>';
	}
	
	turnOrder.innerHTML = html;
}

function updateInventory() {
	var inventoryDiv = document.getElementById("inventory-items");
	var html = '';
	
	if (player.inventory.length === 0) {
		html = '<p style="color: #888;">Empty</p>';
	} else {
		for (let i = 0; i < player.inventory.length; i++) {
			const item = player.inventory[i];
			const itemDef = itemTypes[item.itemType];
			const itemTypeLabel = itemDef.type === "equipment" ? " [equip]" : "";
			html += '<div style="padding: 5px; margin: 3px 0; border: 1px solid #fff; cursor: pointer;" ' +
			        'onclick="useInventoryItem(' + i + ')" ' +
			        'oncontextmenu="dropInventoryItem(event, ' + i + ')" ' +
			        'onmouseover="this.style.backgroundColor=\'#333\'" ' +
			        'onmouseout="this.style.backgroundColor=\'transparent\'">' +
			        (i + 1) + '. ' + itemDef.displayName + itemTypeLabel + '</div>';
		}
	}
	
	inventoryDiv.innerHTML = html;
}

function useInventoryItem(inventoryIndex) {
	if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
		if (typeof useItem !== 'undefined' && useItem(player, inventoryIndex)) {
			// Item was used successfully
			currentEntityTurnsRemaining--;
			
			// If this was the player's last turn, force end of turn
			if (currentEntityTurnsRemaining <= 0) {
				currentEntityIndex++;
				if (currentEntityIndex >= entities.length) {
					currentEntityIndex = 0;
				}
				currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
			}
			update();
		}
	}
}

function dropInventoryItem(event, inventoryIndex) {
	event.preventDefault(); // Prevent context menu
	
	if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
		if (inventoryIndex >= 0 && inventoryIndex < player.inventory.length) {
			const item = player.inventory[inventoryIndex];
			const itemDef = itemTypes[item.itemType];
			
			// Drop item at player's current position
			if (typeof mapItems !== 'undefined' && typeof nextItemId !== 'undefined') {
				const droppedItem = {
					x: player.x,
					y: player.y,
					itemType: item.itemType,
					id: nextItemId++
				};
				mapItems.push(droppedItem);
				console.log(player.name + " dropped " + itemDef.name);
			}
			
			// Remove from inventory
			player.inventory.splice(inventoryIndex, 1);
			update();
		}
	}
}

function updateEquipment() {
	var equipmentDiv = document.getElementById("equipment-items");
	var html = '';
	
	if (!player.equipment) {
		player.equipment = {};
	}
	
	const slots = ["accessory"]; // Can add more slots like "weapon", "armor", etc.
	let hasEquipment = false;
	
	for (let slot of slots) {
		if (player.equipment[slot]) {
			hasEquipment = true;
			const item = player.equipment[slot];
			const itemDef = itemTypes[item.itemType];
			html += '<div class="equipment-item" onclick="unequipSlot(\'' + slot + '\')">' +
			        slot.toUpperCase() + ': ' + itemDef.displayName + 
			        ' <span style="color: #0f0;">(+' + itemDef.value + ' ' + itemDef.effect.replace('_', ' ') + ')</span>' +
			        '<br><span style="font-size: 10px; color: #888;">Click to unequip</span></div>';
		} else {
			html += '<div style="padding: 5px; margin: 3px 0; color: #888;">' +
			        slot.toUpperCase() + ': Empty</div>';
		}
	}
	
	if (!hasEquipment && slots.length === 0) {
		html = '<p style="color: #888;">No equipment slots</p>';
	}
	
	equipmentDiv.innerHTML = html;
}

function unequipSlot(slot) {
	if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
		if (typeof unequipItem !== 'undefined') {
			unequipItem(player, slot);
			update();
		}
	}
}

function killEntity(index) {
	if (index >= 0 && index < entities.length && entities[index] !== player) {
		entities[index].hp = 0;
		
		// Adjust current turn if killing an entity before current turn
		if (index < currentEntityIndex) {
			currentEntityIndex--;
		} else if (index === currentEntityIndex) {
			// If killing current entity, skip their turn
			currentEntityTurnsRemaining = 0;
		}
		
		update();
	}
}

function update() {
	// Remove dead enemies from allEnemies
	allEnemies = allEnemies.filter(enemy => enemy.hp >= 1);
	
	// Populate entities array in turn order - player first, then living enemies
	entities = [player];
	for (let i = 0; i < allEnemies.length; i++) {
		if (allEnemies[i].hp >= 1) {
			entities.push(allEnemies[i]);
		}
	}
	
	// Reset turn index if player was removed/re-added
	if (currentEntityIndex >= entities.length) {
		currentEntityIndex = 0;
		currentEntityTurnsRemaining = 0;
	}
	
	// Center camera on current entity
	const currentEntity = entities[currentEntityIndex] || player;
	camera = {
		x: currentEntity.x - Math.round((viewportSize / 2)) + 1,
		y: currentEntity.y - Math.round((viewportSize / 2)) + 1
	};
	
	canvas.init(); // creates/updates the canvas on page
	valid = [];
	canvas.clear();
	canvas.grid(); // draws the grid on canvas

	canvas.walls(); // draws the walls
	canvas.items(); // draws the items
	
	canvas.player(); // draws the player
	canvas.enemy(); // draws the enemies	

	populate.enemies();
	populate.player();
	turns.check();
	updateTurnOrder();
	updateInventory();
	updateEquipment();

	var elem = document.getElementById("log");
	elem.scrollTop = elem.scrollHeight;
}

document.getElementById("content").classList.remove("hidden"); // un-hides everything on the page
action.selectedIndex = 0; // resets the dropdown

function handleMouseMove(event) {
	if (currentEntityIndex >= 0 && entities[currentEntityIndex] !== player) {
		return; // Ignore mouse during enemy turns
	}
	input.mouse(event);
}

c.onmousemove = handleMouseMove; // mouse
cursor.addEventListener("click", input.click);
cursor.addEventListener("contextmenu", input.right_click);
document.addEventListener("keydown", input.keyboard);
document.addEventListener("keyup", input.keyboard);

var div_for_coords = document.createElement("div");
document.body.appendChild(div_for_coords);

update();
