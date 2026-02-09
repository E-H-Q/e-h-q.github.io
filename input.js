// INPUT.JS: HANDLES USER INPUT

var isZoomedOut = false;
var isMouseDown = false;
var lastTile = null;
var keyboardMode = false;
var cursorVisible = false;

var input = {
    init: function() {
        window.cursorWorldPos = null;
        cursorVisible = false;
    },
    
    handleZoom: function(zoomOut) {
        isZoomedOut = zoomOut;
        tileSize = zoomOut ? tileSize / 2 : tileSize * 2;
	viewportWidth  = zoomOut ? viewportWidth * 2 : viewportWidth / 2;
	viewportHeight = zoomOut ? viewportHeight * 2 : viewportHeight / 2;
        
        const currentEntity = entities[currentEntityIndex] || player;
        camera = {
            x: currentEntity.x - Math.round((viewportWidth / 2)) + 1,
            y: currentEntity.y - Math.round((viewportHeight / 2)) + 1
        };
        
        update();

        // Update saved cursor screen position after zoom
        if (window.cursorWorldPos && cursorVisible) {
            window.savedCursorScreenX = window.cursorWorldPos.x - camera.x;
            window.savedCursorScreenY = window.cursorWorldPos.y - camera.y;
        }	
    },
    
    keyboard: function(event) {
        if (player.hp < 1) return;
        if (event.type !== 'keydown' && event.keyCode !== 16) return;
        if (currentEntityIndex < 0 || entities[currentEntityIndex] !== player) return;
        
        if ([37, 38, 39, 40].includes(event.keyCode)) { // ARROW KEYS
            event.preventDefault();
            
            if (!keyboardMode) window.cursorWorldPos = {x: player.x, y: player.y};
            
            keyboardMode = true;
            cursorVisible = true;
            document.body.style.cursor = 'none';
            
            switch(event.keyCode) {
                case 37: window.cursorWorldPos.x--; break;
                case 38: window.cursorWorldPos.y--; break;
                case 39: window.cursorWorldPos.x++; break;
                case 40: window.cursorWorldPos.y++; break;
            }
            
            window.cursorWorldPos.x = Math.max(camera.x, Math.min(camera.x + viewportWidth - 1, window.cursorWorldPos.x));
            window.cursorWorldPos.y = Math.max(camera.y, Math.min(camera.y + viewportHeight - 1, window.cursorWorldPos.y));
            window.cursorWorldPos.x = Math.max(0, Math.min(size - 1, window.cursorWorldPos.x));
            window.cursorWorldPos.y = Math.max(0, Math.min(size - 1, window.cursorWorldPos.y));
            
            update();
            return;
        }
        
        if (event.keyCode === 13) { // ENTER
            event.preventDefault();
            if (keyboardMode && currentEntityIndex >= 0 && entities[currentEntityIndex] === player) {
                // Only execute click action, don't decrement turns here
                // The click handler will manage turn decrements
                input.click();
            }
            return;
        }
        
        if (event.keyCode === 27) {
            if (window.throwingGrenadeIndex !== undefined) {
                window.throwingGrenadeIndex = undefined;
                action.value = "move";
                console.log("Grenade throw cancelled");
                update();
            } else if (isPeekMode) {
                exitPeekMode();
            } else if (edit.checked) {
                edit.checked = false;
                if (isZoomedOut) input.handleZoom(false);
                document.getElementById('size-input-container').style.display = 'none';
            }
            return;
        }
        
        if (event.shiftKey && event.keyCode === 69) {
            edit.checked = !edit.checked;
            if (edit.checked && !isZoomedOut) input.handleZoom(true);
            document.getElementById('size-input-container').style.display = edit.checked ? 'inline-block' : 'none';
            return;
        }
        
        if (event.keyCode === 82) { // R - Reload
            //event.preventDefault();
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
                document.body.style.cursor = 'none';
                
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
        
        if (event.keyCode === 16) { // SHIFT
            if (event.type === 'keydown') {
                if (!isZoomedOut) {
                    input.handleZoom(true);
                } else if (isZoomedOut) {
                    input.handleZoom(false);
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
            //event.preventDefault();
            activatePeekMode()
        }

        if (event.keyCode === 32) { // SPACE BAR
            event.preventDefault();
            window.cursorWorldPos = {
                x: player.x,
                y: player.y
            };
        cursorVisible = true;
        update();
        return;
        }
    },
    
    mouse: function(event) {
        if (player.hp < 1) return;
        
        if (keyboardMode) {
            keyboardMode = false;
            document.body.style.cursor = '';
        }
        
        const rect = c.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        
        mouse_pos = {
            canvasX: canvasX,
            canvasY: canvasY,
            clientX: event.clientX,
            clientY: event.clientY
        };

        const gridX = Math.floor(canvasX / tileSize);
        const gridY = Math.floor(canvasY / tileSize);
        
        window.cursorWorldPos = {
            x: camera.x + gridX,
            y: camera.y + gridY
        };
        cursorVisible = true;

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

        if (action.value === "attack") {	
            const endX = camera.x + gridX;
            const endY = camera.y + gridY;
            
            update();
        } else {
            update();
        }
    },
    
    click: function() {
        if (player.hp < 1) return;
        if (edit.checked) return;
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
                            // Exit peek mode without calling update
                            isPeekMode = false;
                            peekStep = 1;
                            action.disabled = false;
                            console.log("Exited peek mode.");
                        }
                        
                        action.value = "move";
                        update();
                        
                        if (wasKeyboardMode && window.cursorWorldPos) {
                            window.cursorWorldPos.x = camera.x + screenOffsetX;
                            window.cursorWorldPos.y = camera.y + screenOffsetY;
                            window.cursorWorldPos.x = Math.max(0, Math.min(size - 1, window.cursorWorldPos.x));
                            window.cursorWorldPos.y = Math.max(0, Math.min(size - 1, window.cursorWorldPos.y));
                            
                            canvas.clear();
                            canvas.grid();
                            canvas.walls();
                            canvas.items();
                            canvas.drawOnionskin();
                            canvas.player();
                            canvas.enemy();
                            canvas.cursor();
                            canvas.drawGrenades();
                            
                            if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player && action.value === "move") {
                                calc.move(player);
                            }
                        }
                    }
                    return;
                }
                
                if (!hasAmmo(player)) {
                    console.log("Out of ammo! Press R to reload.");
                    return;
                }
                
                const effectiveRange = getEntityAttackRange(player);
                const dist = calc.distance(player.x, click_pos.x, player.y, click_pos.y);
                
                // Use permissive LOS that sees through glass
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
                    
                    // Exit peek mode without calling update
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
                
                if (wasKeyboardMode && window.cursorWorldPos) {
                    window.cursorWorldPos.x = camera.x + screenOffsetX;
                    window.cursorWorldPos.y = camera.y + screenOffsetY;
                    window.cursorWorldPos.x = Math.max(0, Math.min(size - 1, window.cursorWorldPos.x));
                    window.cursorWorldPos.y = Math.max(0, Math.min(size - 1, window.cursorWorldPos.y));
                    
                    canvas.clear();
                    canvas.grid();
                    canvas.walls();
                    canvas.items();
                    canvas.drawOnionskin();
                    canvas.player();
                    canvas.enemy();
                    canvas.drawGrenades();
                    
                    if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player && action.value === "move") {
                        calc.move(player);
                    }
                    
                    if (currentEntityIndex >= 0 && entities[currentEntityIndex] === player && action.value === "attack") {
                        const targetingTiles = calculateEntityTargeting(player, window.cursorWorldPos.x, window.cursorWorldPos.y);
                        if (targetingTiles.length > 0) canvas.los(targetingTiles);
                    }
                    
                    // Draw cursor AFTER movement/targeting overlays
                    canvas.cursor();
                }
                break;
                
            default:
                update();
        }
    },
    
    right_click: function(event) {
        event.preventDefault();
        
        if (!window.cursorWorldPos) return;
        
        console.log(window.cursorWorldPos);
        
        document.getElementById('spawn_x').value = window.cursorWorldPos.x;
        document.getElementById('spawn_y').value = window.cursorWorldPos.y;
        document.getElementById('player_x').value = window.cursorWorldPos.x;
        document.getElementById('player_y').value = window.cursorWorldPos.y;
        document.getElementById('item_x').value = window.cursorWorldPos.x;
        document.getElementById('item_y').value = window.cursorWorldPos.y;
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
