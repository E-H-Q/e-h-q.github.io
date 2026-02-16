// TURNS.JS: HANDLES TURN ORDER AND TURN ACTIONS

var currentEntityIndex = -1;
var currentEntityTurnsRemaining = 0;

var turns = {
    check: function() {
        if (player.hp < 1) {
            const music = new Audio('sound.wav');
            music.play();
            music.loop = false;
            music.playbackRate = 1.5;
            console.log("YOU DIED\n");
            return;
        }

        if (currentEntityTurnsRemaining <= 0) {
            const previousEntity = entities[currentEntityIndex];
            currentEntityIndex++;
            if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
            currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
            
            const currentEntity = entities[currentEntityIndex];
            
            if (previousEntity && typeof processInventoryGrenades !== 'undefined') {
                   processInventoryGrenades(previousEntity);
            }
            
            camera = {
                x: currentEntity.x - Math.round(viewportWidth / 2) + 1,
                y: currentEntity.y - Math.round(viewportHeight / 2) + 1
            };
            
            // Recenter cursor on player when turn cycles back
            if (currentEntity === player && keyboardMode && cursorVisible) {
                window.cursorWorldPos = {x: player.x, y: player.y};
            }
            
            canvas.init();
            canvas.clear();
            canvas.grid();
            canvas.items();
            canvas.walls();
            //canvas.drawGrenades();
            canvas.player();
            canvas.enemy();
        }

        const currentEntity = entities[currentEntityIndex];
        
        if (currentEntity.isGrenade && currentEntityTurnsRemaining > 0) {
            currentEntity.turnsRemaining--;
            console.log("Grenade countdown: " + currentEntity.turnsRemaining);
            
            if (currentEntity.turnsRemaining <= 0) {
                detonateGrenade(currentEntity);
            }
            
            currentEntityTurnsRemaining--;
            update();
            return;
        }
        
        if (currentEntity !== player && currentEntityTurnsRemaining > 0) {
            const dist = calc.distance(currentEntity.x, player.x, currentEntity.y, player.y);
            const effectiveRange = getEntityAttackRange(currentEntity);
            const canSeePlayer = EntitySystem.hasLOS(currentEntity, player.x, player.y, false);
            const willAttack = canSeePlayer && dist <= effectiveRange;
            
            if (!willAttack) {
                calc.move(currentEntity);
            } else {
                const targetingTiles = calculateEntityTargeting(currentEntity, player.x, player.y);
                canvas.los(targetingTiles);
            }
            
            const enemyHasSeenPlayer = (currentEntity.seenX !== 0 || currentEntity.seenY !== 0);
            const enemyInViewport = this.isInViewport(currentEntity);
            //const timeout = 250;
            
            if (enemyHasSeenPlayer && enemyInViewport) {
                setTimeout(() => {
                    this.enemyTurn(currentEntity, canSeePlayer, dist, effectiveRange);
                    update();
                }, timeout);
            } else {
                this.enemyTurn(currentEntity, canSeePlayer, dist, effectiveRange);
                update();
            }
            return;
        }

        if (currentEntity === player && action.value === "move") {
            calc.move(player);
            
            if (window.cursorWorldPos) {
                const endX = window.cursorWorldPos.x;
                const endY = window.cursorWorldPos.y;
                const isValid = valid.find(v => v.x === endX && v.y === endY);
                
                if (isValid && endX >= 0 && endX < size && endY >= 0 && endY < size) {
                    // Create grid with only valid tiles marked as walkable
                    const validGrid = createAndFillTwoDArray({rows: size, columns: size, defaultValue: 0});
                    valid.forEach(v => {
                        if (validGrid[v.x] && validGrid[v.x][v.y] !== undefined) {
                            validGrid[v.x][v.y] = 1;
                        }
                    });
                    validGrid[player.x][player.y] = 1;
                    
                    const graph = new Graph(validGrid, {diagonal: true});
                    const pathResult = astar.search(graph, graph.grid[player.x][player.y], graph.grid[endX][endY]);
                    if (pathResult && pathResult.length > 0) {
                        canvas.path(pathResult);
                    }
                }
            }
        }
        if (currentEntity === player && action.value === "attack") {	
            const targetingTiles = calculateEntityTargeting(player, window.cursorWorldPos.x, window.cursorWorldPos.y);
            if (targetingTiles.length > 0) canvas.los(targetingTiles);
        }
        if (currentEntity === player) this.checkEnemyLOS();
    },
    
    isInViewport: function(entity) {
        return entity.x >= camera.x && entity.x <= camera.x + viewportWidth - 1 && 
               entity.y >= camera.y && entity.y <= camera.y + viewportHeight - 1;
    },
    
    playerCanSeeEnemy: function(enemy) {
        return EntitySystem.hasLOS(player, enemy.x, enemy.y, true);
    },
    
    checkEnemyLOS: function() {
        allEnemies.forEach(enemy => {
            if (enemy.hp < 1) return;
            
            if (EntitySystem.hasLOS(enemy, player.x, player.y, false)) {
                enemy.seenX = player.x;
                enemy.seenY = player.y;
            }
        });
    },
    
    findWeaponWithAmmo: function(entity) {
        if (!entity.inventory) return -1;
        
        for (let i = 0; i < entity.inventory.length; i++) {
            const item = entity.inventory[i];
            const itemDef = itemTypes[item.itemType];
            
            if (itemDef && itemDef.type === "equipment" && itemDef.slot === "weapon") {
                if (itemDef.maxAmmo === undefined) {
                    // Weapons without ammo (like knife) are always ready
                    return i;
                }
                
                const currentAmmo = item.currentAmmo !== undefined ? item.currentAmmo : itemDef.maxAmmo;
                if (currentAmmo > 0) {
                    return i;
                }
            }
        }
        
        return -1;
    },
    
    findWeaponToReload: function(entity) {
        if (!entity.inventory) return -1;
        
        // Check equipped weapon first
        if (entity.equipment?.weapon) {
            const weapon = entity.equipment.weapon;
            const weaponDef = itemTypes[weapon.itemType];
            
            if (weaponDef.maxAmmo !== undefined) {
                const currentAmmo = weapon.currentAmmo !== undefined ? weapon.currentAmmo : weaponDef.maxAmmo;
                if (currentAmmo < weaponDef.maxAmmo) {
                    return -2; // Special code for equipped weapon
                }
            }
        }
        
        // Check inventory for weapons that need reloading
        for (let i = 0; i < entity.inventory.length; i++) {
            const item = entity.inventory[i];
            const itemDef = itemTypes[item.itemType];
            
            if (itemDef && itemDef.type === "equipment" && itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) {
                const currentAmmo = item.currentAmmo !== undefined ? item.currentAmmo : itemDef.maxAmmo;
                if (currentAmmo < itemDef.maxAmmo) {
                    return i;
                }
            }
        }
        
        return -1;
    },
    
    enemyTurn: function(entity, canSeePlayer, dist, effectiveRange) {
        if (entity.hp < 1) {
            currentEntityTurnsRemaining = 0;
            return;
        }

        if (canSeePlayer === undefined) {
            dist = calc.distance(entity.x, player.x, entity.y, player.y);
            canSeePlayer = EntitySystem.hasLOS(entity, player.x, player.y, false);
            effectiveRange = getEntityAttackRange(entity);
        }
        
        // Defensive trait: seek cover from last attacker after taking damage
        if (helper.hasTrait(entity, 'defensive') && entity.lastAttacker && entity.hp < entity.maxHp) {
            const attackerPos = entity.lastAttacker;
            const cover = helper.findNearestCover(entity, attackerPos.x, attackerPos.y);
            
            if (cover) {
                //console.log(entity.name + " seeks cover from " + attackerPos.name + "!");
                this.enemyMoveToward(entity, cover.x, cover.y);
                
                // Clear attacker once in cover
                if (entity.x === cover.x && entity.y === cover.y) {
                    entity.lastAttacker = null;
		    		currentEntityTurnsRemaining--;
	            	console.log(entity.name + " hides...");
                }
                return;
            }
        }
        
        if (canSeePlayer) {
            entity.seenX = player.x;
            entity.seenY = player.y;
            
            // Clear hunting state when player is spotted
            if (entity.huntingTurns !== undefined) {
                entity.huntingTurns = 0;
            }
            
            if (dist <= effectiveRange) {
                if (!hasAmmo(entity)) {
                    // Aggressive trait: switch to another weapon with ammo instead of reloading
                    if (helper.hasTrait(entity, 'aggressive')) {
                        const weaponIndex = this.findWeaponWithAmmo(entity);
                        if (weaponIndex >= 0) {
                            if (typeof equipItem !== 'undefined') {
                                equipItem(entity, weaponIndex);
                                currentEntityTurnsRemaining--;
                                console.log(entity.name + " switched weapons!");
                                return;
                            }
                        }
                    }
                    
                    // Fallback to reloading
                    if (reloadWeapon(entity)) {
                        currentEntityTurnsRemaining--;
                    }
                    return;
                }
                
                if (EntitySystem.attack(entity, player.x, player.y)) {
                    currentEntityTurnsRemaining--;
                }
            } else {
                this.enemyMoveToward(entity, player.x, player.y);
            }
        } else {
            // Player not visible - check if any weapon needs reloading
            const weaponToReload = this.findWeaponToReload(entity);
            
            if (weaponToReload === -2) {
                // Equipped weapon needs reloading
                if (reloadWeapon(entity)) {
                    currentEntityTurnsRemaining--;
                    return;
                }
            } else if (weaponToReload >= 0) {
                // Inventory weapon needs reloading - equip it first, then reload
                const item = entity.inventory[weaponToReload];
                const itemDef = itemTypes[item.itemType];
                
                if (typeof equipItem !== 'undefined') {
                    equipItem(entity, weaponToReload);
                    currentEntityTurnsRemaining--;
                    return;
                }
            }
            
            if (entity.seenX !== 0 || entity.seenY !== 0) {
                if (entity.x === entity.seenX && entity.y === entity.seenY) {
                    // Aggressive trait: find where player might be hiding
                    if (helper.hasTrait(entity, 'aggressive')) {
                        if (entity.huntingTurns === undefined) entity.huntingTurns = 0;
                        
                        if (entity.huntingTurns < entity.turns) {
                            // Find tiles that break LOS from current position (potential hiding spots)
                            const searchRadius = entity.attack_range;
                            const hidingSpots = [];
                            
                            for (let x = Math.max(0, entity.x - searchRadius); x <= Math.min(size - 1, entity.x + searchRadius); x++) {
                                for (let y = Math.max(0, entity.y - searchRadius); y <= Math.min(size - 1, entity.y + searchRadius); y++) {
                                    if (helper.tileBlocked(x, y)) continue;
                                    if (x === entity.x && y === entity.y) continue;
                                    
                                    // Check if this position breaks LOS from entity's current position
                                    const blocksLOS = !EntitySystem.hasLOS({x: entity.x, y: entity.y}, x, y, false);
                                    
                                    if (blocksLOS) {
                                        hidingSpots.push({
                                            x, y,
                                            distance: calc.distance(entity.x, x, entity.y, y)
                                        });
                                    }
                                }
                            }
                            
                            if (hidingSpots.length > 0) {
                                // Sort by distance and pick one of the closer spots to check
                                hidingSpots.sort((a, b) => a.distance - b.distance);
                                const target = hidingSpots[Math.floor(Math.random() * Math.min(3, hidingSpots.length))];
                                
                                this.enemyMoveToward(entity, target.x, target.y);
                                entity.huntingTurns++;
                                return;
                            }
                        }
                    }
                    
                    entity.seenX = 0;
                    entity.seenY = 0;
                    entity.huntingTurns = 0;
                    this.enemyRandomMove(entity);
                } else {
                    this.enemyMoveToward(entity, entity.seenX, entity.seenY);
                }
            } else {
                // No last known position - random movement
                this.enemyRandomMove(entity);
            }
        }
    },
    
    enemyRandomMove: function(entity) {
        const moves = [[-1,-1],[0,-1],[1,-1],[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1]];
        
        for (let i = moves.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [moves[i], moves[j]] = [moves[j], moves[i]];
        }
        
        for (let [dx, dy] of moves) {
            const newX = entity.x + dx;
            const newY = entity.y + dy;
            
            if (newX < 0 || newY < 0 || newX >= size || newY >= size) continue;
            
            const isWall = walls.some(w => w.x === newX && w.y === newY);
            const isOccupied = entities.some(e => e !== entity && e.hp > 0 && e.x === newX && e.y === newY);
            
            if (!isWall && !isOccupied) {
                entity.x = newX;
                entity.y = newY;
                break;
            }
        }
        
        currentEntityTurnsRemaining--;
    },
    
    enemyMove: function(entity) {
        this.enemyRandomMove(entity);
    },
    
    enemyMoveToward: function(entity, targetX, targetY) {
        if (!pts) {
            currentEntityTurnsRemaining--;
            return;
        }
        
        if (targetX < 0 || targetX >= size || targetY < 0 || targetY >= size) {
            entity.seenX = 0;
            entity.seenY = 0;
            currentEntityTurnsRemaining--;
            return;
        }
        
        const diagonalGraph = new Graph(pts, { diagonal: true });
        
        entities.forEach(e => {
            if (e !== entity && e.hp > 0 && !(e.x === targetX && e.y === targetY)) {
                if (diagonalGraph.grid[e.x]?.[e.y]) {
                    diagonalGraph.grid[e.x][e.y].weight = 0;
                }
            }
        });
        
        if (!diagonalGraph.grid[entity.x]?.[entity.y] || !diagonalGraph.grid[targetX]?.[targetY]) {
            entity.seenX = 0;
            entity.seenY = 0;
            currentEntityTurnsRemaining--;
            return;
        }
        
        const path = astar.search(
            diagonalGraph, 
            diagonalGraph.grid[entity.x][entity.y], 
            diagonalGraph.grid[targetX][targetY], 
            { closest: true, heuristic: astar.heuristics.diagonal }
        );
        
        if (!path || path.length === 0) {
            entity.seenX = 0;
            entity.seenY = 0;
            this.enemyRandomMove(entity);
            return;
        }
        
        let distanceMoved = 0;
        let finalX = entity.x;
        let finalY = entity.y;
        
        for (let step of path) {
            const isDiagonal = (step.x !== finalX && step.y !== finalY);
            const stepCost = isDiagonal ? 1 : 1;
            
            if (distanceMoved + stepCost <= entity.range) {
                const occupied = entities.some(e => 
                    e !== entity && e.hp > 0 && e.x === step.x && e.y === step.y
                );
                
                const isWall = walls.some(w => w.x === step.x && w.y === step.y);
                
                if (!occupied && !isWall) {
                    finalX = step.x;
                    finalY = step.y;
                    distanceMoved += stepCost;
                } else break;
            } else break;
        }
        
        if (finalX !== entity.x || finalY !== entity.y) {
            entity.x = finalX;
            entity.y = finalY;
        }
        
        currentEntityTurnsRemaining--;
    },
    
    move: function(entity, x, y) {
        if (EntitySystem.moveEntity(entity, x, y)) {
            currentEntityTurnsRemaining--;
            
            if (entity === player) {
                if (currentEntityTurnsRemaining <= 0) {
                    if (typeof processInventoryGrenades !== 'undefined') {
                        processInventoryGrenades(player);
                    }
                }
            }
            
            if (entity === player && currentEntityTurnsRemaining <= 0) {
                currentEntityIndex++;
                if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
                currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
            }
            
            if (entity === player) this.checkEnemyLOS();
            update();
            
            if (entity === player && window.cursorWorldPos && cursorVisible) {
                window.savedCursorScreenX = window.cursorWorldPos.x - camera.x;
                window.savedCursorScreenY = window.cursorWorldPos.y - camera.y;
            }
        }

        if (currentEntityIndex < 0 || entities[currentEntityIndex] !== player) return;
        
        if (!keyboardMode && mouse_pos.clientX && mouse_pos.clientY) {
            const evt = new MouseEvent('mousemove', {
                clientX: mouse_pos.clientX,
                clientY: mouse_pos.clientY
            });
            input.mouse(evt);
        }
    },
    
    attack: function(target, entity) {
        EntitySystem.attack(entity, target);
        
        currentEntityTurnsRemaining--;
        
        if (entity === player) {
            if (currentEntityTurnsRemaining <= 0) {
                if (typeof processInventoryGrenades !== 'undefined') {
                    processInventoryGrenades(player);
                }
            }
        }
        
        if (entity === player && currentEntityTurnsRemaining <= 0) {
            currentEntityIndex++;
            if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
            currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
        }
    }
};
