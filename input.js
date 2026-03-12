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
        // Dead zone: only update camera if cursor moved significantly since last update
        const deadZone = 2; // tiles
        
        if (lastCameraUpdateCursorX !== null && lastCameraUpdateCursorY !== null) {
            const cursorMovedX = Math.abs(window.cursorWorldPos.x - lastCameraUpdateCursorX);
            const cursorMovedY = Math.abs(window.cursorWorldPos.y - lastCameraUpdateCursorY);
            
            // If cursor hasn't moved enough, don't update camera
            if (cursorMovedX < deadZone && cursorMovedY < deadZone) {
                return;
            }
        }
        
        // Update tracking position
        lastCameraUpdateCursorX = window.cursorWorldPos.x;
        lastCameraUpdateCursorY = window.cursorWorldPos.y;
        
        // Camera follows cursor when aiming
        const dx = window.cursorWorldPos.x - player.x;
        const dy = window.cursorWorldPos.y - player.y;
        const euclideanDist = Math.sqrt(dx * dx + dy * dy);
        
        // Apply dampening for close-range aiming (within 5 tiles)
        const dampening = euclideanDist < 3 ? 0.2 + (euclideanDist / 3) * 0.8 : 1.0;
        const maxPanDistance = Math.ceil(euclideanDist / 3) * dampening;
        
        // Calculate player-centered camera position
        const playerCameraX = player.x - Math.round(viewportWidth / 2) + 1;
        const playerCameraY = player.y - Math.round(viewportHeight / 2) + 1;
        
        // Calculate desired camera position (cursor-centered)
        let desiredCameraX = window.cursorWorldPos.x - Math.round(viewportWidth / 2) + 1;
        let desiredCameraY = window.cursorWorldPos.y - Math.round(viewportHeight / 2) + 1;
        
        // Clamp camera to max pan distance from player-centered position using radial clamping
        const deltaX = desiredCameraX - playerCameraX;
        const deltaY = desiredCameraY - playerCameraY;
        const deltaDist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (deltaDist > maxPanDistance) {
            const ratio = maxPanDistance / deltaDist;
            desiredCameraX = playerCameraX + deltaX * ratio;
            desiredCameraY = playerCameraY + deltaY * ratio;
        }
        
        // Round to integers to maintain grid alignment and set camera
        camera = aimCamera = {
            x: Math.round(desiredCameraX),
            y: Math.round(desiredCameraY)
        };
    } else {
        // Normal camera: follows current entity
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
        if (player.hp < 1) return;
        
        // Check if context menu OR window is open - let them handle ALL input first
        if (typeof WindowSystem !== 'undefined') {
            if (activeContextMenu || WindowSystem.isOpen()) {
                WindowSystem.handleKeyboard(event);
                return;
            }
        }
        
        if (currentEntityIndex < 0 || entities[currentEntityIndex] !== player) return;
        
        // SPACE KEY - Toggle aim mode
        if (event.keyCode === 32) {
            event.preventDefault();
            if (event.type === 'keydown' && !isAiming) {
                // Start aiming
                isAiming = true;
                updateCamera();
                canvas.init();
                update();
            } else if (event.type === 'keyup' && isAiming) {
                // Stop aiming
                isAiming = false;
    			if (window.cursorWorldPos && cursorVisible) { // cursor positioning continuity
        			window.savedCursorScreenX = window.cursorWorldPos.x - camera.x;
        			window.savedCursorScreenY = window.cursorWorldPos.y - camera.y;
    			}
                updateCamera();
                canvas.init();
                update();
            }
            return;
        }
        
        // Z KEY - Toggle zoom in/out
        if (event.keyCode === 90) { // Z key
            if (event.type === 'keydown') {
                if (!isZoomedOut) {
                    handleZoom(true);
                } else {
                    handleZoom(false);
                }
            }
            return;
        }
        
        // C KEY - Center cursor on player
        if (event.keyCode === 67 && !isAiming) { // C key
            if (event.type === 'keydown') {
                keyboardMode = true;
                cursorVisible = true;
                window.cursorWorldPos = {x: player.x, y: player.y};
                update();
            }
            return;
        }
        
        if (event.type !== 'keydown' && event.keyCode !== 32) return;
        
        if ([37, 38, 39, 40].includes(event.keyCode)) { // ARROW KEYS
            event.preventDefault();
            
            if (!keyboardMode) window.cursorWorldPos = {x: player.x, y: player.y};
            
            keyboardMode = true;
            cursorVisible = true;
            
            // Move 3 tiles if shift is held, otherwise 1 tile
            const moveDistance = event.shiftKey ? 3 : 1;
            
            switch(event.keyCode) {
                case 37: window.cursorWorldPos.x -= moveDistance; break;
                case 38: window.cursorWorldPos.y -= moveDistance; break;
                case 39: window.cursorWorldPos.x += moveDistance; break;
                case 40: window.cursorWorldPos.y += moveDistance; break;
            }
            
            // Clamp to map bounds
            window.cursorWorldPos.x = Math.max(0, Math.min(size - 1, window.cursorWorldPos.x));
            window.cursorWorldPos.y = Math.max(0, Math.min(size - 1, window.cursorWorldPos.y));
            
            // Also clamp to viewport bounds
            window.cursorWorldPos.x = Math.max(camera.x, Math.min(camera.x + viewportWidth - 1, window.cursorWorldPos.x));
            window.cursorWorldPos.y = Math.max(camera.y, Math.min(camera.y + viewportHeight - 1, window.cursorWorldPos.y));
            
            // Update camera if aiming
            if (isAiming) {
                updateCamera();
                canvas.init();
            }
            
            update();
            return;
        }
        
        if (event.keyCode === 13) { // ENTER
            event.preventDefault();
            if (keyboardMode && currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
                input.click();
            }
            return;
        }
        
        if (event.keyCode === 27) {
            // Reset aiming mode when closing menus/windows
            if (isAiming) {
                isAiming = false;
                updateCamera();
                canvas.init();
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
            if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
                if (reloadWeapon(player)) {
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
        
        if (event.keyCode === 222) {
            event.preventDefault();
            if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
                keyboardMode = true;
                cursorVisible = true;
                
                if (action.value === "attack") {
                    const visibleEnemies = entities.filter(e => 
                        e !== player && 
                        e.hp > 0 && 
                        (e.seenX !== 0 || e.seenY !== 0) &&
                        EntitySystem.hasLOS(player, e.x, e.y, true) &&
                        e.x >= camera.x && e.x < camera.x + viewportWidth &&
                        e.y >= camera.y && e.y < camera.y + viewportHeight
                    );
                    
                    if (visibleEnemies.length > 0) {
                        if (window.targetIndex === undefined) {
                            window.targetIndex = 0;
                        } else {
                            window.targetIndex = (window.targetIndex + 1) % visibleEnemies.length;
                        }
                        
                        const target = visibleEnemies[window.targetIndex];
                        window.cursorWorldPos = {x: target.x, y: target.y};
                        update();
                    }
                } else if (action.value === "move") {
                    const visibleItems = mapItems.filter(item => {
                        return hasPermissiveLOS(player.x, player.y, item.x, item.y) &&
                               item.x >= camera.x && item.x < camera.x + viewportWidth &&
                               item.y >= camera.y && item.y < camera.y + viewportHeight;
                    });
                    
                    if (visibleItems.length > 0) {
                        if (window.itemTargetIndex === undefined) {
                            window.itemTargetIndex = 0;
                        } else {
                            window.itemTargetIndex = (window.itemTargetIndex + 1) % visibleItems.length;
                        }
                        
                        const target = visibleItems[window.itemTargetIndex];
                        window.cursorWorldPos = {x: target.x, y: target.y};
                        update();
                    }
                }
            }
            return;
        }
        
        if (event.keyCode === 190) {
            if (isPeekMode) {
                exitPeekMode();
                return;
            } else if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player && currentEntityTurnsRemaining > 0) {
                if (typeof pickupItem !== 'undefined') {
                    pickupItem(entities[currentEntityIndex], entities[currentEntityIndex].x, entities[currentEntityIndex].y);
                }
                
                // Don't decrease turns or call update if window is open
                if (typeof WindowSystem !== 'undefined' && WindowSystem.isOpen()) {
                    return;
                }
                
                currentEntityTurnsRemaining--;
                console.log(player.name + " waits...");
                
                if (currentEntityTurnsRemaining <= 0) {
                    currentEntityIndex++;
                    if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
                    currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
                    
                    // Process inventory grenades when passing turn
                    if (typeof processInventoryGrenades !== 'undefined') {
                        processInventoryGrenades(player);
                    }
                }
                update();
            }
            return;
        }
        
        if (event.keyCode >= 48 && event.keyCode <= 57) {
            // Don't use inventory items if window is open
            if (typeof WindowSystem !== 'undefined' && WindowSystem.isOpen()) {
                return;
            }
            
            if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
                let slotIndex = event.keyCode - 49;
                if (event.keyCode === 48) slotIndex = 9;
                
                if (slotIndex >= 0 && slotIndex < player.inventory.length) {
                    if (typeof useItem !== 'undefined') {
                        useItem(player, slotIndex)
                    }
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
            activatePeekMode()
        }

        if (event.keyCode === 32) { // SPACE BAR
			event.preventDefault();
			console.log(state);
            if (event.type === 'keydown' && !isAiming) {
                // Start aiming
                isAiming = true;
                updateCamera();
                canvas.init();
                update();
            } else if (event.type === 'keyup' && isAiming) {
                // Stop aiming
                isAiming = false;
    			if (window.cursorWorldPos && cursorVisible) { // cursor positioning continuity
        			window.savedCursorScreenX = window.cursorWorldPos.x - camera.x;
        			window.savedCursorScreenY = window.cursorWorldPos.y - camera.y;
    			}
                updateCamera();
                canvas.init();
                update();
            }
            return;
			/*
            event.preventDefault();
			document.activeElement.value += " ";

            window.cursorWorldPos = {
                x: player.x,
                y: player.y
            };
        cursorVisible = true;
        update();
        return;
		*/
        }
    },
    
    mouse: function(event) {
        if (player.hp < 1) return;
        
        const rect = c.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        
        // Always store mouse position
        mouse_pos = {
            canvasX: canvasX,
            canvasY: canvasY,
            clientX: event.clientX,
            clientY: event.clientY
        };
        
        // Let window system handle mouse if open or context menu active
        if (typeof WindowSystem !== 'undefined' && (activeContextMenu || WindowSystem.isOpen())) {
            WindowSystem.handleMouseMove(canvasX, canvasY);
            return;
        }
        
        if (keyboardMode) {
            keyboardMode = false;
        }

        const gridX = Math.floor(canvasX / tileSize);
        const gridY = Math.floor(canvasY / tileSize);
        
        // Store old camera position
        const oldCameraX = camera.x;
        const oldCameraY = camera.y;
        
        // Calculate cursor world position and clamp to both viewport and map bounds
        let worldX = camera.x + gridX;
        let worldY = camera.y + gridY;
        
        // Clamp to viewport (0 to viewportWidth-1, 0 to viewportHeight-1 in grid coords)
        const clampedGridX = Math.max(0, Math.min(viewportWidth - 1, gridX));
        const clampedGridY = Math.max(0, Math.min(viewportHeight - 1, gridY));
        
        worldX = camera.x + clampedGridX;
        worldY = camera.y + clampedGridY;
        
        // Also clamp to map bounds
        window.cursorWorldPos = {
            x: Math.max(0, Math.min(size - 1, worldX)),
            y: Math.max(0, Math.min(size - 1, worldY))
        };
        cursorVisible = true;

        // Update camera if aiming
        if (isAiming) {
            updateCamera();
            canvas.init();
            
            // Recalculate cursor world position if camera moved (keeps cursor at same screen position)
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
                
                if (dup < 0) {
                    walls.push({x: click_pos.x, y: click_pos.y, type: tileType});
                } else {
                    walls.splice(dup, 1);
                }
                
                update();
            }
            return;
        }

        update();
    },
    
    click: function() {
        if (player.hp < 1) return;
        if (edit.checked) return;
        
        // Check if context menu is open - let it handle clicks FIRST
        if (typeof WindowSystem !== 'undefined' && activeContextMenu) {
            const canvasX = mouse_pos.canvasX || 0;
            const canvasY = mouse_pos.canvasY || 0;
            WindowSystem.handleClick(canvasX, canvasY);
            return;
        }
        
        // Check if window is open - let it handle clicks
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

        switch (action.value) {
            case "move":
                const validClick = valid.find(v => v.x === click_pos.x && v.y === click_pos.y);
                if (validClick) {
                    if (isPeekMode && peekStep === 1) {
                        player.x = click_pos.x;
                        player.y = click_pos.y;
                        player.range = savedPlayerRange;
                        
                        peekStep = 2;
                        action.value = "attack";
                        action.disabled = true;
                        currentEntityTurnsRemaining--;
                        if (currentEntityTurnsRemaining <= 0) {
                            if (typeof processInventoryGrenades !== 'undefined') {
                                processInventoryGrenades(player);
                            }
                        }
                        update();
                    } else {
                        turns.move(player, click_pos.x, click_pos.y);
                        if (currentEntityTurnsRemaining <= 0) {
                            if (typeof processInventoryGrenades !== 'undefined') {
                                processInventoryGrenades(player);
                            }
                        }
                    }
                }
                break;
                
            case "attack":
                // Check if throwing grenade
                if (window.throwingGrenadeIndex !== undefined) {
                    if (throwItem(player, window.throwingGrenadeIndex, click_pos.x, click_pos.y)) {
                        window.throwingGrenadeIndex = undefined;
                        
                        const wasKeyboardMode = keyboardMode;
                        let screenOffsetX, screenOffsetY;
                        
                        if (wasKeyboardMode && window.cursorWorldPos) {
                            screenOffsetX = window.cursorWorldPos.x - camera.x;
                            screenOffsetY = window.cursorWorldPos.y - camera.y;
                        }
                        
                        currentEntityTurnsRemaining--;
                        if (currentEntityTurnsRemaining <= 0) {
                            if (typeof processInventoryGrenades !== 'undefined') {
                                processInventoryGrenades(player);
                            }
                        }
                        
                        if (isPeekMode) {
                            if (peekStep === 2) {
                                player.x = peekStartX;
                                player.y = peekStartY;
                            }
                            isPeekMode = false;
                            peekStep = 1;
                            action.disabled = false;
                            console.log("Exited peek mode.");
                        }
                        
                        action.value = "move";
                        update();    
                    }
                    return;
                }
                
                if (!hasAmmo(player)) {
                    console.log("Out of ammo! Press R to reload.");
                    return;
                }
                
                const effectiveRange = getEntityAttackRange(player);
                const dist = calc.distance(player.x, click_pos.x, player.y, click_pos.y);
                
                const hasLOS = hasPermissiveLOS(player.x, player.y, click_pos.x, click_pos.y);
                
                if (dist > effectiveRange || !hasLOS) return;
                
                const targetingTiles = calculateEntityTargeting(player, click_pos.x, click_pos.y);
                const accessoryDef = player.equipment?.accessory ? itemTypes[player.equipment.accessory.itemType] : null;
                const weaponDef = player.equipment?.weapon ? itemTypes[player.equipment.weapon.itemType] : null;
                const canDestroy = weaponDef?.canDestroy || accessoryDef?.grantsDestroy;
                
                const targetsInArea = getTargetedEntities(player, click_pos.x, click_pos.y);
                const enemies = targetsInArea.filter(e => e !== player && e.hp > 0);
                const hasWalls = canDestroy && targetingTiles.some(t => {
                    const w = walls.find(w => w.x === t.x && w.y === t.y);
                    return w && w.type !== 'glass';
                });
                const hasGlass = targetingTiles.some(t => walls.find(w => w.x === t.x && w.y === t.y && w.type === 'glass'));
                const hasTargets = targetingTiles.length > 0 && (enemies.length > 0 || hasWalls || hasGlass);
                
                if (!hasTargets) return;

                const wasKeyboardMode = keyboardMode;
                let screenOffsetX, screenOffsetY;
                
                if (wasKeyboardMode && window.cursorWorldPos) {
                    screenOffsetX = window.cursorWorldPos.x - camera.x;
                    screenOffsetY = window.cursorWorldPos.y - camera.y;
                }

                if (isPeekMode && peekStep === 2) {
                    if (EntitySystem.attack(player, click_pos.x, click_pos.y)) {
                        currentEntityTurnsRemaining--;
                        if (currentEntityTurnsRemaining <= 0) {
                            if (typeof processInventoryGrenades !== 'undefined') {
                                processInventoryGrenades(player);
                            }
                        }
                    }
                    player.x = peekStartX;
                    player.y = peekStartY;
                    
                    isPeekMode = false;
                    peekStep = 1;
                    action.disabled = false;
                    action.value = "move";
                    console.log("Exited peek mode.");
                    
                    update();
                } else {
                    if (EntitySystem.attack(player, click_pos.x, click_pos.y)) {
                        currentEntityTurnsRemaining--;
                        if (currentEntityTurnsRemaining <= 0) {
                            if (typeof processInventoryGrenades !== 'undefined') {
                                processInventoryGrenades(player);
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
        
        // Always populate the coordinate fields (regardless of edit mode)
        document.getElementById('spawn_x').value = window.cursorWorldPos.x;
        document.getElementById('spawn_y').value = window.cursorWorldPos.y;
        document.getElementById('player_x').value = window.cursorWorldPos.x;
        document.getElementById('player_y').value = window.cursorWorldPos.y;
        document.getElementById('item_x').value = window.cursorWorldPos.x;
        document.getElementById('item_y').value = window.cursorWorldPos.y;
        
        // If in edit mode, stop here (old behavior)
        if (edit.checked) {
            return;
        }
        
        // Check if there's an entity at this position
        const clickedEntity = entities.find(e => 
            e.x === window.cursorWorldPos.x && 
            e.y === window.cursorWorldPos.y
        );
        
        if (clickedEntity) {
            const rect = c.getBoundingClientRect();
            const menuX = event.clientX - rect.left;
            const menuY = event.clientY - rect.top;
            
            const menu = WindowSystem.createContextMenu({
                x: menuX,
                y: menuY,
                tileX: window.cursorWorldPos.x,
                tileY: window.cursorWorldPos.y,
                options: [
                    {
                        text: "(e) Examine",
                        key: "e",
                        action: function() {
                            WindowSystem.showExamineWindow(clickedEntity);
                        }
                    }
                ]
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
                    
                    if (dup < 0) {
                        walls.push({x: click_pos.x, y: click_pos.y, type: tileType});
                    } else {
                        walls.splice(dup, 1);
                    }
                    
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
