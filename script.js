// SCRIPT.JS: RUNS ALL THE FUNCTIONS IN THIER CORRECT ORDER ***THIS FILE RUNS THE WHOLE THING***

input.init();

document.getElementById("content").classList.remove("hidden");
action.selectedIndex = 0;

document.getElementById('item_category').value = 'consumables';
updateItemDropdown();

document.getElementById('map-size').value = size;

update();

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
		if (!isPeekMode) {
			isPeekMode = true;
			peekStep = 1;
			peekStartX = player.x;
			peekStartY = player.y;
			savedPlayerRange = player.range;
			player.range = Math.floor(player.range / 2);
			action.value = "move";
			action.disabled = false;
		}
		
		update();
	}
}

function exitPeekMode() {
	if (!isPeekMode) return;
	
	if (peekStep === 1) player.range = savedPlayerRange;
	
	isPeekMode = false;
	peekStep = 1;
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
		
		if (entity !== player) {
			const hasSeenPlayer = (entity.seenX !== 0 || entity.seenY !== 0);
			
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
			
			let displayName = itemDef.displayName;
			let quantityLabel = "";
			
			// Special handling for live grenades
			if (item.isLive && itemDef.effect === "grenade") {
				displayName = "*!!!* Grenade: (" + item.turnsRemaining + "/" + itemDef.fuse + ")";
			} else if (item.quantity > 1) {
				quantityLabel = "(" + item.quantity + ") ";
			}
			
			const slotNumber = i === 9 ? 0 : i + 1;
			html += '<div style="padding: 5px; margin: 3px 0; border: 1px solid #fff; cursor: pointer;" ' +
			        'onclick="useInventoryItem(' + i + ')" ' +
			        'oncontextmenu="dropInventoryItem(event, ' + i + ')" ' +
			        'onmouseover="this.style.backgroundColor=\'#333\'" ' +
			        'onmouseout="this.style.backgroundColor=\'transparent\'">' +
			        slotNumber + '. ' + quantityLabel + displayName + itemTypeLabel + '</div>';
		}
	}
	
	inventoryDiv.innerHTML = html;
}

function useInventoryItem(inventoryIndex) {
	if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
		if (typeof useItem !== 'undefined') {
			useItem(player, inventoryIndex)
		}
	}
}

