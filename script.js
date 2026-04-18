// SCRIPT.JS: RUNS ALL THE FUNCTIONS IN THEIR CORRECT ORDER ***THIS FILE RUNS THE WHOLE THING***

input.init();

document.getElementById("content").classList.remove("hidden");
action.selectedIndex = 0;

document.getElementById('item_category').value = 'consumables';
updateItemDropdown();

document.getElementById('map-size').value = size;
document.getElementById("viewport-width").value = viewportWidth;
document.getElementById("viewport-height").value = viewportHeight;

window.cursorWorldPos = {x: player.x, y: player.y};
cursorVisible = true;

update();

// --- MULTI-PLAYER MANAGEMENT ---

function getSelectedPlayer() {
	const sel = document.getElementById('player_select');
	if (!sel) return player;
	const idx = parseInt(sel.value);
	return (idx >= 0 && idx < allPlayers.length) ? allPlayers[idx] : player;
}

function populatePlayerFields(target) {
	document.getElementById('player_name').value = target.name;
	document.getElementById('player_hp').value = target.hp;
	document.getElementById('player_range').value = target.range;
	document.getElementById('player_attack_range').value = target.attack_range;
	document.getElementById('player_turns').value = target.turns;
}

function updatePlayerSelect() {
	const sel = document.getElementById('player_select');
	if (!sel) return;
	const current = sel.value;
	sel.innerHTML = '';
	allPlayers.forEach((p, i) => {
		const opt = document.createElement('option');
		opt.value = i;
		opt.textContent = p.name;
		sel.appendChild(opt);
	});
	if (Array.from(sel.options).some(o => o.value === current)) sel.value = current;
}

function onPlayerSelectChange() {
	populatePlayerFields(getSelectedPlayer());
}

function spawnExtraPlayer() {
	const colorIndex = allPlayers.length % PLAYER_COLORS.length;
	const color = PLAYER_COLORS[colorIndex];

	const nameField = document.getElementById('player_name').value;
	const name = (nameField === "" || nameField === "player")
		? ("player" + (allPlayers.length + 1))
		: nameField;
	const hp           = parseInt(document.getElementById('player_hp').value) || 20;
	const range        = parseInt(document.getElementById('player_range').value) || 3;
	const attack_range = parseInt(document.getElementById('player_attack_range').value) || 4;
	const turns        = parseInt(document.getElementById('player_turns').value) || 2;

	const fieldX = document.getElementById('player_x').value;
	const fieldY = document.getElementById('player_y').value;

	let spawnX = null, spawnY = null;

	if (fieldX !== "" && fieldY !== "") {
		const x = parseInt(fieldX), y = parseInt(fieldY);
		if (x >= 0 && x < size && y >= 0 && y < size && !helper.tileBlocked(x, y)) {
			spawnX = x;
			spawnY = y;
		}
		document.getElementById('player_x').value = "";
		document.getElementById('player_y').value = "";
	}

	if (spawnX === null) {
		const offsets = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
		for (let [dx, dy] of offsets) {
			const testX = player.x + dx;
			const testY = player.y + dy;
			if (testX >= 0 && testX < size && testY >= 0 && testY < size && !helper.tileBlocked(testX, testY)) {
				spawnX = testX;
				spawnY = testY;
				break;
			}
		}
	}

	if (spawnX === null) {
		console.log("No valid spawn location for new player!");
		return;
	}

	const newPlayer = {
		name, hp,
		x: spawnX,
		y: spawnY,
		range, attack_range, turns,
		inventory: [],
		equipment: {},
		traits: ['player'],
		playerColor: color
	};

	allPlayers.push(newPlayer);
	updatePlayerSelect();
	document.getElementById('player_select').value = allPlayers.length - 1;
	populatePlayerFields(newPlayer);
	document.getElementById('player_name').value = "player";

	update();
	console.log("Spawned " + newPlayer.name + " at " + spawnX + ", " + spawnY);
}

// --- END MULTI-PLAYER MANAGEMENT ---

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
		if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
		currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
	}
}

