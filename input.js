// INPUT.JS: HANDLES USER INPUT

var isMouseDown = false;
var lastTile = null;
var keyboardMode = false;
var cursorVisible = true;
var isAiming = false;
var aimCamera = null;
var isZoomedOut = false;
var inventoryHidden = false;
var lastCameraUpdateCursorX = null;
var lastCameraUpdateCursorY = null;

// Adjacent select mode: { mode: 'grab' | 'door' }
var adjacentSelect = null;

// Keyboard grid-select mode: cursor locked to a UI grid. { grid, slot }
var uiGridSelect = null;

var UI_GRIDS = {
	ability: {
		cols: () => ABILITY_BAR_COLS,
		rows: () => ABILITY_BAR_ROWS,
		origin: () => getAbilityBarOrigin(),
		hover: s => { window.abilityHoverSlot = abilityAtBarSlot(getActivePlayerEntity(), s) ? s : -1; },
		clearHover: () => { window.abilityHoverSlot = -1; },
		activate: s => {
			const key = abilityAtBarSlot(getActivePlayerEntity(), s);
			if (!key) return false;
			closeUIGridSelect();
			handleAbilityClick(key);
			return true;
		},
		contextMenu: s => {
			const key = abilityAtBarSlot(getActivePlayerEntity(), s);
			if (!key) return false;
			const o = getAbilityBarOrigin();
			closeUIGridSelect();
			showAbilityContextMenu(key, o.x + (s % ABILITY_BAR_COLS) * tileSize,
				o.y + ((s / ABILITY_BAR_COLS) | 0) * tileSize);
			return true;
		}
	},
	inventory: {
		cols: () => INVENTORY_COLS,
		rows: () => INVENTORY_ROWS,
		origin: () => getInventoryOrigin(),
		hover: s => { window.inventoryHoverSlot = s; },
		clearHover: () => { window.inventoryHoverSlot = -1; },
		activate: s => {
			const ent = getActivePlayerEntity();
			if (getInventory(ent)[s]) { closeUIGridSelect(); useItem(ent, s); return true; }
			if (ent.abilityHotbar && ent.abilityHotbar[s]) { closeUIGridSelect(); handleAbilityClick(ent.abilityHotbar[s]); return true; }
			return false;
		},
		contextMenu: s => {
			const ent = getActivePlayerEntity();
			if (getInventory(ent)[s]) {
				closeUIGridSelect();
				showInventoryContextMenu(s, null);
				return true;
			}
			if (ent.abilityHotbar && ent.abilityHotbar[s]) {
				const o = getInventoryOrigin();
				closeUIGridSelect();
				showAbilityContextMenu(ent.abilityHotbar[s], o.x + (s % INVENTORY_COLS) * tileSize, o.y);
				return true;
			}
			return false;
		}
	}
};

function openUIGridSelect(grid, startSlot) {
	if (inventoryHidden) return;
	if (uiGridSelect && uiGridSelect.grid === grid) { closeUIGridSelect(); return; }
	const wasVisible = uiGridSelect ? uiGridSelect.cursorWasVisible : cursorVisible;
	if (uiGridSelect) UI_GRIDS[uiGridSelect.grid].clearHover();
	uiGridSelect = { grid: grid, slot: startSlot || 0, cursorWasVisible: wasVisible };
	keyboardMode = true;
	cursorVisible = false;
	UI_GRIDS[grid].hover(uiGridSelect.slot);
	update();
}

function closeUIGridSelect() {
	if (!uiGridSelect) return;
	cursorVisible = uiGridSelect.cursorWasVisible || cursorVisible;
	UI_GRIDS[uiGridSelect.grid].clearHover();
	uiGridSelect = null;
	update();
}

function moveUIGridSelect(dx, dy) {
	const g = UI_GRIDS[uiGridSelect.grid];
	const cols = g.cols(), rows = g.rows();
	const col = (uiGridSelect.slot % cols + dx + cols) % cols;
	const row = (((uiGridSelect.slot / cols) | 0) + dy + rows) % rows;
	uiGridSelect.slot = row * cols + col;
	g.hover(uiGridSelect.slot);
	update();
}

function getDoorBlocker(x, y) {
	return entities.find(e => e.hp > 0 && e.x === x && e.y === y && !helper.isGrenadeEntity(e));
}

function makeWallTile(x, y, tileType) {
	return tileType === 'doorLocked' ? {x, y, type: 'door', locked: true} : {x, y, type: tileType};
}

function consumeKey(entity) {
	const inv = getInventory(entity);
	const keySlot = inv.findIndex(i => i && i.itemType === 'key');
	if (keySlot < 0) return false;
	if (inv[keySlot].quantity > 1) inv[keySlot].quantity--;
	else inv[keySlot] = null;
	return true;
}

function tryOpenDoor(entity, door) {
	if (door.open) {
		const blocker = getDoorBlocker(door.x, door.y);
		if (blocker) {
			console.log("Door is blocked by " + blocker.name + "!");
			return false;
		}
		door.open = false;
		console.log(entity.name + " closed a door.");
		return true;
	}
	if (door.locked) {
		if (!consumeKey(entity)) {
			console.log("It's locked!");
			return false;
		}
		door.locked = false;
		console.log(entity.name + " used a key.");
		return true;
	}
	door.open = true;
	console.log(entity.name + " opened a door.");
	return true;
}

function lockDoorWithKey(entity, door) {
	if (door.locked) return tryOpenDoor(entity, door);
	if (door.open) {
		console.log("Close the door first.");
		return false;
	}
	if (!consumeKey(entity)) return false;
	door.locked = true;
	console.log(entity.name + " used a key.");
	console.log(entity.name + " locked a door.");
	return true;
}

function exitAdjacentSelect() {
	if (!adjacentSelect) return;
	adjacentSelect = null;
	console.log("Exited adjacent select.");
	update();
}

function activateGrabMode() {
	if (currentEntityIndex < 0 || !isPlayerControlled(entities[currentEntityIndex])) return;
	const activeEnt = getActivePlayerEntity();
	const hasItemsOnSelf = helper.hasGrabbableAt(activeEnt.x, activeEnt.y);
	const adjacentWithItems = helper.getAdjacentTiles(activeEnt.x, activeEnt.y, true)
		.filter(tile => helper.hasGrabbableAt(tile.x, tile.y));

	if (hasItemsOnSelf && adjacentWithItems.length === 0) {
		grabItemsFromTile(activeEnt.x, activeEnt.y);
		update();
		return;
	}

	if (!hasItemsOnSelf && adjacentWithItems.length === 0) {
		console.log("No items within reach.");
		return;
	}

	adjacentSelect = { mode: 'grab' };
	console.log("Grab mode: select an adjacent tile to grab items from.");
	update();
}

// Valid donor recipient: living, non-grenade, same side as the donor.
function canDonateTo(donor, e) {
	return e !== donor && e.hp > 0 && !helper.isGrenadeEntity(e) &&
		isPlayerControlled(e) === isPlayerControlled(donor);
}