function dropInventoryItem(event, inventoryIndex) {
	event.preventDefault();
	
	if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
		if (inventoryIndex >= 0 && inventoryIndex < player.inventory.length) {
			const item = player.inventory[inventoryIndex];
			const itemDef = itemTypes[item.itemType];
			const quantity = item.quantity || 1;
			
			if (typeof mapItems !== 'undefined' && typeof nextItemId !== 'undefined') {
				// Special handling for live grenades - create grenade entity
				if (item.isLive && itemDef.effect === "grenade") {
					const grenadeEntity = {
						name: "Grenade",
						hp: 1,
						x: player.x,
						y: player.y,
						range: 0,
						attack_range: 0,
						turns: 1,
						isGrenade: true,
						turnsRemaining: item.turnsRemaining,
						seenX: 0,
						seenY: 0,
						inventory: []
					};
					
					allEnemies.push(grenadeEntity);
					console.log(player.name + " dropped a LIVE grenade with " + item.turnsRemaining + " turns remaining!");
					player.inventory.splice(inventoryIndex, 1);
				} else {
					// Normal drop behavior
					for (var i = 0; i < quantity; i++) {
						const droppedItem = {
							x: player.x,
							y: player.y,
							itemType: item.itemType,
							id: nextItemId++
						};
						mapItems.push(droppedItem);
					}
					console.log(player.name + " dropped " + quantity + " " + itemDef.name);
					player.inventory.splice(inventoryIndex, 1);
				}
			}
			
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
			
			let ammoStr = '';
			if (slot === "weapon" && itemDef.maxAmmo !== undefined) {
				const currentAmmo = item.currentAmmo !== undefined ? item.currentAmmo : itemDef.maxAmmo;
				ammoStr = '<br><span style="color: ' + (currentAmmo === 0 ? '#ff0000' : '#ffff00') + ';">Ammo: ' + currentAmmo + '/' + itemDef.maxAmmo + '</span>';
			}
			
			html += '<div class="equipment-item" onclick="unequipSlot(\'' + slot + '\')">' +
			        slot.toUpperCase() + ': ' + itemDef.displayName + '<br>' +
			        '<span style="color: #0f0;">(' + effectsStr + ')</span>' +
			        ammoStr +
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

function generateDungeon() {
	const numRooms = parseInt(document.getElementById('dungeon_rooms').value) || 15;
	const numHallways = parseInt(document.getElementById('dungeon_hallways').value) || 14;
	const minSize = parseInt(document.getElementById('dungeon_min_size').value) || 7;
	const maxSize = parseInt(document.getElementById('dungeon_max_size').value) || 13;
	const coverPercent = parseInt(document.getElementById('dungeon_cover').value) || 20;
	
	randomFloor(numRooms, numHallways, minSize, maxSize, coverPercent);
}

function randomFloor(numRooms, numHallways, minRoomSize, maxRoomSize, coverPercent) {
	// Clear existing walls and items
	walls = [];
	mapItems = [];
	allEnemies = [];
	
	const rooms = [];
	const maxAttempts = 500;
	
	// Generate rooms with random placement
	for (let i = 0; i < numRooms; i++) {
		let placed = false;
		
		for (let attempt = 0; attempt < maxAttempts && !placed; attempt++) {
			const w = Math.floor(Math.random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
			const h = Math.floor(Math.random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
			const x = Math.floor(Math.random() * (size - w - 4)) + 2;
			const y = Math.floor(Math.random() * (size - h - 4)) + 2;
			
			const newRoom = {x, y, w, h};
			
			// Check if room overlaps with existing rooms (with 1 tile buffer)
			let overlap = false;
			for (let room of rooms) {
				if (!(newRoom.x + newRoom.w + 1 < room.x || newRoom.x > room.x + room.w + 1 ||
				      newRoom.y + newRoom.h + 1 < room.y || newRoom.y > room.y + room.h + 1)) {
					overlap = true;
					break;
				}
			}
			
			if (!overlap) {
				rooms.push(newRoom);
				placed = true;
			}
		}
	}
	
	// Fill map with walls
	for (let x = 0; x < size; x++) {
		for (let y = 0; y < size; y++) {
			walls.push({x, y, type: 'wall'});
		}
	}
	
	// Carve out rooms
	for (let room of rooms) {
		for (let x = room.x; x < room.x + room.w; x++) {
			for (let y = room.y; y < room.y + room.h; y++) {
				const idx = walls.findIndex(w => w.x === x && w.y === y);
				if (idx >= 0) walls.splice(idx, 1);
			}
		}
	}
	
	// Create multiple hallways connecting random rooms
	for (let i = 0; i < numHallways && rooms.length > 1; i++) {
		const r1 = rooms[Math.floor(Math.random() * rooms.length)];
		const r2 = rooms[Math.floor(Math.random() * rooms.length)];
		
		if (r1 === r2) continue;
		
		const c1x = Math.floor(r1.x + r1.w / 2);
		const c1y = Math.floor(r1.y + r1.h / 2);
		const c2x = Math.floor(r2.x + r2.w / 2);
		const c2y = Math.floor(r2.y + r2.h / 2);
		
		// L-shaped corridor
		if (Math.random() > 0.5) {
			// Horizontal then vertical
			const xStart = Math.min(c1x, c2x);
			const xEnd = Math.max(c1x, c2x);
			for (let x = xStart; x <= xEnd; x++) {
				let idx = walls.findIndex(w => w.x === x && w.y === c1y);
				if (idx >= 0) walls.splice(idx, 1);
			}
			const yStart = Math.min(c1y, c2y);
			const yEnd = Math.max(c1y, c2y);
			for (let y = yStart; y <= yEnd; y++) {
				let idx = walls.findIndex(w => w.x === c2x && w.y === y);
				if (idx >= 0) walls.splice(idx, 1);
			}
		} else {
			// Vertical then horizontal
			const yStart = Math.min(c1y, c2y);
			const yEnd = Math.max(c1y, c2y);
			for (let y = yStart; y <= yEnd; y++) {
				let idx = walls.findIndex(w => w.x === c1x && w.y === y);
				if (idx >= 0) walls.splice(idx, 1);
			}
			const xStart = Math.min(c1x, c2x);
			const xEnd = Math.max(c1x, c2x);
			for (let x = xStart; x <= xEnd; x++) {
				let idx = walls.findIndex(w => w.x === x && w.y === c2y);
				if (idx >= 0) walls.splice(idx, 1);
			}
		}
	}
	
	// Add cover (pillars and L-shaped wall clusters) to rooms
	if (coverPercent > 0) {
		for (let room of rooms) {
			// Calculate how many cover pieces to add based on room size and percentage
			const roomArea = (room.w - 2) * (room.h - 2); // Interior area
			const numCoverPieces = Math.floor((roomArea * coverPercent) / 100 / 2); // Divide by 2 since L-shapes take ~2 tiles
			
			for (let i = 0; i < numCoverPieces; i++) {
				// Randomly choose between pillar or L-shape
				if (Math.random() > 0.5) {
					// Single pillar
					const px = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
					const py = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
					
					// Check if location is not already a wall
					if (!walls.find(w => w.x === px && w.y === py)) {
						walls.push({x: px, y: py, type: 'wall'});
					}
				} else {
					// 2x2 L-shaped cluster
					const px = room.x + 1 + Math.floor(Math.random() * (room.w - 3));
					const py = room.y + 1 + Math.floor(Math.random() * (room.h - 3));
					
					// Random L-shape orientation (4 possible rotations)
					const orientation = Math.floor(Math.random() * 4);
					const lShapes = [
						[{x: 0, y: 0}, {x: 1, y: 0}, {x: 0, y: 1}], // ┐
						[{x: 0, y: 0}, {x: 0, y: 1}, {x: 1, y: 1}], // ┌
						[{x: 1, y: 0}, {x: 0, y: 1}, {x: 1, y: 1}], // ┘
						[{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}]  // └
					];
					
					const shape = lShapes[orientation];
					for (let tile of shape) {
						const wx = px + tile.x;
						const wy = py + tile.y;
						
						// Check if location is valid and not already a wall
						if (wx >= room.x + 1 && wx < room.x + room.w - 1 &&
						    wy >= room.y + 1 && wy < room.y + room.h - 1 &&
						    !walls.find(w => w.x === wx && w.y === wy)) {
							walls.push({x: wx, y: wy, type: 'wall'});
						}
					}
				}
			}
		}
	}
	
	// Place player in first room
	if (rooms.length > 0) {
		player.x = Math.floor(rooms[0].x + rooms[0].w / 2);
		player.y = Math.floor(rooms[0].y + rooms[0].h / 2);
	}
	
	update();
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
	canvas.items();
	canvas.walls();
	canvas.drawOnionskin();
	canvas.player();
	
	// Update enemy LOS states BEFORE drawing them
	if (currentEntity === player && typeof turns !== 'undefined' && turns.checkEnemyLOS) {
		turns.checkEnemyLOS();
	}
	
	canvas.enemy();

	populate.reset();
	populate.enemies();
	populate.player();
	turns.check();
	
	// Show grenade throw area preview
	if (currentEntity === player && action.value === "attack" && window.cursorWorldPos && window.throwingGrenadeIndex !== undefined) {
		const grenadeTargeting = calculateGrenadeTargeting(player, window.cursorWorldPos.x, window.cursorWorldPos.y);
		if (grenadeTargeting.length > 0) {
			canvas.los(grenadeTargeting);
		}
	}
	canvas.drawGrenades();
	canvas.cursor();
	
	updateTurnOrder();
	updateInventory();
	updateEquipment();
	updatePeekButton();

	var elem = document.getElementById("log");
	elem.scrollTop = elem.scrollHeight;
}

action.selectedIndex = 0;

function handleMouseMove(event) {
	if (player.hp < 1) return;
	if (currentEntityIndex >= 0 && entities[currentEntityIndex] !== player) {
		return;
	}
	input.mouse(event);
}

c.onmousemove = handleMouseMove;
c.addEventListener("click", input.click);
c.addEventListener("mousedown", input.mousedown);
c.addEventListener("contextmenu", input.right_click);
document.addEventListener("mouseup", input.mouseup);
document.addEventListener("keydown", input.keyboard);
document.addEventListener("keyup", input.keyboard);

var div_for_coords = document.createElement("div");
document.body.appendChild(div_for_coords);