function updatePeekButton() {
	const peekButton = document.getElementById('peek-button');
	const isActiveTurn = currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex]);
	const has2Turns = currentEntityTurnsRemaining >= 2;

	if (isActiveTurn && has2Turns && !isPeekMode) {
		peekButton.classList.add('active');
		peekButton.disabled = false;
	} else {
		peekButton.classList.remove('active');
		peekButton.disabled = true;
	}
}

function activatePeekMode() {
	const activeEnt = getActivePlayerEntity();
	if (currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex]) && currentEntityTurnsRemaining >= 2) {
		if (!isPeekMode) {
			isPeekMode = true;
			peekStep = 1;
			peekStartX = activeEnt.x;
			peekStartY = activeEnt.y;
			savedPlayerRange = activeEnt.range;
			peekEntity = activeEnt;
			activeEnt.range = Math.floor(activeEnt.range / 2);
			action.value = "move";
			action.disabled = false;
		}
		update();
	}
}

function exitPeekMode() {
	if (!isPeekMode) return;

	if (peekStep === 1 && peekEntity) peekEntity.range = savedPlayerRange;

	isPeekMode = false;
	peekStep = 1;
	peekEntity = null;
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

		// Show grenades always, other enemies only if spotted
		if (!isPlayerControlled(entity)) {
			const hasSeenPlayer = (entity.seenX !== 0 || entity.seenY !== 0);
			if (!hasSeenPlayer) continue;
		}

		const isActive = (i === currentEntityIndex);
		const turnsDisplay = isActive ? ` (${currentEntityTurnsRemaining}/${entity.turns})` : ` (${entity.turns})`;
		const killButton = !isPlayerControlled(entity) ?
			`<button onclick="killEntity(${i})" style="float: right; background: #ff0000; color: #fff; border: none; margin-left: 6px; cursor: pointer; position: absolute;">X</button>` : '';

		html += '<div class="turn-entity ' + (isActive ? 'active' : '') + '">' +
				entity.name.toUpperCase() + turnsDisplay + killButton + '</div>';
	}

	turnOrder.innerHTML = html;
}

function updateInventory() {
	var inventoryDiv = document.getElementById("inventory-items");
	var html = '';

	const activeEnt = getActivePlayerEntity();
	if (typeof sortInventory === 'function') sortInventory(activeEnt);

	if (activeEnt.inventory.length === 0) {
		html = '<p style="color: #888;">Empty</p>';
	} else {
		for (let i = 0; i < activeEnt.inventory.length; i++) {
			const item = activeEnt.inventory[i];
			const itemDef = itemTypes[item.itemType];

			let itemTypeLabel = "";
			if (itemDef.type === "equipment" && itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) {
				const currentAmmo = item.currentAmmo !== undefined ? item.currentAmmo : itemDef.maxAmmo;
				if (currentAmmo > 0) itemTypeLabel = " [" + currentAmmo + "/" + itemDef.maxAmmo + "]";
				else itemTypeLabel = " [E]";
			}

			let displayName = itemDef.displayName;
			let quantityLabel = "";

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
	if (typeof WindowSystem !== 'undefined' && WindowSystem.isOpen()) return;

	if (currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex])) {
		const activeEnt = getActivePlayerEntity();
		if (typeof useItem !== 'undefined') useItem(activeEnt, inventoryIndex);
	}
}

function dropInventoryItem(event, inventoryIndex) {
	event.preventDefault();

	if (typeof WindowSystem !== 'undefined' && WindowSystem.isOpen()) return;

	if (currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex])) {
		const activeEnt = getActivePlayerEntity();
		if (inventoryIndex >= 0 && inventoryIndex < activeEnt.inventory.length) {
			const item = activeEnt.inventory[inventoryIndex];
			const itemDef = itemTypes[item.itemType];
			const quantity = item.quantity || 1;

			if (typeof mapItems !== 'undefined' && typeof nextItemId !== 'undefined') {
				if (item.isLive && itemDef.effect === "grenade") { // spawn dropped grenade
					const grenadeEntity = {
						name: "Grenade",
						hp: 1,
						x: activeEnt.x,
						y: activeEnt.y,
						range: 0, attack_range: 0, turns: 1,
						turnsRemaining: item.turnsRemaining,
						inventory: [],
						traits: ['explode', 'active']
					};
					allEnemies.push(grenadeEntity);
					console.log(activeEnt.name + " dropped a LIVE grenade with " + item.turnsRemaining + " turns remaining!");
					activeEnt.inventory.splice(inventoryIndex, 1);
				} else {
					for (var i = 0; i < quantity; i++) {
						mapItems.push({ x: activeEnt.x, y: activeEnt.y, itemType: item.itemType, id: nextItemId++ });
					}
					console.log(activeEnt.name + " dropped " + quantity + " " + itemDef.name);
					activeEnt.inventory.splice(inventoryIndex, 1);
				}
			}

			update();
		}
	}
}