function activateDoorMode(useKey = false) {
	if (currentEntityIndex < 0 || !isPlayerControlled(entities[currentEntityIndex])) return;
	const activeEnt = getActivePlayerEntity();
	const adjacentDoors = helper.getAdjacentTiles(activeEnt.x, activeEnt.y, true)
		.filter(tile => walls.some(w => w.x === tile.x && w.y === tile.y && w.type === 'door'));

	if (adjacentDoors.length === 0) {
		return;
    }

	if (adjacentDoors.length === 1) {
		const door = walls.find(w => w.x === adjacentDoors[0].x && w.y === adjacentDoors[0].y && w.type === 'door');
		if (useKey) lockDoorWithKey(activeEnt, door); else tryOpenDoor(activeEnt, door);
		update();
		return;
	}

	adjacentSelect = { mode: 'door', useKey };
	update();
}

function grabItemsFromTile(x, y) {
	const activeEnt = getActivePlayerEntity();
	if (!helper.hasGrabbableAt(x, y)) return false;

	const origX = activeEnt.x;
	const origY = activeEnt.y;
	activeEnt.x = x;
	activeEnt.y = y;
	pickupItem(activeEnt, x, y);
	activeEnt.x = origX;
	activeEnt.y = origY;
	return true;
}

function resetAbilityDrag() {
	window.abilityDrag = { key: null, startMouse: null, isDragging: false, mouse: null };
}

function resetInventoryDrag() {
	window.inventoryDrag = { startSlot: -1, startMouse: null, isDragging: false, item: null, overSlot: -1, mouse: null };
}

function updateCamera() {
    if (isAiming && window.cursorWorldPos && !isZoomedOut && !edit.checked) {
        const deadZone = 2;
        if (lastCameraUpdateCursorX !== null && lastCameraUpdateCursorY !== null) {
            const cursorMovedX = Math.abs(window.cursorWorldPos.x - lastCameraUpdateCursorX);
            const cursorMovedY = Math.abs(window.cursorWorldPos.y - lastCameraUpdateCursorY);
            if (cursorMovedX < deadZone && cursorMovedY < deadZone) return;
        }
        lastCameraUpdateCursorX = window.cursorWorldPos.x;
        lastCameraUpdateCursorY = window.cursorWorldPos.y;

        const activeEnt = getActivePlayerEntity();
        const dx = window.cursorWorldPos.x - activeEnt.x;
        const dy = window.cursorWorldPos.y - activeEnt.y;
        const euclideanDist = Math.sqrt(dx * dx + dy * dy);
        const dampening = euclideanDist < 5 ? 0.2 + (euclideanDist / 5) * 0.8 : 1.0;
        const maxPanDistance = (euclideanDist / 3) * dampening;

        const halfW = Math.round(viewportWidth / 2);
        const halfH = Math.round(viewportHeight / 2);

        const playerCameraX = activeEnt.x - halfW + 1;
        const playerCameraY = activeEnt.y - halfH + 1;

        let desiredCameraX = window.cursorWorldPos.x - halfW + 1;
        let desiredCameraY = window.cursorWorldPos.y - halfH + 1;

        const deltaX = desiredCameraX - playerCameraX;
        const deltaY = desiredCameraY - playerCameraY;
        const deltaDist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (deltaDist > maxPanDistance) {
            const ratio = maxPanDistance / deltaDist;
            desiredCameraX = playerCameraX + deltaX * ratio;
            desiredCameraY = playerCameraY + deltaY * ratio;
        }

        camera = aimCamera = {
            x: Math.round(desiredCameraX),
            y: Math.round(desiredCameraY)
        };
    } else {
        lastCameraUpdateCursorX = null;
        lastCameraUpdateCursorY = null;
        const currentEntity = entities[currentEntityIndex] || player;

        camera = {
            x: currentEntity.x - Math.round(viewportWidth / 2) + 1,
            y: currentEntity.y - Math.round(viewportHeight / 2) + 1
        };
        aimCamera = null;
    }
}

function handleZoom(zoomOut) {
    isZoomedOut = zoomOut;
    tileSize = zoomOut ? tileSize / 2 : tileSize * 2;
    viewportWidth = zoomOut ? viewportWidth * 2 : viewportWidth / 2;
    viewportHeight = zoomOut ? viewportHeight * 2 : viewportHeight / 2;

    const currentEntity = entities[currentEntityIndex] || player;
    camera = {
        x: currentEntity.x - Math.round((viewportWidth / 2)) + 1,
        y: currentEntity.y - Math.round((viewportHeight / 2)) + 1
    };

    canvas.init();
    update();

    if (window.cursorWorldPos && cursorVisible) {
        window.savedCursorScreenX = window.cursorWorldPos.x - camera.x;
        window.savedCursorScreenY = window.cursorWorldPos.y - camera.y;
    }
}

// Toggle a tile in/out of the edit selection
function toggleEditTileSelection(x, y) {
	const idx = selectedEditTiles.findIndex(t => t.x === x && t.y === y);
	if (idx >= 0) {
		selectedEditTiles.splice(idx, 1);
	} else {
		selectedEditTiles.push({x, y});
	}
}

// Walk the astar path from entity's current pos to (destX, destY) through validGrid,
// applying fire/water trait changes for every tile stepped on.
function applyPathTileEffects(entity, destX, destY) {
	const validGrid = createAndFillTwoDArray({rows: size, columns: size, defaultValue: 0});
	valid.forEach(v => { if (validGrid[v.x]?.[v.y] !== undefined) validGrid[v.x][v.y] = 1; });
	validGrid[entity.x][entity.y] = 1;
	const moveGraph = new Graph(validGrid, {diagonal: true});
	const movePath = astar.search(moveGraph, moveGraph.grid[entity.x][entity.y], moveGraph.grid[destX][destY]);
	applyTileEffects(entity, movePath);
}

function applyTileEffects(entity, movePath) {
	for (const step of movePath) {
		const onFire  = walls.some(w => w.x === step.x && w.y === step.y && w.type === 'fire');
		const onWater = walls.some(w => w.x === step.x && w.y === step.y && w.type === 'water');
		if (onFire && !helper.hasTrait(entity, 'fire')) {
			if (!entity.traits) entity.traits = [];
			entity.traits.push('fire');
			console.log(entity.name + " caught fire!");
		}
		if (onWater && helper.hasTrait(entity, 'fire')) {
			entity.traits = entity.traits.filter(t => t !== 'fire');
			console.log(entity.name + " got wet!");
		}
	}
}

// Valid Dash Attack path or null. Walls block, entities are passable; the walked
// path itself must fit within movement range so corners can't be cheesed.
function computeDashPath(entity, destX, destY) {
	if (calc.distance(entity.x, destX, entity.y, destY) > entity.range || helper.tileBlocked(destX, destY)) return null;
	const grid = createAndFillTwoDArray({rows: size, columns: size, defaultValue: 1});
	walls.forEach(w => {
		if (w.type !== 'water' && w.type !== 'fire' && !(w.type === 'door' && w.open)) grid[w.x][w.y] = 0;
	});
	const g = new Graph(grid, {diagonal: true});
	const path = astar.search(g, g.grid[entity.x][entity.y], g.grid[destX][destY]);
	//return (path.length > 0 && path.length <= entity.range) ? path : null;
	return (path.length > 0 && path.length <= entity.range + 1) ? path : null; // entity range + 1
}

