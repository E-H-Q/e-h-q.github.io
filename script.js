// SCRIPT.JS: RUNS ALL THE FUNCTIONS IN THIER CORRECT ORDER ***THIS FILE RUNS THE WHOLE THING***

input.init(); // sets up the cursor

function updateMapSize() {
	const newSize = parseInt(document.getElementById('map-size').value);
	if (newSize >= 5 && newSize <= 100) {
		size = newSize;
		resizePtsArray();
		console.log("Map size changed to " + size);
		update();
	} else {
		console.log("Invalid map size. Must be between 5 and 100.");
		document.getElementById('map-size').value = size;
	}
}

function endPlayerTurn() {
	currentEntityTurnsRemaining--;
	if (currentEntityTurnsRemaining <= 0) {
		currentEntityIndex++;
		if (currentEntityIndex >= entities.length) {
			currentEntityIndex = 0;
		}
		currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
	}
}

function updatePeekButton() {
	const peekButton = document.getElementById('peek-button');
	const isPlayerTurn = currentEntityIndex >= 0 && entities[currentEntityIndex] === player;
	const has2Turns = currentEntityTurnsRemaining >= 2;
	
	if (isPlayerTurn && has2Turns && !isPeekMode) {
		peekButton.classList.add('active');
		peekButton.disabled = false;
	} else {
		peekButton.classList.remove('active');
		peekButton.disabled = true;
	}
}

function activatePeekMode() {
	if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player && currentEntityTurnsRemaining >= 2) {
		isPeekMode = true;
		peekStep = 1;
		peekStartX = player.x;
		peekStartY = player.y;
		savedPlayerRange = player.range;
		player.range = 1;
		action.value = "move";
		action.disabled = false;
		
		update();
	}
}

function exitPeekMode() {
	if (!isPeekMode) return;
	
	if (peekStep === 1) player.range = savedPlayerRange;
	
	isPeekMode = false;
	peekStep = 0;
	action.disabled = false;
	action.value = "move";
	
	console.log("Exited peek mode.");
	update();
}

function updateTurnOrder() {
	var turnOrder = document.getElementById("turn-order");
	var html = '';
	
	for (let i = 0; i < entities.length; i++) {
		const entity = entities[i];
		
		// Only show enemies in turn order if they are aware of the player
		if (entity !== player) {
			const hasSeenPlayer = (entity.seenX !== 0 || entity.seenY !== 0);
			
			// Don't show unaware enemies in turn order
			if (!hasSeenPlayer) {
				continue;
			}
		}
		
		const isActive = (i === currentEntityIndex);
		const turnsDisplay = isActive ? ` (${currentEntityTurnsRemaining}/${entity.turns})` : ` (${entity.turns})`;
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
			endPlayerTurn();
			
			// Exit peek mode if active
			if (isPeekMode) {
				exitPeekMode();
			}
			
			update();
		}
	}
}

function dropInventoryItem(event, inventoryIndex) {
	event.preventDefault();
	
	if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
		if (inventoryIndex >= 0 && inventoryIndex < player.inventory.length) {
			const item = player.inventory[inventoryIndex];
			const itemDef = itemTypes[item.itemType];
			
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
	
	const slots = ["weapon", "armor", "accessory"];
	let hasEquipment = false;
	
	for (let slot of slots) {
		if (player.equipment[slot]) {
			hasEquipment = true;
			const item = player.equipment[slot];
			const itemDef = itemTypes[item.itemType];
			
			let effectsStr = '';
			if (itemDef.effects) {
				for (let i = 0; i < itemDef.effects.length; i++) {
					if (i > 0) effectsStr += ', ';
					effectsStr += '+' + itemDef.effects[i].value + ' ' + itemDef.effects[i].stat.replace('_', ' ');
				}
			}
			
			if (itemDef.grantsDestroy) {
				if (effectsStr) effectsStr += ', ';
				effectsStr += 'Attacks destroy terrain';
			}
			
			html += '<div class="equipment-item" onclick="unequipSlot(\'' + slot + '\')">' +
			        slot.toUpperCase() + ': ' + itemDef.displayName + '<br>' +
			        ' <span style="color: #0f0;">(' + effectsStr + ')</span>' +
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
		
		if (index < currentEntityIndex) {
			currentEntityIndex--;
		} else if (index === currentEntityIndex) {
			currentEntityTurnsRemaining = 0;
		}
		
		update();
	}
}

function update() {
	allEnemies = allEnemies.filter(enemy => enemy.hp >= 1);
	
	entities = [player];
	for (let i = 0; i < allEnemies.length; i++) {
		if (allEnemies[i].hp >= 1) {
			entities.push(allEnemies[i]);
		}
	}
	
	if (currentEntityIndex >= entities.length) {
		currentEntityIndex = 0;
		currentEntityTurnsRemaining = 0;
	}
	
	const currentEntity = entities[currentEntityIndex] || player;
	camera = {
		x: currentEntity.x - Math.round((viewportSize / 2)) + 1,
		y: currentEntity.y - Math.round((viewportSize / 2)) + 1
	};
	
	canvas.init();
	valid = [];
	canvas.clear();
	canvas.grid();
	canvas.walls();
	canvas.items();
	canvas.drawOnionskin();
	canvas.player();
	canvas.enemy();

	populate.reset();
	populate.enemies();
	populate.player();
	turns.check();
	
	// Draw path in move mode when it's the player's turn
	// Only calculate if cursor position exists and hasn't been calculated this frame
	if (currentEntity === player && action.value === "move" && window.cursorWorldPos) {
		const endX = window.cursorWorldPos.x;
		const endY = window.cursorWorldPos.y;
		
		// Check if cursor is within valid movement range
		const isValid = valid.find(v => v.x === endX && v.y === endY);
		
		if (isValid && endX >= 0 && endX < size && endY >= 0 && endY < size) {
			// Recalculate graph every time to ensure accuracy
			circle(player.y, player.x, player.range);
			convert();
			
			if (pts && pts[player.x] && pts[player.y] && pts[endX] && pts[endY]) {
				const graph = new Graph(pts, {diagonal: true});
				
				// Block other entities
				entities.forEach(e => {
					if (e !== player && e.hp > 0 && pts[e.x]?.[e.y] !== undefined) {
						pts[e.x][e.y] = 0;
					}
				});
				
				const pathResult = astar.search(graph, graph.grid[player.x][player.y], graph.grid[endX][endY]);
				
				if (pathResult && pathResult.length > 0) {
					canvas.path(pathResult);
				}
			}
		}
	}
	
	updateTurnOrder();
	updateInventory();
	updateEquipment();
	updatePeekButton();

	var elem = document.getElementById("log");
	elem.scrollTop = elem.scrollHeight;
}

document.getElementById("content").classList.remove("hidden");
action.selectedIndex = 0;

document.getElementById('item_category').value = 'consumable';
updateItemDropdown();

function handleMouseMove(event) {
	if (currentEntityIndex >= 0 && entities[currentEntityIndex] !== player) {
		return;
	}
	input.mouse(event);
}

c.onmousemove = handleMouseMove;
cursor.addEventListener("click", input.click);
cursor.addEventListener("mousedown", input.mousedown);
cursor.addEventListener("contextmenu", input.right_click);
document.addEventListener("mouseup", input.mouseup);
document.addEventListener("keydown", input.keyboard);
document.addEventListener("keyup", input.keyboard);

var div_for_coords = document.createElement("div");
document.body.appendChild(div_for_coords);

document.getElementById('map-size').value = size;

update();