function updateEquipment() {
	var equipmentDiv = document.getElementById("equipment-items");
	var html = '';

	const activeEnt = getActivePlayerEntity();
	if (!activeEnt.equipment) activeEnt.equipment = {};

	const slots = ["weapon", "armor", "accessory"];
	let hasEquipment = false;

	for (let slot of slots) {
		if (activeEnt.equipment[slot]) {
			hasEquipment = true;
			const item = activeEnt.equipment[slot];
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
	if (currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex])) {
		const activeEnt = getActivePlayerEntity();
		if (typeof unequipItem !== 'undefined') {
			unequipItem(activeEnt, slot);
			update();
		}
	}
}

function killEntity(index) { // ONLY used for the "x" button for enemies in the turn order
	if (index >= 0 && index < entities.length && !isPlayerControlled(entities[index])) {
		entities[index].hp = 0;
		if (index < currentEntityIndex) currentEntityIndex--;
		else if (index === currentEntityIndex) currentEntityTurnsRemaining = 0;
		update();
	}
}

function generateDungeon() {
	const numRooms     = parseInt(document.getElementById('dungeon_rooms').value) || 15;
	const numHallways  = parseInt(document.getElementById('dungeon_hallways').value) || 14;
	const minSize      = parseInt(document.getElementById('dungeon_min_size').value) || 7;
	const maxSize      = parseInt(document.getElementById('dungeon_max_size').value) || 13;
	const coverPercent = parseInt(document.getElementById('dungeon_cover').value) || 20;
	randomFloor(numRooms, numHallways, minSize, maxSize, coverPercent);
}