function handleAbilityClick(key) {
	if (typeof WindowSystem !== 'undefined' && WindowSystem.isOpen()) return;
	const entity = getActivePlayerEntity();
	if (currentEntityIndex < 0 || entities[currentEntityIndex] !== entity) return;
	if (!key) return;
	if (specialMode) {
		if (key === specialMode) exitSpecialMode();
		return;
	}
	if (adjacentSelect || window.throwingGrenadeIndex !== undefined) return;
	if (abilityTypes[key].canUse(entity)) return;
	useSpecialMode(entity, key);
}

// Returns true when keystrokes should be left to the browser (the user is
// typing in a text input, textarea, or contenteditable element). Checkboxes,
// ranges, file pickers, buttons, and plain <select>s don't count — they don't
// accept text and shouldn't suppress game hotkeys.
function isTypingInTextField() {
	const a = document.activeElement;
	if (!a) return false;
	if (a.isContentEditable) return true;
	if (a.tagName === 'TEXTAREA') return true;
	if (a.tagName === 'INPUT') {
		const type = (a.type || 'text').toLowerCase();
		return !['checkbox', 'radio', 'range', 'file', 'button', 'submit', 'reset', 'color', 'image'].includes(type);
	}
	return false;
}

var input = {
    init: function() {
        window.cursorWorldPos = {x: player.x, y: player.y};
        cursorVisible = true;
    },

    keyboard: function(event) {
        // Hands off if the user is typing in a text input — let the browser handle it.
        if (isTypingInTextField()) return;
        if (EntitySystem._explosionPending) return;
        if (turns._playerTurnEndPending) return;

        if (typeof WindowSystem !== 'undefined') {
            if (activeContextMenu || WindowSystem.isOpen()) {
                WindowSystem.handleKeyboard(event);
                return;
            }
        }

        if (uiGridSelect && !(event.keyCode >= 48 && event.keyCode <= 57)) {
            if (event.type !== 'keydown') return;
            if ([37, 38, 39, 40].includes(event.keyCode)) {
                event.preventDefault();
                const d = {37: [-1, 0], 38: [0, -1], 39: [1, 0], 40: [0, 1]}[event.keyCode];
                moveUIGridSelect(d[0], d[1]);
            } else if (event.keyCode === 13) {
                event.preventDefault();
                UI_GRIDS[uiGridSelect.grid].activate(uiGridSelect.slot);
            } else if (event.keyCode === 191) {
                event.preventDefault();
                UI_GRIDS[uiGridSelect.grid].contextMenu(uiGridSelect.slot);
            } else if (event.keyCode === 27) {
                closeUIGridSelect();
            } else if (event.keyCode === 65) {
                openUIGridSelect('ability');
            } else if (event.keyCode === 73 && !event.shiftKey) {
                openUIGridSelect('inventory', INVENTORY_COLS);
            }
            return;
        }

        if (currentEntityIndex >= 0 && entities[currentEntityIndex] && !isPlayerControlled(entities[currentEntityIndex]) && allPlayers.length > 0) return;

        // SPACE KEY - Toggle aim mode
        if (event.keyCode === 32) {
            event.preventDefault();
            if (event.type === 'keydown' && !isAiming) {
                isAiming = true;
                updateCamera();
                canvas.init();
                update();
            } else if (event.type === 'keyup' && isAiming) {
                isAiming = false;
                if (window.cursorWorldPos && cursorVisible) {
                    window.savedCursorScreenX = window.cursorWorldPos.x - camera.x;
                    window.savedCursorScreenY = window.cursorWorldPos.y - camera.y;
                }
                updateCamera();
                canvas.init();
                if (window.cursorWorldPos) {
                    window.cursorWorldPos.x = Math.max(camera.x, Math.min(camera.x + viewportWidth - 1, window.cursorWorldPos.x));
                    window.cursorWorldPos.y = Math.max(camera.y, Math.min(camera.y + viewportHeight - 1, window.cursorWorldPos.y));
                }
                update();
            }
            return;
        }

        // Z KEY - Toggle zoom
        if (event.keyCode === 90) {
            if (event.type === 'keydown') {
                if (!isZoomedOut) handleZoom(true);
                else handleZoom(false);
            }
            return;
        }

        // C KEY - Center cursor on the active player entity
        if (event.keyCode === 67 && !isAiming) {
            if (event.type === 'keydown') {
                keyboardMode = true;
                cursorVisible = true;
                const activeEnt = getActivePlayerEntity();
                window.cursorWorldPos = {x: activeEnt.x, y: activeEnt.y};
                update();
            }
            return;
        }

        if (event.type !== 'keydown' && event.keyCode !== 32) return;

        if ([37, 38, 39, 40].includes(event.keyCode)) {
            event.preventDefault();
            const activeEnt = getActivePlayerEntity();
            if (!keyboardMode) window.cursorWorldPos = {x: activeEnt.x, y: activeEnt.y};
            keyboardMode = true;
            cursorVisible = true;
            const moveDistance = event.shiftKey ? 3 : 1;
            switch(event.keyCode) {
                case 37: window.cursorWorldPos.x -= moveDistance; break;
                case 38: window.cursorWorldPos.y -= moveDistance; break;
                case 39: window.cursorWorldPos.x += moveDistance; break;
                case 40: window.cursorWorldPos.y += moveDistance; break;
            }
            window.cursorWorldPos.x = Math.max(0, Math.min(size - 1, window.cursorWorldPos.x));
            window.cursorWorldPos.y = Math.max(0, Math.min(size - 1, window.cursorWorldPos.y));
            window.cursorWorldPos.x = Math.max(camera.x, Math.min(camera.x + viewportWidth - 1, window.cursorWorldPos.x));
            window.cursorWorldPos.y = Math.max(camera.y, Math.min(camera.y + viewportHeight - 1, window.cursorWorldPos.y));
            if (isAiming) { updateCamera(); canvas.init(); }
            update();
            return;
        }

        if (event.keyCode === 13) {
            event.preventDefault();
            if (keyboardMode && currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex])) {
                input.click();
            }
            return;
        }

        if (event.keyCode === 191) {
            event.preventDefault();
            if (window.cursorWorldPos) {
                const rect = c.getBoundingClientRect();
                const syntheticEvent = {
                    preventDefault: () => {},
                    clientX: rect.left + (window.cursorWorldPos.x - camera.x) * tileSize + tileSize / 2,
                    clientY: rect.top  + (window.cursorWorldPos.y - camera.y) * tileSize + tileSize / 2
                };
                input.right_click(syntheticEvent);
            }
            return;
        }

        if (event.keyCode === 27) {
            if (isAiming) {
                isAiming = false;
                updateCamera();
                canvas.init();
                if (window.cursorWorldPos) {
                    window.cursorWorldPos.x = Math.max(camera.x, Math.min(camera.x + viewportWidth - 1, window.cursorWorldPos.x));
                    window.cursorWorldPos.y = Math.max(camera.y, Math.min(camera.y + viewportHeight - 1, window.cursorWorldPos.y));
                }
                update();
            }
            if (window.throwingGrenadeIndex !== undefined) {
                window.throwingGrenadeIndex = undefined;
                console.log("Grenade throw cancelled");
                update();
            } else if (adjacentSelect) {
                exitAdjacentSelect();
            } else if (specialMode) {
                exitSpecialMode();
            } else if (edit.checked) {
                selectedEditTiles = [];
                edit.checked = false;
                document.getElementById('size-input-container').style.display = 'none';
            }
            return;
        }

        if (event.shiftKey && event.keyCode === 69) {
            edit.checked = !edit.checked;
            if (!edit.checked) selectedEditTiles = [];
            document.getElementById('size-input-container').style.display = edit.checked ? 'inline-block' : 'none';
            update();
            return;
        }

        if (event.shiftKey && event.keyCode === 73) { // Shift+I toggles the inventory display
            inventoryHidden = !inventoryHidden;
            update();
            return;
        }

        if (event.keyCode === 73) {
            if (currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex]) &&
                !specialMode &&
                !adjacentSelect && window.throwingGrenadeIndex === undefined) {
                openUIGridSelect('inventory', INVENTORY_COLS);
            }
            return;
        }

        if (event.keyCode === 82) {
            if (currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex])) {
                const activeEnt = getActivePlayerEntity();
                if (reloadWeapon(activeEnt)) {
                    exitSpecialMode();
                    turns.checkStandingTileEffects(activeEnt);
                    currentEntityTurnsRemaining--;
                    update();
                }
            }
            return;
        }

        if (event.keyCode === 71) { // G - grab
            if (!adjacentSelect) activateGrabMode();
            else exitAdjacentSelect();
            return;
        }

        if (event.keyCode === 68) { // D - door
            if (!adjacentSelect) activateDoorMode();
            else exitAdjacentSelect();
            return;
        }

        if (event.keyCode === 222) { // Apostrophe - autotargetting
            event.preventDefault();

            if (currentEntityIndex < 0 || !isPlayerControlled(entities[currentEntityIndex])) return;

            const activeEnt = getActivePlayerEntity();
            let targetX = null;
            let targetY = null;

            if (action.value === "attack") {
                const range = getEntityAttackRange(activeEnt);
                const donorMode = specialMode === 'donor';
                const visibleEnemies = entities.filter(e =>
                    e !== activeEnt &&
                    e.hp > 0 && !helper.isGrenadeEntity(e) &&
                    (donorMode ? canDonateTo(activeEnt, e) : (!isPlayerControlled(e) && (e.seenX !== 0 || e.seenY !== 0))) &&
                    EntitySystem.hasLOS(activeEnt, e.x, e.y, true) &&
                    e.x >= camera.x && e.x < camera.x + viewportWidth &&
                    e.y >= camera.y && e.y < camera.y + viewportHeight &&
                    calc.distance(activeEnt.x, e.x, activeEnt.y, e.y) <= range
                );

                if (visibleEnemies.length > 0) {
                    if (window.targetIndex === undefined) window.targetIndex = 0;
                    else window.targetIndex = (window.targetIndex + 1) % visibleEnemies.length;

                    const target = visibleEnemies[window.targetIndex];
                    targetX = target.x;
                    targetY = target.y;
                }
            } 
            else if (action.value === "move") {
                const visibleItems = mapItems.filter(item =>
                    hasPermissiveLOS(activeEnt.x, activeEnt.y, item.x, item.y) &&
                    item.x >= camera.x && item.x < camera.x + viewportWidth &&
                    item.y >= camera.y && item.y < camera.y + viewportHeight
                );
                const visibleFriends = allPlayers.filter(friend =>
                    friend !== activeEnt &&
                    hasPermissiveLOS(activeEnt.x, activeEnt.y, friend.x, friend.y) &&
                    friend.x >= camera.x && friend.x < camera.x + viewportWidth &&
                    friend.y >= camera.y && friend.y < camera.y + viewportHeight
                );
                const visibleTargets = [...new Set([...visibleItems, ...visibleFriends])];

                if (visibleTargets.length > 0) {
                    if (window.itemTargetIndex === undefined) window.itemTargetIndex = 0;
                    else window.itemTargetIndex = (window.itemTargetIndex + 1) % visibleTargets.length;

                    const target = visibleTargets[window.itemTargetIndex];
                    targetX = target.x;
                    targetY = target.y;
                }
            }

            if (targetX !== null && targetY !== null) {
                helper.moveCursorTo(targetX, targetY, false);
            }
            return;
        }

        if (event.keyCode === 188) {
            if (currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex]) && currentEntityTurnsRemaining > 0) {
                const activeEnt = getActivePlayerEntity();
                if (typeof pickupItem !== 'undefined') {
                    pickupItem(activeEnt, activeEnt.x, activeEnt.y);
                }
                if (typeof WindowSystem !== 'undefined' && WindowSystem.isOpen()) return;
                update();
            }
            return;
        }

        if (event.keyCode === 190) {
            if (specialMode === 'peek') {
                exitSpecialMode();
                return;
            } else if (currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex]) && currentEntityTurnsRemaining > 0) {
                if (typeof WindowSystem !== 'undefined' && WindowSystem.isOpen()) return;
                const activeEnt = getActivePlayerEntity();
                turns.checkStandingTileEffects(activeEnt);
                currentEntityTurnsRemaining--;
                console.log(activeEnt.name + " waits...");
                update();
            }
            return;
        }

        // Number keys 1..0 -> use hotbar slot (top row of inventory)
        if (event.keyCode >= 48 && event.keyCode <= 57) {
            if (typeof WindowSystem !== 'undefined' && WindowSystem.isOpen()) return;
            if (currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex])) {
                let slotIndex = event.keyCode - 49;
                if (event.keyCode === 48) slotIndex = 9;
                const activeEnt = getActivePlayerEntity();
                const inv = getInventory(activeEnt);
                if (activeEnt.abilityHotbar && activeEnt.abilityHotbar[slotIndex]) {
                    handleAbilityClick(activeEnt.abilityHotbar[slotIndex]);
                } else if (slotIndex >= 0 && slotIndex < INVENTORY_COLS && inv[slotIndex]) {
                    useItem(activeEnt, slotIndex);
                }
            }
            return;
        }

        if (event.keyCode === 9) {
            event.preventDefault();
            if (edit.checked) {
                const sel = document.getElementById('tile-type');
                sel.selectedIndex = (sel.selectedIndex + 1) % sel.options.length;
                update();
                return;
            }
            if (specialMode === 'peek' && peekStep === 2) return;
            if (specialMode && specialMode !== 'peek') return;
            action.value = (action.value === "move") ? "attack" : "move";
            document.activeElement.blur();
            window.targetIndex = 0;
            window.itemTargetIndex = 0;
            if (keyboardMode && window.cursorWorldPos) {
                update();
            } else {
                update();
                if (mouse_pos.clientX && mouse_pos.clientY) {
                    const evt = new MouseEvent('mousemove', {
                        clientX: mouse_pos.clientX,
                        clientY: mouse_pos.clientY
                    });
                    input.mouse(evt);
                }
            }
        }

        if (event.keyCode === 80) {
            activatePeekMode();
        }

        if (event.keyCode === 65) {
            if (currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex]) &&
                !specialMode &&
                !adjacentSelect && window.throwingGrenadeIndex === undefined) {
                if (event.shiftKey) WindowSystem.openAbilitiesWindow(getActivePlayerEntity());
                else openUIGridSelect('ability');
            }
            return;
        }
    },

    mouse: function(event) {
        if (turns._playerTurnEndPending) return;

        const rect = c.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;

        mouse_pos = {
            canvasX: canvasX,
            canvasY: canvasY,
            clientX: event.clientX,
            clientY: event.clientY
        };

        if (typeof WindowSystem !== 'undefined' && (activeContextMenu || WindowSystem.isOpen())) {
            WindowSystem.handleMouseMove(canvasX, canvasY);
            return;
        }

        // Inventory hover & drag tracking — runs every move regardless of mode
        const invSlot = getInventorySlotAt(canvasX, canvasY);
        if (window.inventoryHoverSlot !== invSlot) window.inventoryHoverSlot = invSlot;
        const abSlot = getAbilitySlotAt(canvasX, canvasY);
        window.abilityHoverSlot = (abSlot >= 0 && abilityAtBarSlot(getActivePlayerEntity(), abSlot)) ? abSlot : -1;
        if (window.inventoryDrag.startSlot >= 0) {
            window.inventoryDrag.mouse = { x: canvasX, y: canvasY };
            if (!window.inventoryDrag.isDragging) {
                const dx = canvasX - window.inventoryDrag.startMouse.x;
                const dy = canvasY - window.inventoryDrag.startMouse.y;
                if (dx*dx + dy*dy > 16) window.inventoryDrag.isDragging = true;
            }
            window.inventoryDrag.overSlot = invSlot;
            update();
            return;
        }

        if (window.abilityDrag.key) {
            window.abilityDrag.mouse = { x: canvasX, y: canvasY };
            if (!window.abilityDrag.isDragging) {
                const dx = canvasX - window.abilityDrag.startMouse.x;
                const dy = canvasY - window.abilityDrag.startMouse.y;
                if (dx*dx + dy*dy > 16) window.abilityDrag.isDragging = true;
            }
            update();
            return;
        }

        if (keyboardMode) keyboardMode = false;

        const gridX = Math.floor(canvasX / tileSize);
        const gridY = Math.floor(canvasY / tileSize);

        const oldCameraX = camera.x;
        const oldCameraY = camera.y;

        const clampedGridX = Math.max(0, Math.min(viewportWidth - 1, gridX));
        const clampedGridY = Math.max(0, Math.min(viewportHeight - 1, gridY));

        let worldX = camera.x + clampedGridX;
        let worldY = camera.y + clampedGridY;

        window.cursorWorldPos = {
            x: Math.max(0, Math.min(size - 1, worldX)),
            y: Math.max(0, Math.min(size - 1, worldY))
        };
        cursorVisible = true;

        if (isAiming) {
            updateCamera();
            canvas.init();
            if (camera.x !== oldCameraX || camera.y !== oldCameraY) {
                worldX = camera.x + clampedGridX;
                worldY = camera.y + clampedGridY;
                window.cursorWorldPos = {
                    x: Math.max(0, Math.min(size - 1, worldX)),
                    y: Math.max(0, Math.min(size - 1, worldY))
                };
            }
        }

        if (edit.checked && isMouseDown && !activeContextMenu && !WindowSystem.isOpen()) {
            const click_pos = {
                x: camera.x + gridX,
                y: camera.y + gridY
            };
            if (click_pos.x < 0 || click_pos.y < 0 || click_pos.x >= size || click_pos.y >= size) return;
            // Shift held — selection drag, only wall tiles
            if (event.shiftKey) {
                const hasWall = walls.some(w => w.x === click_pos.x && w.y === click_pos.y);
                if (hasWall) {
                    const alreadySelected = selectedEditTiles.some(t => t.x === click_pos.x && t.y === click_pos.y);
                    if (!alreadySelected) {
                        selectedEditTiles.push({x: click_pos.x, y: click_pos.y});
                    }
                }
                update(); // always update so cursor follows mouse
                return;
            }
            if (!lastTile || lastTile.x !== click_pos.x || lastTile.y !== click_pos.y) {
                lastTile = {x: click_pos.x, y: click_pos.y};
                const tileType = document.getElementById('tile-type').value;
                const dup = walls.findIndex(el => el.x === click_pos.x && el.y === click_pos.y);
                if (dup < 0) walls.push(makeWallTile(click_pos.x, click_pos.y, tileType));
                else walls.splice(dup, 1);
                update();
            }
            return;
        }
        update();
    },

    click: function() {
        if (EntitySystem._explosionPending) return;
        if (turns._playerTurnEndPending) return;

        // Mousedown started over the inventory — that click was already handled in mouseup
        if (window.suppressNextClick) {
            window.suppressNextClick = false;
            return;
        }

        if (typeof WindowSystem !== 'undefined' && activeContextMenu) {
            const canvasX = mouse_pos.canvasX || 0;
            const canvasY = mouse_pos.canvasY || 0;
            WindowSystem.handleClick(canvasX, canvasY);
            return;
        }

        if (typeof WindowSystem !== 'undefined' && WindowSystem.isOpen()) {
            const canvasX = mouse_pos.canvasX || 0;
            const canvasY = mouse_pos.canvasY || 0;
            WindowSystem.handleClick(canvasX, canvasY);
            return;
        }

        if (edit.checked) return;

        if (!window.cursorWorldPos) return;

        const click_pos = {
            x: window.cursorWorldPos.x,
            y: window.cursorWorldPos.y
        };

        if (adjacentSelect) {
            const activeEnt = getActivePlayerEntity();
            const dist = calc.distance(activeEnt.x, click_pos.x, activeEnt.y, click_pos.y);

            if (adjacentSelect.mode === 'grab') {
                const hasItemsHere = helper.hasGrabbableAt(click_pos.x, click_pos.y);
                if (dist <= 1 && hasItemsHere) {
                    grabItemsFromTile(click_pos.x, click_pos.y);
                    if (!WindowSystem.isOpen()) adjacentSelect = null;
                    update();
                }
            } else if (adjacentSelect.mode === 'door') {
                const door = walls.find(w => w.x === click_pos.x && w.y === click_pos.y && w.type === 'door');
                if (dist <= 1 && door) {
                    if (adjacentSelect.useKey) lockDoorWithKey(activeEnt, door); else tryOpenDoor(activeEnt, door);
                    adjacentSelect = null;
                    update();
                }
            }
            return;
        }

        const activeEnt = getActivePlayerEntity();

        if (specialMode === 'dashAttack' && specialModeEntity === activeEnt) {
            executeAbility('dashAttack', activeEnt, click_pos.x, click_pos.y);
            return;
        }

        switch (action.value) {
            case "move":
                const validClick = valid.find(v => v.x === click_pos.x && v.y === click_pos.y);
                if (validClick) {
                    if (specialMode === 'peek' && peekStep === 1) {
                        specialModeEntity.x = click_pos.x;
                        specialModeEntity.y = click_pos.y;
                        specialModeEntity.range = savedPlayerRange;

                        peekStep = 2;
                        action.value = "attack";
                        action.disabled = true;
                        currentEntityTurnsRemaining--;
                        update();
                    } else {
                        applyPathTileEffects(activeEnt, click_pos.x, click_pos.y);
                        turns.move(activeEnt, click_pos.x, click_pos.y);
                    }
                }
                break;

            case "attack":
                if (window.throwingGrenadeIndex !== undefined) {
                    if (throwItem(activeEnt, window.throwingGrenadeIndex, click_pos.x, click_pos.y)) {
                        window.throwingGrenadeIndex = undefined;

                        turns.checkStandingTileEffects(activeEnt);
                        currentEntityTurnsRemaining--;

                        if (specialMode !== 'peek') action.value = "move";
                        update();
                    }
                    return;
                }

                if (specialMode !== 'donor' && !hasAmmo(activeEnt)) {
                    console.log("Out of ammo! Press R to reload.");
                    return;
                }

                const effectiveRange = getEntityAttackRange(activeEnt);
                const dist = calc.distance(activeEnt.x, click_pos.x, activeEnt.y, click_pos.y);
                const canBreach = canEntityBreach(activeEnt);
                const hasLOS = canBreach
                    ? hasBreachingLOS(activeEnt.x, activeEnt.y, click_pos.x, click_pos.y)
                    : hasPermissiveLOS(activeEnt.x, activeEnt.y, click_pos.x, click_pos.y);


                if (dist > effectiveRange || !hasLOS) return;

                if (specialMode === 'donor') {
                    executeAbility('donor', activeEnt, click_pos.x, click_pos.y);
                    return;
                }

                const targetingTiles = calculateEntityTargeting(activeEnt, click_pos.x, click_pos.y);
                const canDestroy = canEntityDestroyWalls(activeEnt);

                const targetsInArea = getTargetedEntities(activeEnt, click_pos.x, click_pos.y);
                const enemies = targetsInArea.filter(e => e !== activeEnt && e.hp > 0);
                const hasWalls = (canDestroy || canBreach) && targetingTiles.some(t => {
                    const w = walls.find(w => w.x === t.x && w.y === t.y);
                    return w && w.type !== 'glass' && w.type !== 'water' && w.type !== 'fire';
                });
                const hasBreakable = targetingTiles.some(t => walls.find(w => w.x === t.x && w.y === t.y && (w.type === 'glass' || w.type === 'door')));
                const hasTargets = targetingTiles.length > 0 && (enemies.length > 0 || hasWalls || hasBreakable);


                if (!hasTargets) return;

                if (specialMode === 'charm') {
                    executeAbility('charm', activeEnt, click_pos.x, click_pos.y);
                    return;
                }

                if (specialMode === 'magDump') {
                    executeAbility('magDump', activeEnt, click_pos.x, click_pos.y);
                    return;
                }

                if (specialMode === 'peek' && peekStep === 2) {
                    if (EntitySystem.attack(specialModeEntity, click_pos.x, click_pos.y)) {
                        turns.checkStandingTileEffects(specialModeEntity);
                        currentEntityTurnsRemaining--;
                    }
                    update();
                } else {
                    if (EntitySystem.attack(activeEnt, click_pos.x, click_pos.y)) {
                        turns.checkStandingTileEffects(activeEnt);
                        currentEntityTurnsRemaining--;
                        const newExplosion = EntitySystem._explosionPending || EntitySystem._explosionQueue.length > 0;
                        if (newExplosion) return;
                    }
                    update();
                }
                break;

            default:
                if (currentEntityTurnsRemaining <= 0) {
                    if (typeof processInventoryGrenades !== 'undefined') {
                        processInventoryGrenades(activeEnt);
                    }
                }
                update();
        }
    },

    right_click: function(event) {
        event.preventDefault();
        if (turns._playerTurnEndPending) return;
        if (typeof WindowSystem !== 'undefined' && (activeContextMenu || WindowSystem.isOpen())) return;
        if (uiGridSelect) { closeUIGridSelect(); return; }

        // Inventory right-click → context menu (Examine / Use|Equip / Drop)
        const rect = c.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        const invSlot = getInventorySlotAt(canvasX, canvasY);
        if (invSlot >= 0) {
            const rcEnt = getActivePlayerEntity();
            if (!getInventory(rcEnt)[invSlot] && rcEnt.abilityHotbar && rcEnt.abilityHotbar[invSlot]) {
                const io = getInventoryOrigin();
                showAbilityContextMenu(rcEnt.abilityHotbar[invSlot],
                    io.x + (invSlot % INVENTORY_COLS) * tileSize, io.y);
                return;
            }
            if (typeof showInventoryContextMenu === 'function') {
                showInventoryContextMenu(invSlot, event);
                return;
            }
        }

        // Ability bar right-click → context menu (Use + requirement)
        const abSlot = getAbilitySlotAt(canvasX, canvasY);
        if (abSlot >= 0) {
            const key = abilityAtBarSlot(getActivePlayerEntity(), abSlot);
            if (key) {
                const o = getAbilityBarOrigin();
                showAbilityContextMenu(key,
                    o.x + (abSlot % ABILITY_BAR_COLS) * tileSize,
                    o.y + ((abSlot / ABILITY_BAR_COLS) | 0) * tileSize);
                return;
            }
        }

        if (!window.cursorWorldPos) return;

        document.getElementById('spawn_x').value = window.cursorWorldPos.x;
        document.getElementById('spawn_y').value = window.cursorWorldPos.y;
        document.getElementById('player_x').value = window.cursorWorldPos.x;
        document.getElementById('player_y').value = window.cursorWorldPos.y;
        document.getElementById('item_x').value = window.cursorWorldPos.x;
        document.getElementById('item_y').value = window.cursorWorldPos.y;

        // Edit mode: if there are selected tiles OR right-clicking a wall, show the selection context menu
        if (edit.checked) {
            const clickedWallForMenu = walls.find(w => w.x === window.cursorWorldPos.x && w.y === window.cursorWorldPos.y);
            const clickedEntityForMenu = entities.find(e => e.x === window.cursorWorldPos.x && e.y === window.cursorWorldPos.y);
            // If an entity is clicked and there's no active multi-tile selection, fall through to normal entity options
            const hasMulitSelection = selectedEditTiles.length > 0;
            let menuTiles = hasMulitSelection ? selectedEditTiles : (!clickedEntityForMenu && clickedWallForMenu ? [{x: window.cursorWorldPos.x, y: window.cursorWorldPos.y}] : null);

            if (menuTiles && menuTiles.length > 0) {
                // Filter to only tiles that actually have walls (selection may include stale coords)
                menuTiles = menuTiles.filter(t => walls.some(w => w.x === t.x && w.y === t.y));
                if (menuTiles.length === 0) {
                    selectedEditTiles = [];
                    update();
                    return;
                }

                const options = [];
                const count = menuTiles.length;
                options.push({ text: count + " TILE" + (count > 1 ? "S" : "") + " SELECTED" });

                // Examine: only show if all tiles share the same wall type
                const firstType = walls.find(w => w.x === menuTiles[0].x && w.y === menuTiles[0].y)?.type;
                const allSameType = menuTiles.every(t => {
                    const w = walls.find(w => w.x === t.x && w.y === t.y);
                    return w && w.type === firstType;
                });
                if (allSameType && firstType) {
                    const representativeWall = walls.find(w => w.x === menuTiles[0].x && w.y === menuTiles[0].y);
                    options.push({
                        text: "(e) Examine",
                        key: "e",
                        action: function() {
                            WindowSystem.showExamineWindow(representativeWall);
                        }
                    });
                }

                options.push({
                    text: "(m) Make Permanent",
                    key: "m",
                    action: function() {
                        menuTiles.forEach(t => {
                            const wall = walls.find(w => w.x === t.x && w.y === t.y);
                            if (wall) wall.permanent = true;
                        });
                        console.log("Made " + menuTiles.length + " tile(s) permanent.");
                        selectedEditTiles = [];
                        update();
                    }
                });

                options.push({
                    text: "(r) Remove",
                    key: "r",
                    danger: true,
                    action: function() {
                        menuTiles.forEach(t => {
                            const idx = walls.findIndex(w => w.x === t.x && w.y === t.y);
                            if (idx >= 0) walls.splice(idx, 1);
                        });
                        console.log("Removed " + menuTiles.length + " tile(s).");
                        selectedEditTiles = [];
                        update();
                    }
                });

                const menuX = Math.ceil((event.clientX - rect.left) / tileSize) * tileSize - tileSize + 8;
                const menuY = Math.ceil((event.clientY - rect.top) / tileSize) * tileSize - tileSize / 2;
                const menu = WindowSystem.createContextMenu({
                    x: menuX, y: menuY,
                    tileX: window.cursorWorldPos.x,
                    tileY: window.cursorWorldPos.y,
                    options
                });
                WindowSystem.openContextMenu(menu);
                return;
            }
        }

        const clickedEntity = entities.find(e =>
            e.x === window.cursorWorldPos.x &&
            e.y === window.cursorWorldPos.y
        );
        const clickedItem = mapItems.find(e =>
            e.x === window.cursorWorldPos.x &&
            e.y === window.cursorWorldPos.y
        );
        const clickedWall = walls.find(e =>
            e.x === window.cursorWorldPos.x &&
            e.y === window.cursorWorldPos.y
        );

        if (!clickedEntity && !clickedItem && !clickedWall) return;

        const activeEnt = getActivePlayerEntity();
        const options = [];

        const clickedObject = clickedEntity || clickedWall || clickedItem;
        let displayName = "Unknown";

        if (clickedEntity) displayName = clickedEntity.name || "Entity";
        else if (clickedWall) displayName = clickedWall.type || "Wall";
        else if (clickedItem) {
            const itemsHere = mapItems.filter(m => m.x === window.cursorWorldPos.x && m.y === window.cursorWorldPos.y);
            const distinctTypes = new Set(itemsHere.map(m => m.itemType));
            displayName = distinctTypes.size === 1 ? itemTypes[clickedItem.itemType].displayName : "Items";
        }

        options.push({ text: displayName.toUpperCase() });
        if (clickedObject == activeEnt) options[0].text += " (current)";
        
        options.push({
            text: "(e) Examine",
            key: "e",
            action: function() {
                if (clickedEntity) WindowSystem.showExamineWindow(clickedEntity);
                else if (clickedItem) WindowSystem.showExamineWindow(clickedItem)
                else if (clickedWall) WindowSystem.showExamineWindow(clickedWall);
            }
        });

        if (!clickedEntity && clickedWall && clickedWall.type == "door") { // DOORS !!!!!!
            if (calc.distance(clickedWall.x, activeEnt.x, clickedWall.y, activeEnt.y) <= 1 || edit.checked) {
                options.push({
                    text: "(d) Open/Close: " + clickedWall.type,
                    key: "d",
                    action: function() {
                        tryOpenDoor(activeEnt, clickedWall);
                        update();
                    }
                });
            }
        }

        if (edit.checked) { // EDIT MODE ONLY OPTIONS
            
            if (clickedEntity) { // TRAITS & KILL options (entities only, not items or walls)
                options.push({
                    text: "(t) Traits",
                    key: "t",
                    action: function() {
                        WindowSystem.openTraitsWindow(clickedEntity);
                    }
                });
                options.push({
                    text: "(k) Kill",
                    key: "k",
                    danger: true,
                    action: function() {
                        clickedEntity.hp = 0;
                        EntitySystem.death(clickedEntity);
                        update();
                    }
                });
            }
            
            if (clickedEntity || clickedItem) { // REMOVE option (entities & items)
                options.push({
                    text: "(r) Remove",
                    key: "r",
                    danger: true,
                    action: function() {
                        if (clickedEntity) {
                            if (isPlayerControlled(clickedEntity)) {
                                if (allPlayers.length <= 1) {
                                    console.log("Cannot remove the only player!");
                                    return;
                                }
                                const idx = allPlayers.indexOf(clickedEntity);
                                if (idx >= 0) allPlayers.splice(idx, 1);
                                player = allPlayers[0];
                                if (typeof updatePlayerSelect === 'function') updatePlayerSelect();
                            } else {
                                const idx = allEnemies.indexOf(clickedEntity);
                                if (idx >= 0) allEnemies.splice(idx, 1);
                            }
                            console.log("Removed " + clickedEntity.name + ".");
                        } else if (clickedItem) {
                            // Remove all items at this tile
                            const cx = window.cursorWorldPos.x;
                            const cy = window.cursorWorldPos.y;
                            const before = mapItems.length;
                            for (let i = mapItems.length - 1; i >= 0; i--) {
                                if (mapItems[i].x === cx && mapItems[i].y === cy) mapItems.splice(i, 1);
                            }
                            console.log("Removed " + (before - mapItems.length) + " item(s) from tile.");
                        }
                        update();
                    }
                });
            }
        } else { // REGULAR OPTIONS
            // Grab option
            if (clickedItem && !clickedEntity) {
                const isActiveTurn = currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex]);
                const dist = calc.distance(activeEnt.x, window.cursorWorldPos.x, activeEnt.y, window.cursorWorldPos.y);
                if (isActiveTurn && dist <= 1 && dist > 0) {
                    options.push({
                        text: "(g) Grab",
                        key: "g",
                        action: function() {
                            grabItemsFromTile(window.cursorWorldPos.x, window.cursorWorldPos.y);
                            update();
                        }
                    });
                }
            }

            // Follow / Transfer options for player entities
            if (isPlayerControlled(clickedEntity) && clickedEntity !== activeEnt) {
                if (clickedEntity.following === activeEnt) {
                    options.push({
                        text: "(f) remove Follower",
                        key: "f",
                        action: function() {
                            console.log(clickedEntity.name + " stopped following " + activeEnt.name + ".");
                            clickedEntity.following = null;
                            groupLeadsWithFollowers();
                            update();
                        }
                    });
                } else if (!activeEnt.following) {
                    options.push({
                        text: "(f) Follow",
                        key: "f",
                        action: function() {
                            startFollowing(activeEnt, clickedEntity);
                            update();
                        }
                    });
                }

                const clickedIdx = entities.indexOf(clickedEntity);
                const isActiveTurn = isPlayerControlled(entities[currentEntityIndex]) && entities[currentEntityIndex] === activeEnt;
                const turnAvailable = clickedIdx > currentEntityIndex;

                if (isActiveTurn && turnAvailable && currentEntityTurnsRemaining >= activeEnt.turns && !clickedEntity.following) {
                    options.push({
                        text: "(t) Transfer Turn",
                        key: "t",
                        action: function() {
                            const giverIdx    = allPlayers.indexOf(activeEnt);
                            const receiverIdx = allPlayers.indexOf(clickedEntity);
                            const receiverEnemyIdx = allEnemies.indexOf(clickedEntity);
                            if (giverIdx >= 0 && receiverIdx >= 0) {
                                allPlayers[giverIdx]    = clickedEntity;
                                allPlayers[receiverIdx] = activeEnt;
                            } else if (giverIdx >= 0 && receiverEnemyIdx >= 0) {
                                allPlayers[giverIdx]      = clickedEntity;
                                allEnemies[receiverEnemyIdx] = activeEnt;
                            }
                            console.log(activeEnt.name + " transfers turn to " + clickedEntity.name + ".");
                            update();
                        }
                    });
                }
            }
        }

        if (options.length > 0) {
            const menuX = Math.ceil((event.clientX - rect.left) / tileSize) * tileSize - tileSize + 8;
            const menuY = Math.ceil((event.clientY - rect.top) / tileSize) * tileSize - tileSize / 2;

            const menu = WindowSystem.createContextMenu({
                x: menuX,
                y: menuY,
                tileX: window.cursorWorldPos.x,
                tileY: window.cursorWorldPos.y,
                options
            });

            WindowSystem.openContextMenu(menu);
        }
    },

    mousedown: function(event) {
        if (EntitySystem._explosionPending) return;
        if (turns._playerTurnEndPending) return;
        if (event.button !== 0) return;

        // If a window or context menu is open, let WindowSystem own the click — don't capture
        // it as an inventory interaction even if it happens to land over inventory.
        if (typeof WindowSystem !== 'undefined' && (activeContextMenu || WindowSystem.isOpen())) return;

        if (uiGridSelect) {
            closeUIGridSelect();
            window.suppressNextClick = true;
            return;
        }

        const rect = c.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;

        // INVENTORY mousedown — starts a drag (or click candidate). Always suppress the
        // subsequent map click so we don't accidentally move/attack at the cursor world pos.
        const invSlot = getInventorySlotAt(canvasX, canvasY);
        if (invSlot >= 0) {
            window.suppressNextClick = true;
            const activeEnt = getActivePlayerEntity();
            const inv = getInventory(activeEnt);
            if (inv[invSlot]) {
                window.inventoryDrag.startSlot = invSlot;
                window.inventoryDrag.startMouse = { x: canvasX, y: canvasY };
                window.inventoryDrag.mouse = { x: canvasX, y: canvasY };
                window.inventoryDrag.isDragging = false;
                window.inventoryDrag.overSlot = invSlot;
                window.inventoryDrag.item = inv[invSlot];
            } else if (activeEnt.abilityHotbar && activeEnt.abilityHotbar[invSlot]) {
                window.abilityDrag.key = activeEnt.abilityHotbar[invSlot];
                window.abilityDrag.startMouse = { x: canvasX, y: canvasY };
                window.abilityDrag.mouse = { x: canvasX, y: canvasY };
                window.abilityDrag.isDragging = false;
            }
            isMouseDown = false; // don't trigger edit-mode drag paint
            return;
        }

        // ABILITY BAR mousedown — starts a drag (or click candidate), suppress the map click.
        const abSlot = getAbilitySlotAt(canvasX, canvasY);
        if (abSlot >= 0) {
            const key = abilityAtBarSlot(getActivePlayerEntity(), abSlot);
            if (key) {
                window.suppressNextClick = true;
                isMouseDown = false;
                window.abilityDrag.key = key;
                window.abilityDrag.startMouse = { x: canvasX, y: canvasY };
                window.abilityDrag.mouse = { x: canvasX, y: canvasY };
                window.abilityDrag.isDragging = false;
                return;
            }
        }

        isMouseDown = true;

        if (edit.checked && window.cursorWorldPos && !activeContextMenu && !WindowSystem.isOpen()) {
            const click_pos = {
                x: window.cursorWorldPos.x,
                y: window.cursorWorldPos.y
            };
            if (click_pos.x < 0 || click_pos.y < 0 || click_pos.x >= size || click_pos.y >= size) return;

            // Shift held — add wall tiles to selection only
            if (event.shiftKey) {
                const hasWall = walls.some(w => w.x === click_pos.x && w.y === click_pos.y);
                if (hasWall) toggleEditTileSelection(click_pos.x, click_pos.y);
                update();
                return;
            }

            // Normal click while selection exists — clear selection, don't toggle wall
            if (selectedEditTiles.length > 0) {
                selectedEditTiles = [];
                update();
                return;
            }

            // Normal click — toggle wall
            lastTile = {x: click_pos.x, y: click_pos.y};
            const tileType = document.getElementById('tile-type').value;
            const dup = walls.findIndex(el => el.x === click_pos.x && el.y === click_pos.y);
            if (dup < 0) walls.push(makeWallTile(click_pos.x, click_pos.y, tileType));
            else walls.splice(dup, 1);
            update();
        }
    },

    mouseup: function(event) {
        if (event.button !== 0) return;
        isMouseDown = false;
        lastTile = null;

        if (window.inventoryDrag.startSlot >= 0) {
            const drag = window.inventoryDrag;
            const activeEnt = getActivePlayerEntity();

            if (drag.isDragging) {
                if (drag.overSlot >= 0 && drag.overSlot !== drag.startSlot) {
                    swapInventorySlots(activeEnt, drag.startSlot, drag.overSlot);
                }
                resetInventoryDrag();
                update();
            } else if (drag.item) {
                resetInventoryDrag();
                useItem(activeEnt, drag.startSlot);
            } else {
                resetInventoryDrag();
            }
        }

        if (window.abilityDrag.key) {
            const ad = window.abilityDrag;
            const activeEnt = getActivePlayerEntity();
            if (ad.isDragging) {
                syncAbilityBar(activeEnt);
                const hb = activeEnt.abilityHotbar;
                const bs = activeEnt.abilityBarSlots;
                const t = getInventorySlotAt(ad.mouse.x, ad.mouse.y);
                const b = getAbilitySlotAt(ad.mouse.x, ad.mouse.y);
                let fromBar = -1;
                for (const s in bs) if (bs[s] === ad.key) { fromBar = +s; delete bs[s]; }
                for (const s in hb) if (hb[s] === ad.key) delete hb[s];
                if (t >= 0 && t < INVENTORY_COLS && !getInventory(activeEnt)[t] && !hb[t]) {
                    hb[t] = ad.key;
                } else if (b >= 0) {
                    const occupant = bs[b];
                    if (occupant && fromBar >= 0) bs[fromBar] = occupant;
                    bs[b] = ad.key;
                }
                syncAbilityBar(activeEnt);
                resetAbilityDrag();
                update();
            } else {
                const key = ad.key;
                resetAbilityDrag();
                handleAbilityClick(key);
            }
        }
    }
};