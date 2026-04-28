// INPUT.JS: HANDLES USER INPUT

var isMouseDown = false;
var lastTile = null;
var keyboardMode = false;
var cursorVisible = true;
var isAiming = false;
var aimCamera = null;
var isZoomedOut = false;
var lastCameraUpdateCursorX = null;
var lastCameraUpdateCursorY = null;

// Grab mode variables
var isGrabMode = false;

function exitGrabMode() {
	if (!isGrabMode) return;
	isGrabMode = false;
	console.log("Exited grab mode.");
	update();
}

function activateGrabMode() {
	if (currentEntityIndex < 0 || !isPlayerControlled(entities[currentEntityIndex])) return;
	const activeEnt = getActivePlayerEntity();
	const hasItemsOnSelf = mapItems.some(item => item.x === activeEnt.x && item.y === activeEnt.y);
	const adjacentWithItems = helper.getAdjacentTiles(activeEnt.x, activeEnt.y, true)
		.filter(tile => mapItems.some(item => item.x === tile.x && item.y === tile.y));

	if (hasItemsOnSelf && adjacentWithItems.length === 0) {
		grabItemsFromTile(activeEnt.x, activeEnt.y);
		update();
		return;
	}

	if (!hasItemsOnSelf && adjacentWithItems.length === 0) {
		console.log("No items within reach.");
		return;
	}

	isGrabMode = true;
	console.log("Grab mode: select an adjacent tile to grab items from.");
	update();
}