function randomFloor(numRooms, numHallways, minRoomSize, maxRoomSize, coverPercent) {
	walls = [];
	mapItems = [];
	allEnemies = [];

	const rooms = [];
	const maxAttempts = 500;

	for (let i = 0; i < numRooms; i++) {
		let placed = false;
		for (let attempt = 0; attempt < maxAttempts && !placed; attempt++) {
			const w = Math.floor(Math.random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
			const h = Math.floor(Math.random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
			const x = Math.floor(Math.random() * (size - w - 4)) + 2;
			const y = Math.floor(Math.random() * (size - h - 4)) + 2;
			const newRoom = {x, y, w, h};
			let overlap = false;
			for (let room of rooms) {
				if (!(newRoom.x + newRoom.w + 1 < room.x || newRoom.x > room.x + room.w + 1 ||
					  newRoom.y + newRoom.h + 1 < room.y || newRoom.y > room.y + room.h + 1)) {
					overlap = true;
					break;
				}
			}
			if (!overlap) { rooms.push(newRoom); placed = true; }
		}
	}

	for (let x = 0; x < size; x++) {
		for (let y = 0; y < size; y++) {
			walls.push({x, y, type: 'wall'});
		}
	}

	for (let room of rooms) {
		for (let x = room.x; x < room.x + room.w; x++) {
			for (let y = room.y; y < room.y + room.h; y++) {
				const idx = walls.findIndex(w => w.x === x && w.y === y);
				if (idx >= 0) walls.splice(idx, 1);
			}
		}
	}

	for (let i = 0; i < numHallways && rooms.length > 1; i++) {
		const r1 = rooms[Math.floor(Math.random() * rooms.length)];
		const r2 = rooms[Math.floor(Math.random() * rooms.length)];
		if (r1 === r2) continue;
		const c1x = Math.floor(r1.x + r1.w / 2);
		const c1y = Math.floor(r1.y + r1.h / 2);
		const c2x = Math.floor(r2.x + r2.w / 2);
		const c2y = Math.floor(r2.y + r2.h / 2);
		if (Math.random() > 0.5) {
			for (let x = Math.min(c1x, c2x); x <= Math.max(c1x, c2x); x++) {
				let idx = walls.findIndex(w => w.x === x && w.y === c1y);
				if (idx >= 0) walls.splice(idx, 1);
			}
			for (let y = Math.min(c1y, c2y); y <= Math.max(c1y, c2y); y++) {
				let idx = walls.findIndex(w => w.x === c2x && w.y === y);
				if (idx >= 0) walls.splice(idx, 1);
			}
		} else {
			for (let y = Math.min(c1y, c2y); y <= Math.max(c1y, c2y); y++) {
				let idx = walls.findIndex(w => w.x === c1x && w.y === y);
				if (idx >= 0) walls.splice(idx, 1);
			}
			for (let x = Math.min(c1x, c2x); x <= Math.max(c1x, c2x); x++) {
				let idx = walls.findIndex(w => w.x === x && w.y === c2y);
				if (idx >= 0) walls.splice(idx, 1);
			}
		}
	}

	if (coverPercent > 0) {
		for (let room of rooms) {
			const roomArea = (room.w - 2) * (room.h - 2);
			const numCoverPieces = Math.floor((roomArea * coverPercent) / 100 / 2);
			for (let i = 0; i < numCoverPieces; i++) {
				if (Math.random() > 0.5) {
					const px = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
					const py = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
					if (!walls.find(w => w.x === px && w.y === py)) {
						walls.push({x: px, y: py, type: 'wall'});
					}
				} else {
					const px = room.x + 1 + Math.floor(Math.random() * (room.w - 3));
					const py = room.y + 1 + Math.floor(Math.random() * (room.h - 3));
					const orientation = Math.floor(Math.random() * 4);
					const lShapes = [
						[{x: 0, y: 0}, {x: 1, y: 0}, {x: 0, y: 1}],
						[{x: 0, y: 0}, {x: 0, y: 1}, {x: 1, y: 1}],
						[{x: 1, y: 0}, {x: 0, y: 1}, {x: 1, y: 1}],
						[{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}]
					];
					const shape = lShapes[orientation];
					for (let tile of shape) {
						const wx = px + tile.x;
						const wy = py + tile.y;
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

	if (rooms.length > 0) {
		player.x = Math.floor(rooms[0].x + rooms[0].w / 2);
		player.y = Math.floor(rooms[0].y + rooms[0].h / 2);
	}

	update();
}

function update() {
	allEnemies = allEnemies.filter(enemy => enemy.hp >= 1);
	allPlayers = allPlayers.filter(p => p.hp >= 1);

	entities.forEach(e => {
		if (e.following && e.following.hp < 1) e.following = null;
	});

	// player is always allPlayers[0]; keep the alias current
	if (allPlayers.length > 0) player = allPlayers[0];

	// Build entity list: players first, then enemies, grenades last
	const nonGrenadeEnemies = allEnemies.filter(e => !helper.hasTrait(e, 'explode') && e.hp >= 1);
	const grenades = allEnemies.filter(e => helper.hasTrait(e, 'explode') && e.hp >= 1);

	entities = [
		...allPlayers,
		...nonGrenadeEnemies,
		...grenades
	];

	//if (currentEntityIndex >= entities.length) {
	if (currentEntityIndex == undefined) { // prevents turn skipping from grenades detonated by enemy attacks?
		currentEntityIndex = 0;
		currentEntityTurnsRemaining = 0;
	}

	const currentEntity = entities[currentEntityIndex] || player;
	const oldCameraX = camera.x;
	const oldCameraY = camera.y;

	if (isPlayerControlled(currentEntity)) {
		updateCamera();
	} else {
		if (isAiming) {
			updateCamera();
		} else if (!EntitySystem._explosionPending) {
			camera = {
				x: currentEntity.x - Math.round((viewportWidth / 2)) + 1,
				y: currentEntity.y - Math.round((viewportHeight / 2)) + 1
			};
		}
	}

	if (isPlayerControlled(currentEntity) && window.cursorWorldPos && cursorVisible) {
		window.cursorWorldPos.x += (camera.x - oldCameraX);
		window.cursorWorldPos.y += (camera.y - oldCameraY);
		window.cursorWorldPos.x = Math.max(0, Math.min(size - 1, window.cursorWorldPos.x));
		window.cursorWorldPos.y = Math.max(0, Math.min(size - 1, window.cursorWorldPos.y));
	}

	canvas.init();
	valid = [];
	canvas.clear();
	canvas.grid();
	canvas.walls();
	canvas.items();
	canvas.drawOnionskin();
	canvas.player();

	if (isPlayerControlled(currentEntity) && typeof turns !== 'undefined' && turns.checkEnemyLOS) {
		turns.checkEnemyLOS();
	}

	canvas.enemy();

	populate.reset();
	populate.enemies();
	populate.player();

	turns.check();

	if (isPlayerControlled(currentEntity) && action.value === "attack" && window.cursorWorldPos && window.throwingGrenadeIndex !== undefined) {
		const grenadeTargeting = calculateGrenadeTargeting(currentEntity, window.cursorWorldPos.x, window.cursorWorldPos.y);
		if (grenadeTargeting.length > 0) canvas.los(grenadeTargeting);
	}

	canvas.cursor();
	canvas.window();
	
	//canvas.grenadeAreas();

	updateTurnOrder();
	updateInventory();
	updateEquipment();
	updatePeekButton();

	if (isPlayerControlled(currentEntity)) {
		const sel = document.getElementById('player_select');
		if (sel) sel.value = allPlayers.indexOf(currentEntity);
		onPlayerSelectChange();
	}

	var elem = document.getElementById("log");
	elem.scrollTop = elem.scrollHeight;
}

action.selectedIndex = 0;

function handleMouseMove(event) {
	if (allPlayers.length === 0) return;
	if (currentEntityIndex >= 0 && !isPlayerControlled(entities[currentEntityIndex])) return;
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

function showItemPickupWindow(x, y) {
	const activeEnt = getActivePlayerEntity();
	const itemsAtLocation = mapItems.filter(item => item.x === x && item.y === y);
	if (itemsAtLocation.length === 0) return;

	const windowItems = [];
	const processedItems = new Set();

	itemsAtLocation.forEach(item => {
		if (processedItems.has(item.id)) return;
		const itemDef = itemTypes[item.itemType];
		if (itemDef.type === "consumable") {
			const sameTypeItems = itemsAtLocation.filter(i => i.itemType === item.itemType && !processedItems.has(i.id));
			sameTypeItems.forEach(i => processedItems.add(i.id));
			let displayText = itemDef.displayName;
			if (sameTypeItems.length > 1) displayText = `${displayText} (x${sameTypeItems.length})`;
			windowItems.push({ text: displayText, itemType: item.itemType, items: sameTypeItems, count: sameTypeItems.length, isStackable: true });
		} else {
			processedItems.add(item.id);
			windowItems.push({ text: itemDef.displayName, itemType: item.itemType, items: [item], count: 1, isStackable: false });
		}
	});

	if (windowItems.length === 1) {
		const selection = windowItems[0];
		const itemDef = itemTypes[selection.itemType];
		selection.items.forEach(item => {
			const itemIndex = mapItems.indexOf(item);
			if (itemIndex >= 0) mapItems.splice(itemIndex, 1);
		});
		if (itemDef.type === "consumable") {
			let added = false;
			for (let invItem of activeEnt.inventory) {
				if (invItem.itemType === selection.itemType) {
					invItem.quantity = (invItem.quantity || 1) + selection.count;
					added = true;
					break;
				}
			}
			if (!added) {
				if (activeEnt.inventory.length >= maxInventorySlots) {
					console.log("Inventory full!");
					selection.items.forEach(item => mapItems.push(item));
				} else {
					activeEnt.inventory.push({ itemType: selection.itemType, id: nextItemId++, quantity: selection.count });
					console.log("Picked up " + selection.count + " " + itemDef.name + (selection.count > 1 ? "s" : ""));
				}
			} else {
				console.log("Picked up " + selection.count + " " + itemDef.name + (selection.count > 1 ? "s" : ""));
			}
		} else {
			let pickedCount = 0;
			for (let i = 0; i < selection.items.length; i++) {
				if (activeEnt.inventory.length >= maxInventorySlots) {
					console.log("Inventory full! Picked up " + pickedCount + " of " + selection.count);
					for (let j = i; j < selection.items.length; j++) mapItems.push(selection.items[j]);
					break;
				}
				const newItem = {itemType: selection.itemType, id: selection.items[i].id};
				if (itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) newItem.currentAmmo = itemDef.maxAmmo;
				activeEnt.inventory.push(newItem);
				pickedCount++;
			}
			if (pickedCount > 0) console.log("Picked up " + pickedCount + " " + itemDef.name + (pickedCount > 1 ? "s" : ""));
		}
		update();
		return;
	}

	const win = WindowSystem.create({
		title: `Items at (${x}, ${y})`,
		width: 400,
		height: Math.min(500, 100 + windowItems.length * 35),
		items: windowItems,
		onConfirm: function(selectedItems) {
			selectedItems.forEach(selection => {
				const itemDef = itemTypes[selection.itemType];
				selection.items.forEach(item => {
					const itemIndex = mapItems.indexOf(item);
					if (itemIndex >= 0) mapItems.splice(itemIndex, 1);
				});
				if (itemDef.type === "consumable") {
					let added = false;
					for (let invItem of activeEnt.inventory) {
						if (invItem.itemType === selection.itemType) {
							invItem.quantity = (invItem.quantity || 1) + selection.count;
							added = true;
							break;
						}
					}
					if (!added) {
						if (activeEnt.inventory.length >= maxInventorySlots) {
							console.log("Inventory full! Couldn't pick up " + itemDef.name);
							selection.items.forEach(item => mapItems.push(item));
						} else {
							activeEnt.inventory.push({ itemType: selection.itemType, id: nextItemId++, quantity: selection.count });
							console.log("Picked up " + selection.count + " " + itemDef.name + (selection.count > 1 ? "s" : ""));
						}
					} else {
						console.log("Picked up " + selection.count + " " + itemDef.name + (selection.count > 1 ? "s" : ""));
					}
				} else {
					let pickedCount = 0;
					for (let i = 0; i < selection.items.length; i++) {
						if (activeEnt.inventory.length >= maxInventorySlots) {
							console.log("Inventory full! Picked up " + pickedCount + " of " + selection.count);
							for (let j = i; j < selection.items.length; j++) mapItems.push(selection.items[j]);
							break;
						}
						const newItem = {itemType: selection.itemType, id: selection.items[i].id};
						if (itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) newItem.currentAmmo = itemDef.maxAmmo;
						activeEnt.inventory.push(newItem);
						pickedCount++;
					}
					if (pickedCount > 0) console.log("Picked up " + pickedCount + " " + itemDef.name + (pickedCount > 1 ? "s" : ""));
				}
			});
		},
		onCancel: function() {
			console.log("Cancelled item pickup");
		}
	});

	WindowSystem.open(win);
}

function updateViewportSize() {
	let newWidth = parseInt(document.getElementById('viewport-width').value);
	let newHeight = parseInt(document.getElementById('viewport-height').value);
	if (newWidth >= 5 && newWidth <= 50 && newHeight >= 5 && newHeight <= 50) {
		if (isZoomedOut) { newWidth = newWidth * 2; newHeight = newHeight * 2; }
		viewportWidth = newWidth;
		viewportHeight = newHeight;
		canvas.init();
		console.log("Viewport size changed to " + newWidth + "x" + newHeight);
		update();
	} else {
		console.log("Invalid viewport size. Must be between 5 and 50.");
		document.getElementById('viewport-width').value = isZoomedOut ? viewportWidth / 2 : viewportWidth;
		document.getElementById('viewport-height').value = isZoomedOut ? viewportHeight / 2 : viewportHeight;
	}
}