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
    // Strip equipment to get base stats for display
    if (target.equipment) {
        for (let slot in target.equipment) {
            if (target.equipment[slot]) {
                const itemDef = itemTypes[target.equipment[slot].itemType];
                if (itemDef) applyEquipmentEffects(target, itemDef, false);
            }
        }
    }
    document.getElementById('player_name').value = target.name;
    document.getElementById('player_hp').value = target.hp;
    document.getElementById('player_range').value = target.range;
    document.getElementById('player_attack_range').value = target.attack_range;
    document.getElementById('player_turns').value = target.turns;
    // Re-apply equipment
    if (target.equipment) {
        for (let slot in target.equipment) {
            if (target.equipment[slot]) {
                const itemDef = itemTypes[target.equipment[slot].itemType];
                if (itemDef) applyEquipmentEffects(target, itemDef, true);
            }
        }
    }
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
		inventory: new Array(maxInventorySlots).fill(null),
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

// drawAdjacentSelect is defined in input.js

function updateTurnOrder() {
	var turnOrder = document.getElementById("turn-order");
	var html = '';

	for (let i = 0; i < entities.length; i++) {
		const entity = entities[i];

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

function killEntity(index) {
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
	selectedEditTiles = [];

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
		while (e.following && e.following.following) e.following = e.following.following;
	});

	if (allPlayers.length > 0) player = allPlayers[0];

	const nonGrenadeEnemies = allEnemies.filter(e => !helper.hasTrait(e, 'explode') && e.hp >= 1);
	const grenades = allEnemies.filter(e => helper.hasTrait(e, 'explode') && e.hp >= 1);

	entities = [
		...allPlayers,
		...nonGrenadeEnemies,
		...grenades
	];

	if (currentEntityIndex == undefined) {
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
	canvas.drawOnionskin();
	canvas.walls();
	canvas.player();
	canvas.items();

	if (isPlayerControlled(currentEntity) && typeof turns !== 'undefined' && turns.checkEnemyLOS) {
		turns.checkEnemyLOS();
	}

	canvas.enemy();

	populate.reset();
	populate.enemies();
	populate.player();

	turns.check();

	canvas.selectedEditTiles();

	if (adjacentSelect && isPlayerControlled(currentEntity)) {
		valid.forEach(v => {
			ctx.clearRect((v.x - camera.x) * tileSize, (v.y - camera.y) * tileSize, tileSize, tileSize);
		});
		const tilesImg = document.getElementById("tiles");
		const itemsImg = document.getElementById("items");
		valid.forEach(v => {
			const sx = (v.x - camera.x) * tileSize;
			const sy = (v.y - camera.y) * tileSize;
			if (tilesImg && tilesImg.complete && tilesImg.naturalWidth > 0) {
				ctx.drawImage(tilesImg, TILE_FLOOR * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, sx, sy, tileSize, tileSize);
			}
			const wall = walls.find(w => w.x === v.x && w.y === v.y);
			if (wall && tilesImg && tilesImg.complete) {
				const tileIndex = { wall: TILE_WALL, glass: TILE_GLASS, water: TILE_WATER, fire: TILE_FIRE }[wall.type];
				if (tileIndex !== undefined) ctx.drawImage(tilesImg, tileIndex * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, sx, sy, tileSize, tileSize);
				if (wall.type === 'glass' && wall.damaged) ctx.drawImage(tilesImg, TILE_BROKEN * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, sx, sy, tileSize, tileSize);
			}
			const tileItems = mapItems.filter(item => item.x === v.x && item.y === v.y);
			const tileGrenade = allEnemies.find(e => helper.isGrenadeEntity(e) && e.hp > 0 && e.x === v.x && e.y === v.y);
			if (tileItems.length > 0 || tileGrenade) {
				const topItem = tileItems.length > 0 ? tileItems[tileItems.length - 1] : null;
				const spriteKey = topItem ? topItem.itemType : 'grenadeLive';
				const spriteInfo = typeof ITEM_SPRITE_MAP !== 'undefined' ? ITEM_SPRITE_MAP[spriteKey] : null;
				if (itemsImg && itemsImg.complete && itemsImg.naturalWidth > 0 && spriteInfo) {
					ctx.drawImage(itemsImg, spriteInfo.col * 32, spriteInfo.row * 32, 32, 32, sx, sy, tileSize, tileSize);
				} else if (topItem) {
					const itemDef = itemTypes[topItem.itemType];
					const isEquipment = itemDef?.type === "equipment";
					ctx.fillStyle = isEquipment ? "rgba(255, 165, 0, 0.8)" : "rgba(255, 255, 255, 0.8)";
					ctx.fillRect(sx, sy, tileSize, tileSize);
				}
				if (tileGrenade && helper.hasTrait(tileGrenade, 'active')) {
					ctx.fillStyle = "#FF0000";
					ctx.font = "bold " + (tileSize / 2) + "px monospace";
					ctx.textAlign = "center";
					ctx.fillText(tileGrenade.turnsRemaining.toString(), sx + tileSize / 2, sy + tileSize * 0.65);
				}
				if (tileItems.length > 1) {
					const fontSize = Math.max(8, Math.round(tileSize * 0.35));
					ctx.font = `bold ${fontSize}px sans-serif`;
					ctx.textAlign = 'right';
					ctx.fillStyle = '#000000';
					ctx.fillText('+', sx + tileSize - 1, sy + tileSize - 1);
					ctx.fillStyle = '#FFFFFF';
					ctx.fillText('+', sx + tileSize - 2, sy + tileSize - 2);
					ctx.textAlign = 'left';
				}
			}
		});
		canvas.drawAdjacentSelect();
	} else {
		if (isPlayerControlled(currentEntity) && action.value === "attack" && window.cursorWorldPos && window.throwingGrenadeIndex !== undefined) {
			const cursorX = window.cursorWorldPos.x;
			const cursorY = window.cursorWorldPos.y;
			const grenadeTargeting = calculateGrenadeTargeting(currentEntity, cursorX, cursorY);
			if (grenadeTargeting.length > 0) {
				// Draw crosshairs only on blast-area tiles. Path tiles that happen to
				// fall inside the blast circle also qualify.
				// Re-derive the landing center the same way calculateGrenadeTargeting does.
				const grenadeDef = itemTypes.grenade;
				let gPath = line({x: currentEntity.x, y: currentEntity.y}, {x: cursorX, y: cursorY});
				gPath = clipPathAtWall(gPath);
				gPath = gPath.length > currentEntity.attack_range + 1 ? gPath.slice(1, currentEntity.attack_range + 1) : gPath.slice(1);
				const blastCenter = gPath.length > 0 ? gPath[gPath.length - 1] : {x: cursorX, y: cursorY};
				const blastAreaTiles = collectAreaTiles(blastCenter.x, blastCenter.y, grenadeDef.damageRadius);
				const blastSet = new Set(blastAreaTiles.map(t => `${t.x},${t.y}`));
				blastSet.add(`${blastCenter.x},${blastCenter.y}`);
				const blastTiles = grenadeTargeting.filter(t => blastSet.has(`${t.x},${t.y}`));
				canvas.los(grenadeTargeting, false, blastTiles);
			}
		}
	}

	canvas.cursor();
	canvas.inventory();
	canvas.window();

	updateTurnOrder();
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
	if (EntitySystem._explosionPending) return;
	if (currentEntityIndex >= 0 && !isPlayerControlled(entities[currentEntityIndex]) && allPlayers.length > 0) return;
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

// Shared helper: pick up a set of items from a resolved windowItems list into activeEnt's inventory.
// Uses the sparse-null model — picks the first empty slot, stacks consumables into existing slots,
// and returns items to the map if no inventory space is available.
function _doPickupItems(activeEnt, selectedWindowItems) {
	const inv = getInventory(activeEnt);
	selectedWindowItems.forEach(selection => {
if (selection._grenadeEntity) {
			const g = selection._grenadeEntity;
			const isInert = !helper.hasTrait(g, 'active');
			const idx = allEnemies.indexOf(g);
			if (idx >= 0) allEnemies.splice(idx, 1);
			if (isInert) {
				let stacked = false;
				for (let invItem of inv) {
					if (invItem && invItem.itemType === 'grenade' && !invItem.isLive) { // Pick up live grenade without Active trait
						invItem.quantity = (invItem.quantity || 1) + 1;
						stacked = true;
						break;
					}
				}
				if (!stacked) {
					const emptySlot = findFirstEmptySlot(activeEnt);
					if (emptySlot < 0) { // inventory full
						allEnemies.push(g);
						return;
					}
					inv[emptySlot] = { itemType: 'grenade', id: nextItemId++, quantity: 1 };
				}
			} else {
				const emptySlot = findFirstEmptySlot(activeEnt);
				if (emptySlot < 0) { // inventory full
					allEnemies.push(g);
					return;
				}
				inv[emptySlot] = { itemType: 'grenade', id: nextItemId++, isLive: true, turnsRemaining: g.turnsRemaining, quantity: 1 };
				console.log(activeEnt.name + " picked up a live grenade!");
			}
			return;
		}
		const itemDef = itemTypes[selection.itemType];

		// Remove the picked items from the map up front
		selection.items.forEach(item => {
			const itemIndex = mapItems.indexOf(item);
			if (itemIndex >= 0) mapItems.splice(itemIndex, 1);
		});

		if (itemDef.type === "consumable") {
			// Try stacking into an existing consumable slot first
			let stacked = false;
			for (let invItem of inv) {
				if (invItem && invItem.itemType === selection.itemType && !invItem.isLive) {
					invItem.quantity = (invItem.quantity || 1) + selection.count;
					stacked = true;
					break;
				}
			}
			if (!stacked) {
				const emptySlot = findFirstEmptySlot(activeEnt);
				if (emptySlot < 0) {
					console.log("Inventory full! Couldn't pick up " + itemDef.name);
					selection.items.forEach(item => mapItems.push(item));
				} else {
					inv[emptySlot] = { itemType: selection.itemType, id: nextItemId++, quantity: selection.count };
					console.log("Picked up " + selection.count + " " + itemDef.name + (selection.count > 1 ? "s" : ""));
				}
			} else {
				console.log("Picked up " + selection.count + " " + itemDef.name + (selection.count > 1 ? "s" : ""));
			}
		} else {
			let pickedCount = 0;
			for (let i = 0; i < selection.items.length; i++) {
				const emptySlot = findFirstEmptySlot(activeEnt);
				if (emptySlot < 0) {
					console.log("Inventory full! Picked up " + pickedCount + " of " + selection.count);
					for (let j = i; j < selection.items.length; j++) mapItems.push(selection.items[j]);
					break;
				}
				const mapItem = selection.items[i];
				const newItem = {itemType: selection.itemType, id: mapItem.id};
				if (itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) {
					newItem.currentAmmo = mapItem.currentAmmo !== undefined ? mapItem.currentAmmo : itemDef.maxAmmo;
				}
				inv[emptySlot] = newItem;
				pickedCount++;
			}
			if (pickedCount > 0) console.log("Picked up " + pickedCount + " " + itemDef.name + (pickedCount > 1 ? "s" : ""));
		}
	});
}

function showItemPickupWindow(x, y) {
	const activeEnt = getActivePlayerEntity();
	const itemsAtLocation = mapItems.filter(item => item.x === x && item.y === y);
	const grenadesAtLocation = allEnemies.filter(e => helper.isGrenadeEntity(e) && e.hp > 0 && e.x === x && e.y === y);
	if (itemsAtLocation.length === 0 && grenadesAtLocation.length === 0) return;

	// Build display list, grouping stackable consumables
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
			const ammoText = (itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined && itemDef.maxAmmo !== Infinity)
				? ` [${item.currentAmmo !== undefined ? item.currentAmmo : itemDef.maxAmmo}/${itemDef.maxAmmo}]`
				: '';
			windowItems.push({ text: itemDef.displayName + ammoText, itemType: item.itemType, items: [item], count: 1, isStackable: false });
		}
	});

	grenadesAtLocation.forEach(g => {
		windowItems.push({
			text: `LIVE Grenade (${g.turnsRemaining} turns left)`,
			itemType: 'grenade', items: [], count: 1, isStackable: false, _grenadeEntity: g
		});
	});

	// Auto-pickup when there's only one distinct item stack/type
	if (windowItems.length === 1) {
		_doPickupItems(activeEnt, windowItems);
		if (adjacentSelect) adjacentSelect = null;
		update();
		return;
	}

	WindowSystem.openSelectionWindow({
		title: `Items at (${x}, ${y})`,
		width: 400,
		height: Math.min(500, 100 + windowItems.length * 35),
		items: windowItems,
		confirmLabel: "Take Items",
		onConfirm: function(selectedItems) {
			_doPickupItems(activeEnt, selectedItems);
			if (adjacentSelect) adjacentSelect = null;
		},
		onCancel: function() {
			console.log("Cancelled item pickup");
			if (adjacentSelect) adjacentSelect = null;
		}
	});
}

