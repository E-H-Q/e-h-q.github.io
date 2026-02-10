// SCRIPT.JS: RUNS ALL THE FUNCTIONS IN THIER CORRECT ORDER ***THIS FILE RUNS THE WHOLE THING***

input.init();

document.getElementById("content").classList.remove("hidden");
action.selectedIndex = 0;

document.getElementById('item_category').value = 'consumables';
updateItemDropdown();

document.getElementById('map-size').value = size;
document.getElementById("viewport-width").value = viewportWidth;
document.getElementById("viewport-height").value = viewportHeight;

// Initialize cursor at player position
window.cursorWorldPos = {x: player.x, y: player.y};
cursorVisible = true;

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
    // Don't use inventory items if window is open
    if (typeof WindowSystem !== 'undefined' && WindowSystem.isOpen()) {
        return;
    }
    
    if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
        if (typeof useItem !== 'undefined') {
            useItem(player, inventoryIndex)
        }
    }
}

function dropInventoryItem(event, inventoryIndex) {
    event.preventDefault();
    
    // Don't drop inventory items if window is open
    if (typeof WindowSystem !== 'undefined' && WindowSystem.isOpen()) {
        return;
    }
    
    if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
        if (inventoryIndex >= 0 && inventoryIndex < player.inventory.length) {
            const item = player.inventory[inventoryIndex];
            const itemDef = itemTypes[item.itemType];
            const quantity = item.quantity || 1;
            
            if (typeof mapItems !== 'undefined' && typeof nextItemId !== 'undefined') {
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
            
            if (!overlap) {
                rooms.push(newRoom);
                placed = true;
            }
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
    const oldCameraX = camera.x;
    const oldCameraY = camera.y;
    
    camera = {
        x: currentEntity.x - Math.round((viewportWidth / 2)) + 1,
        y: currentEntity.y - Math.round((viewportHeight / 2)) + 1
    };
    
    if (currentEntity === player && window.cursorWorldPos && cursorVisible) {
        window.cursorWorldPos.x += (camera.x - oldCameraX);
        window.cursorWorldPos.y += (camera.y - oldCameraY);
        window.cursorWorldPos.x = Math.max(0, Math.min(size - 1, window.cursorWorldPos.x));
        window.cursorWorldPos.y = Math.max(0, Math.min(size - 1, window.cursorWorldPos.y));
    }
    
    canvas.init();
    valid = [];
    canvas.clear();
    canvas.grid();
    canvas.items();
    canvas.walls();
    canvas.drawOnionskin();
    canvas.player();
    
    if (currentEntity === player && typeof turns !== 'undefined' && turns.checkEnemyLOS) {
        turns.checkEnemyLOS();
    }
    
    canvas.enemy();

    populate.reset();
    populate.enemies();
    populate.player();

    turns.check();
    
    if (currentEntity === player && action.value === "attack" && window.cursorWorldPos && window.throwingGrenadeIndex !== undefined) {
        const grenadeTargeting = calculateGrenadeTargeting(player, window.cursorWorldPos.x, window.cursorWorldPos.y);
        if (grenadeTargeting.length > 0) {
            canvas.los(grenadeTargeting);
        }
    }
    canvas.drawGrenades();
    canvas.cursor();
    canvas.window();
    
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

function showItemPickupWindow(x, y) {
    // Get all items at this location
    const itemsAtLocation = mapItems.filter(item => item.x === x && item.y === y);
    if (itemsAtLocation.length === 0) return;
    
    // Create individual entries for non-stackable items (equipment)
    // and grouped entries for stackable items (consumables)
    const windowItems = [];
    const processedItems = new Set();
    
    itemsAtLocation.forEach(item => {
        if (processedItems.has(item.id)) return;
        
        const itemDef = itemTypes[item.itemType];
        
        if (itemDef.type === "consumable") {
            // Stackable - group by type
            const sameTypeItems = itemsAtLocation.filter(i => 
                i.itemType === item.itemType && !processedItems.has(i.id)
            );
            
            sameTypeItems.forEach(i => processedItems.add(i.id));
            
            let displayText = itemDef.displayName;
            if (sameTypeItems.length > 1) {
                displayText = `${displayText} (x${sameTypeItems.length})`;
            }
            
            windowItems.push({
                text: displayText,
                itemType: item.itemType,
                items: sameTypeItems,
                count: sameTypeItems.length,
                isStackable: true
            });
        } else {
            // Non-stackable equipment - each one is separate
            processedItems.add(item.id);
            
            windowItems.push({
                text: itemDef.displayName,
                itemType: item.itemType,
                items: [item],
                count: 1,
                isStackable: false
            });
        }
    });
    
    // If only one entry (one item type), pick it all up directly
    if (windowItems.length === 1) {
        const selection = windowItems[0];
        const itemDef = itemTypes[selection.itemType];
        
        // Remove from map
        selection.items.forEach(item => {
            const itemIndex = mapItems.indexOf(item);
            if (itemIndex >= 0) {
                mapItems.splice(itemIndex, 1);
            }
        });
        
        // Add to player inventory
        if (itemDef.type === "consumable") {
            // Try to add to existing stack
            let added = false;
            for (let invItem of player.inventory) {
                if (invItem.itemType === selection.itemType) {
                    invItem.quantity = (invItem.quantity || 1) + selection.count;
                    added = true;
                    break;
                }
            }
            
            if (!added) {
                if (player.inventory.length >= maxInventorySlots) {
                    console.log("Inventory full!");
                    selection.items.forEach(item => mapItems.push(item));
                } else {
                    player.inventory.push({
                        itemType: selection.itemType,
                        id: nextItemId++,
                        quantity: selection.count
                    });
                    console.log("Picked up " + selection.count + " " + itemDef.name + (selection.count > 1 ? "s" : ""));
                }
            } else {
                console.log("Picked up " + selection.count + " " + itemDef.name + (selection.count > 1 ? "s" : ""));
            }
        } else {
            // Equipment - pick up each individually
            let pickedCount = 0;
            for (let i = 0; i < selection.items.length; i++) {
                if (player.inventory.length >= maxInventorySlots) {
                    console.log("Inventory full! Picked up " + pickedCount + " of " + selection.count);
                    // Put remaining items back
                    for (let j = i; j < selection.items.length; j++) {
                        mapItems.push(selection.items[j]);
                    }
                    break;
                }
                
                const newItem = {itemType: selection.itemType, id: selection.items[i].id};
                if (itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) {
                    newItem.currentAmmo = itemDef.maxAmmo;
                }
                player.inventory.push(newItem);
                pickedCount++;
            }
            
            if (pickedCount > 0) {
                console.log("Picked up " + pickedCount + " " + itemDef.name + (pickedCount > 1 ? "s" : ""));
            }
        }
        
	//currentEntityTurnsRemaining--;
        update();
        return;
    }
    
    // Multiple item types - show window
    const window = WindowSystem.create({
        title: `Items at (${x}, ${y})`,
        width: 400,
        height: Math.min(500, 100 + windowItems.length * 35),
        items: windowItems,
        onConfirm: function(selectedItems) {
            // Pick up selected items
            selectedItems.forEach(selection => {
                const itemDef = itemTypes[selection.itemType];
                
                // Remove items from map
                selection.items.forEach(item => {
                    const itemIndex = mapItems.indexOf(item);
                    if (itemIndex >= 0) {
                        mapItems.splice(itemIndex, 1);
                    }
                });
                
                // Add to player inventory
                if (itemDef.type === "consumable") {
                    // Try to add to existing stack
                    let added = false;
                    for (let invItem of player.inventory) {
                        if (invItem.itemType === selection.itemType) {
                            invItem.quantity = (invItem.quantity || 1) + selection.count;
                            added = true;
                            break;
                        }
                    }
                    
                    // Create new stack if needed
                    if (!added) {
                        if (player.inventory.length >= maxInventorySlots) {
                            console.log("Inventory full! Couldn't pick up " + itemDef.name);
                            // Put items back on map
                            selection.items.forEach(item => mapItems.push(item));
                        } else {
                            player.inventory.push({
                                itemType: selection.itemType,
                                id: nextItemId++,
                                quantity: selection.count
                            });
                            console.log("Picked up " + selection.count + " " + itemDef.name + (selection.count > 1 ? "s" : ""));
                        }
                    } else {
                        console.log("Picked up " + selection.count + " " + itemDef.name + (selection.count > 1 ? "s" : ""));
                    }
                } else {
                    // Equipment - pick up each individually
                    let pickedCount = 0;
                    for (let i = 0; i < selection.items.length; i++) {
                        if (player.inventory.length >= maxInventorySlots) {
                            console.log("Inventory full! Picked up " + pickedCount + " of " + selection.count);
                            // Put remaining items back
                            for (let j = i; j < selection.items.length; j++) {
                                mapItems.push(selection.items[j]);
                            }
                            break;
                        }
                        
                        const newItem = {itemType: selection.itemType, id: selection.items[i].id};
                        if (itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) {
                            newItem.currentAmmo = itemDef.maxAmmo;
                        }
                        player.inventory.push(newItem);
                        pickedCount++;
                    }
                    
                    if (pickedCount > 0) {
                        console.log("Picked up " + pickedCount + " " + itemDef.name + (pickedCount > 1 ? "s" : ""));
                    }
                }
            });
            
	    currentEntityTurnsRemaining--;
            update();
        },
        onCancel: function() {
            console.log("Cancelled item pickup");
        }
    });
    
    WindowSystem.open(window);
}

function updateViewportSize() {
    let newWidth = parseInt(document.getElementById('viewport-width').value);
    let newHeight = parseInt(document.getElementById('viewport-height').value);
    
    if (newWidth >= 5 && newWidth <= 50 && newHeight >= 5 && newHeight <= 50) {
        if (isZoomedOut) {
            newWidth = newWidth * 2;
            newHeight = newHeight * 2;
        }
        
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