function grabItemsFromTile(x, y) {
	const activeEnt = getActivePlayerEntity();
	const itemsAtTile = mapItems.filter(item => item.x === x && item.y === y);
	if (itemsAtTile.length === 0) return false;

	const origX = activeEnt.x;
	const origY = activeEnt.y;
	activeEnt.x = x;
	activeEnt.y = y;
	pickupItem(activeEnt, x, y);
	activeEnt.x = origX;
	activeEnt.y = origY;
	return true;
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

var input = {
    init: function() {
        window.cursorWorldPos = {x: player.x, y: player.y};
        cursorVisible = true;
    },

    keyboard: function(event) {
        if (allPlayers.length === 0) return;

        if (typeof WindowSystem !== 'undefined') {
            if (activeContextMenu || WindowSystem.isOpen()) {
                WindowSystem.handleKeyboard(event);
                return;
            }
        }

        if (currentEntityIndex < 0 || !isPlayerControlled(entities[currentEntityIndex])) return;

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
            } else if (isGrabMode) {
                exitGrabMode();
            } else if (isPeekMode) {
                exitPeekMode();
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

        if (event.keyCode === 82) {
            if (currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex])) {
                const activeEnt = getActivePlayerEntity();
                if (reloadWeapon(activeEnt)) {
                    exitPeekMode();
                    currentEntityTurnsRemaining--;
                    if (currentEntityTurnsRemaining <= 0) {
                        currentEntityIndex++;
                        if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
                        currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
                    }
                    update();
                }
            }
            return;
        }

        if (event.keyCode === 71) {
            if (!isGrabMode) activateGrabMode();
            else exitGrabMode();
            return;
        }

        if (event.keyCode === 222) {
            event.preventDefault();
            if (currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex])) {
                keyboardMode = true;
                cursorVisible = true;
                const activeEnt = getActivePlayerEntity();

                if (action.value === "attack") {
                    const range = getEntityAttackRange(activeEnt);
                    const visibleEnemies = entities.filter(e =>
                        !isPlayerControlled(e) &&
                        e.hp > 0 &&
                        (e.seenX !== 0 || e.seenY !== 0) &&
                        EntitySystem.hasLOS(activeEnt, e.x, e.y, true) &&
                        e.x >= camera.x && e.x < camera.x + viewportWidth &&
                        e.y >= camera.y && e.y < camera.y + viewportHeight &&
                        calc.distance(activeEnt.x, e.x, activeEnt.y, e.y) <= range
                    );
                    if (visibleEnemies.length > 0) {
                        if (window.targetIndex === undefined) window.targetIndex = 0;
                        else window.targetIndex = (window.targetIndex + 1) % visibleEnemies.length;
                        const target = visibleEnemies[window.targetIndex];
                        window.cursorWorldPos = {x: target.x, y: target.y};
                        update();
                    }
                } else if (action.value === "move") {
                    const visibleItems = mapItems.filter(item =>
                        hasPermissiveLOS(activeEnt.x, activeEnt.y, item.x, item.y) &&
                        item.x >= camera.x && item.x < camera.x + viewportWidth &&
                        item.y >= camera.y && item.y < camera.y + viewportHeight
                        );
                    const visibleFriends = allPlayers.filter(friend =>
                        friend != activeEnt &&
                        hasPermissiveLOS(activeEnt.x, activeEnt.y, friend.x, friend.y) &&
                        friend.x >= camera.x && friend.x < camera.x + viewportWidth &&
                        friend.y >= camera.y && friend.y < camera.y + viewportHeight
                    );
                    const visibleTargets = [...new Set([...visibleItems, ...visibleFriends])];
                    if (visibleTargets.length > 0) {
                        if (window.itemTargetIndex === undefined) window.itemTargetIndex = 0;
                        else window.itemTargetIndex = (window.itemTargetIndex + 1) % visibleTargets.length;
                        const target = visibleTargets[window.itemTargetIndex];
                        window.cursorWorldPos = {x: target.x, y: target.y};
                        update();
                    }
                }
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
            if (isPeekMode) {
                exitPeekMode();
                return;
            } else if (currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex]) && currentEntityTurnsRemaining > 0) {
                if (typeof WindowSystem !== 'undefined' && WindowSystem.isOpen()) return;
                const activeEnt = getActivePlayerEntity();
                currentEntityTurnsRemaining--;
                console.log(activeEnt.name + " waits...");
                update();
            }
            return;
        }

        if (event.keyCode >= 48 && event.keyCode <= 57) {
            if (typeof WindowSystem !== 'undefined' && WindowSystem.isOpen()) return;
            if (currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex])) {
                let slotIndex = event.keyCode - 49;
                if (event.keyCode === 48) slotIndex = 9;
                const activeEnt = getActivePlayerEntity();
                if (slotIndex >= 0 && slotIndex < activeEnt.inventory.length) {
                    if (typeof useItem !== 'undefined') useItem(activeEnt, slotIndex);
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
            if (isPeekMode && peekStep === 2) return;
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
    },

    mouse: function(event) {
        if (allPlayers.length === 0) return;

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
                if (dup < 0) walls.push({x: click_pos.x, y: click_pos.y, type: tileType});
                else walls.splice(dup, 1);
                update();
            }
            return;
        }
        update();
    },

    click: function() {
        if (allPlayers.length === 0) return;

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

        if (isGrabMode) {
            const activeEnt = getActivePlayerEntity();
            const dist = calc.distance(activeEnt.x, click_pos.x, activeEnt.y, click_pos.y);
            const hasItemsHere = mapItems.some(item => item.x === click_pos.x && item.y === click_pos.y);
            if (dist <= 1 && hasItemsHere) {
                grabItemsFromTile(click_pos.x, click_pos.y);
                if (!WindowSystem.isOpen()) isGrabMode = false;
                update();
            }
            return;
        }

        const activeEnt = getActivePlayerEntity();

        switch (action.value) {
            case "move":
                const validClick = valid.find(v => v.x === click_pos.x && v.y === click_pos.y);
                if (validClick) {
                    if (isPeekMode && peekStep === 1) {
                        peekEntity.x = click_pos.x;
                        peekEntity.y = click_pos.y;
                        peekEntity.range = savedPlayerRange;

                        peekStep = 2;
                        action.value = "attack";
                        action.disabled = true;
                        currentEntityTurnsRemaining--;
                        update();
                    } else {
                        turns.move(activeEnt, click_pos.x, click_pos.y);
                    }
                }
                break;

            case "attack":
                if (window.throwingGrenadeIndex !== undefined) {
                    if (throwItem(activeEnt, window.throwingGrenadeIndex, click_pos.x, click_pos.y)) {
                        window.throwingGrenadeIndex = undefined;

                        currentEntityTurnsRemaining--;

                        if (isPeekMode) {
                            if (peekStep === 2) {
                                peekEntity.x = peekStartX;
                                peekEntity.y = peekStartY;
                            }
                            isPeekMode = false;
                            peekStep = 1;
                            peekEntity = null;
                            action.disabled = false;
                            console.log("Exited peek mode.");
                        }

                        action.value = "move";
                        update();
                    }
                    return;
                }

                if (!hasAmmo(activeEnt)) {
                    console.log("Out of ammo! Press R to reload.");
                    return;
                }

                const effectiveRange = getEntityAttackRange(activeEnt);
                const dist = calc.distance(activeEnt.x, click_pos.x, activeEnt.y, click_pos.y);
                const hasLOS = hasPermissiveLOS(activeEnt.x, activeEnt.y, click_pos.x, click_pos.y);

                if (dist > effectiveRange || !hasLOS) return;

                const targetingTiles = calculateEntityTargeting(activeEnt, click_pos.x, click_pos.y);
                const accessoryDef = activeEnt.equipment?.accessory ? itemTypes[activeEnt.equipment.accessory.itemType] : null;
                const weaponDef = activeEnt.equipment?.weapon ? itemTypes[activeEnt.equipment.weapon.itemType] : null;
                const canDestroy = weaponDef?.canDestroy || accessoryDef?.grantsDestroy;

                const targetsInArea = getTargetedEntities(activeEnt, click_pos.x, click_pos.y);
                const enemies = targetsInArea.filter(e => e !== activeEnt && e.hp > 0);
                const hasWalls = canDestroy && targetingTiles.some(t => {
                    const w = walls.find(w => w.x === t.x && w.y === t.y);
                    return w && w.type !== 'glass';
                });
                const hasGlass = targetingTiles.some(t => walls.find(w => w.x === t.x && w.y === t.y && w.type === 'glass'));
                const hasTargets = targetingTiles.length > 0 && (enemies.length > 0 || hasWalls || hasGlass);

                if (!hasTargets) return;

                if (isPeekMode && peekStep === 2) {
                    if (EntitySystem.attack(peekEntity, click_pos.x, click_pos.y)) {
                        currentEntityTurnsRemaining--;
                    }
                    peekEntity.x = peekStartX;
                    peekEntity.y = peekStartY;

                    isPeekMode = false;
                    peekStep = 1;
                    peekEntity = null;
                    action.disabled = false;
                    action.value = "move";
                    console.log("Exited peek mode.");
                    update();
                } else {
                    if (EntitySystem.attack(activeEnt, click_pos.x, click_pos.y)) {
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
            // Build the working tile set: selected tiles if any, otherwise just the clicked wall
            let menuTiles = selectedEditTiles.length > 0 ? selectedEditTiles : (clickedWallForMenu ? [{x: window.cursorWorldPos.x, y: window.cursorWorldPos.y}] : null);

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

                const rect = c.getBoundingClientRect();
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
        else if (clickedItem) displayName = "Items";

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
                            update();
                        }
                    });
                } else {
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

                if (isActiveTurn && turnAvailable && currentEntityTurnsRemaining >= activeEnt.turns) {
                    options.push({
                        text: "(t) Transfer Turn",
                        key: "t",
                        action: function() {
                            const giverIdx    = allPlayers.indexOf(activeEnt);
                            const receiverIdx = allPlayers.indexOf(clickedEntity);
                            if (giverIdx >= 0 && receiverIdx >= 0) {
                                allPlayers[giverIdx]    = clickedEntity;
                                allPlayers[receiverIdx] = activeEnt;
                            }
                            console.log(activeEnt.name + " transfers turn to " + clickedEntity.name + ".");
                            update();
                        }
                    });
                }
            }
        }

        if (options.length > 0) {
            const rect = c.getBoundingClientRect();
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
        if (event.button === 0) {
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
                if (dup < 0) walls.push({x: click_pos.x, y: click_pos.y, type: tileType});
                else walls.splice(dup, 1);
                update();
            }
        }
    },

    mouseup: function(event) {
        if (event.button === 0) {
            isMouseDown = false;
            lastTile = null;
        }
    }
};