// Right-click context menu for an inventory slot. // should be in input.js with the rest of them TBQH
function showInventoryContextMenu(slotIdx, event) {
	if (currentEntityIndex < 0) return;
	const activeEnt = getActivePlayerEntity();
	const inv = getInventory(activeEnt);
	const item = inv[slotIdx];
	if (!item) return;
	const def = itemTypes[item.itemType];
	if (!def) return;
	const equipped = isItemEquipped(activeEnt, item);

	let useLabel = "(u) Use";
	if (def.type === "equipment") useLabel = equipped ? "(u) Unequip" : "(u) Equip";

	const options = [
		{ text: def.displayName.toUpperCase() },
		{
			text: "(e) Examine",
			key: "e",
			action: function() {
				const stub = Object.assign({}, item, {
					x: activeEnt.x,
					y: activeEnt.y,
					_fromInventory: true
				});
				WindowSystem.showExamineWindow(stub);
			}
		},
		{
			text: useLabel,
			key: "u",
			action: function() {
				if (equipped) {
					unequipItem(activeEnt, def.slot);
					update();
				} else {
					useItem(activeEnt, slotIdx);
				}
			}
		},
		{
			text: "(d) Drop",
			key: "d",
			danger: true,
			action: function() {
				dropInventoryItemAtSlot(activeEnt, slotIdx);
			}
		}
	];

	const menu = WindowSystem.createContextMenu({
			x: 0,
			y: 0,
			tileX: window.cursorWorldPos.x,
			tileY: window.cursorWorldPos.y,
			options
		});

		const origin = getInventoryOrigin();
		const slotX = origin.x + (slotIdx % INVENTORY_COLS) * tileSize;
		const slotY = origin.y + Math.floor(slotIdx / INVENTORY_COLS) * tileSize;
		const menuHeight = menu.options.length * menu.itemHeight + menu.padding * 2;
		menu.x = slotX - 8 - menu.width + tileSize/2;
		menu.y = slotY + tileSize / 2 - menuHeight;

		WindowSystem.openContextMenu(menu);
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