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
        const maxPanDistance = Math.round(euclideanDist / 3) * dampening;

        const playerCameraX = activeEnt.x - Math.floor(viewportWidth / 2) + 1;
        const playerCameraY = activeEnt.y - Math.floor(viewportHeight / 2) + 1;

        let desiredCameraX = window.cursorWorldPos.x - Math.floor(viewportWidth / 2) + 1;
        let desiredCameraY = window.cursorWorldPos.y - Math.floor(viewportHeight / 2) + 1;

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

var input = {
    init: function() {
        window.cursorWorldPos = {x: player.x, y: player.y};
        cursorVisible = true;
    },

    keyboard: function(event) {
        if (player.hp < 1 && allPlayers.length === 0) return;

        if (typeof WindowSystem !== 'undefined') {
            if (activeContextMenu || WindowSystem.isOpen()) {
                WindowSystem.handleKeyboard(event);
                return;
            }
        }

        // Allow keyboard control for any player-controlled entity's turn
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

        if ([37, 38, 39, 40].includes(event.keyCode)) { // ARROW KEYS
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

        if (event.keyCode === 13) { // ENTER
            event.preventDefault();
            if (keyboardMode && currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex])) {
                input.click();
            }
            return;
        }

        if (event.keyCode === 17) { // CTRL - act as right-click
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

        if (event.keyCode === 27) { // ESC
            if (isAiming) {
                isAiming = false;
                updateCamera();
                canvas.init();
                if (window.cursorWorldPos) {
                    window.cursorWorldPos.x = Math.max(camera.x, Math.min(camera.x + viewportWidth - 1, window.cursorWorldPos.x));
                    window.cursorWorldPos.y = Math.max(camera.y, Math.min(camera.y + viewportHeight - 1, window.cursorWorldPos.y));
                }
            }
            if (window.throwingGrenadeIndex !== undefined) {
                window.throwingGrenadeIndex = undefined;
                action.value = "move";
                console.log("Grenade throw cancelled");
                update();
            } else if (isPeekMode) {
                exitPeekMode();
            } else if (edit.checked) {
                edit.checked = false;
                document.getElementById('size-input-container').style.display = 'none';
            }
            return;
        }

        if (event.shiftKey && event.keyCode === 69) {
            edit.checked = !edit.checked;
            document.getElementById('size-input-container').style.display = edit.checked ? 'inline-block' : 'none';
            return;
        }

        if (event.keyCode === 82) { // R - Reload
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

        if (event.keyCode === 222) { // ' - Cycle targets
            event.preventDefault();
            if (currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex])) {
                keyboardMode = true;
                cursorVisible = true;
                const activeEnt = getActivePlayerEntity();

                if (action.value === "attack") {
                    const visibleEnemies = entities.filter(e =>
                        !isPlayerControlled(e) &&
                        e.hp > 0 &&
                        (e.seenX !== 0 || e.seenY !== 0) &&
                        EntitySystem.hasLOS(activeEnt, e.x, e.y, true) &&
                        e.x >= camera.x && e.x < camera.x + viewportWidth &&
                        e.y >= camera.y && e.y < camera.y + viewportHeight
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
                    if (visibleItems.length > 0) {
                        if (window.itemTargetIndex === undefined) window.itemTargetIndex = 0;
                        else window.itemTargetIndex = (window.itemTargetIndex + 1) % visibleItems.length;
                        const target = visibleItems[window.itemTargetIndex];
                        window.cursorWorldPos = {x: target.x, y: target.y};
                        update();
                    }
                }
            }
            return;
        }

        // COMMA KEY - Pickup item
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

        // PERIOD KEY - Wait/pass turn
        if (event.keyCode === 190) {
            if (isPeekMode) {
                exitPeekMode();
                return;
            } else if (currentEntityIndex >= 0 && isPlayerControlled(entities[currentEntityIndex]) && currentEntityTurnsRemaining > 0) {
                if (typeof WindowSystem !== 'undefined' && WindowSystem.isOpen()) return;
                const activeEnt = getActivePlayerEntity();
                currentEntityTurnsRemaining--;
                console.log(activeEnt.name + " waits...");
                if (currentEntityTurnsRemaining <= 0) {
                    currentEntityIndex++;
                    if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
                    currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
                    if (typeof processInventoryGrenades !== 'undefined') {
                        processInventoryGrenades(activeEnt);
                    }
                }
                update();
            }
            return;
        }

        // NUMBER KEYS - Use inventory item
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

        if (event.keyCode === 9) { // TAB
            event.preventDefault();
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

        if (event.keyCode === 80) { // P - Peek mode
            activatePeekMode();
        }
    },

    mouse: function(event) {
        if (player.hp < 1 && allPlayers.length === 0) return;

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

        if (edit.checked && isMouseDown) {
            const click_pos = {
                x: camera.x + gridX,
                y: camera.y + gridY
            };
            if (click_pos.x < 0 || click_pos.y < 0 || click_pos.x >= size || click_pos.y >= size) return;
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
        if (player.hp < 1 && allPlayers.length === 0) return;
        if (edit.checked) return;

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

        if (!window.cursorWorldPos) return;

        const click_pos = {
            x: window.cursorWorldPos.x,
            y: window.cursorWorldPos.y
        };

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
                        if (currentEntityTurnsRemaining <= 0) {
                            if (typeof processInventoryGrenades !== 'undefined') {
                                processInventoryGrenades(peekEntity);
                            }
                        }
                        update();
                    } else {
                        turns.move(activeEnt, click_pos.x, click_pos.y);
                        if (currentEntityTurnsRemaining <= 0) {
                            if (typeof processInventoryGrenades !== 'undefined') {
                                processInventoryGrenades(activeEnt);
                            }
                        }
                    }
                }
                break;

            case "attack":
                // Check if throwing grenade
                if (window.throwingGrenadeIndex !== undefined) {
                    if (throwItem(activeEnt, window.throwingGrenadeIndex, click_pos.x, click_pos.y)) {
                        window.throwingGrenadeIndex = undefined;

                        currentEntityTurnsRemaining--;
                        if (currentEntityTurnsRemaining <= 0) {
                            if (typeof processInventoryGrenades !== 'undefined') {
                                processInventoryGrenades(activeEnt);
                            }
                        }

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
                        if (currentEntityTurnsRemaining <= 0) {
                            if (typeof processInventoryGrenades !== 'undefined') {
                                processInventoryGrenades(peekEntity);
                            }
                        }
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
                        if (currentEntityTurnsRemaining <= 0) {
                            if (typeof processInventoryGrenades !== 'undefined') {
                                processInventoryGrenades(activeEnt);
                            }
                        }
                    }
                    update();
                }
                break;

            default:
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

        if (edit.checked) return;

        const clickedEntity = entities.find(e =>
            e.x === window.cursorWorldPos.x &&
            e.y === window.cursorWorldPos.y
        );

        const activeEnt = getActivePlayerEntity();
        const options = [];

        if (clickedEntity) {
            options.push({
                text: "(e) Examine",
                key: "e",
                action: function() {
                    WindowSystem.showExamineWindow(clickedEntity);
                }
            });

            // Show Follow option when right-clicking a different player-controlled entity
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
                	    }});
            		}
		}
        }

        if (options.length > 0) {
            const rect = c.getBoundingClientRect();
            const menuX = event.clientX - rect.left;
            const menuY = event.clientY - rect.top;

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

            if (edit.checked && window.cursorWorldPos) {
                const click_pos = {
                    x: window.cursorWorldPos.x,
                    y: window.cursorWorldPos.y
                };
                if (click_pos.x >= 0 && click_pos.y >= 0 && click_pos.x < size && click_pos.y < size) {
                    lastTile = {x: click_pos.x, y: click_pos.y};
                    const tileType = document.getElementById('tile-type').value;
                    const dup = walls.findIndex(el => el.x === click_pos.x && el.y === click_pos.y);
                    if (dup < 0) walls.push({x: click_pos.x, y: click_pos.y, type: tileType});
                    else walls.splice(dup, 1);
                    update();
                }
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