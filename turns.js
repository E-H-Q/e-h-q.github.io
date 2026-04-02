// TURNS.JS: HANDLES TURN ORDER AND TURN ACTIONS (OPTIMIZED)

var currentEntityIndex = -1;
var currentEntityTurnsRemaining = 0;
var isAnimating = false; // blocks check() re-entry during setTimeout turns

function startFollowing(follower, followed) {
    const inCombat = allEnemies.some(e => e.hp > 0 && !e.isGrenade && (e.seenX !== 0 || e.seenY !== 0));
    if (inCombat) {
        console.log("Cannot follow while in combat!");
        return;
    }
    // Prevent loops: walk the follow chain to make sure followed doesn't lead back to follower
    let cursor = followed;
    while (cursor) {
        if (cursor === follower) return;
        cursor = cursor.following;
    }
    follower.following = followed;
    console.log(follower.name + " is following " + followed.name + ".");
}


var turns = {
    check: function() {
        if (isAnimating) return;

        if (player.hp < 1 && allPlayers.length === 0) {
            const music = new Audio('sound.wav');
            music.play();
            music.loop = false;
            music.playbackRate = 1.5;
            console.log("YOU DIED\n");
            return;
        }

        if (currentEntityTurnsRemaining <= 0) {
            const previousEntity = entities[currentEntityIndex];

            const playerCamera = {
                x: player.x - Math.round(viewportWidth / 2) + 1,
                y: player.y - Math.round(viewportHeight / 2) + 1
            };

            // Skip to next entity; always process player-controlled entities and grenades
            do {
                currentEntityIndex++;
                if (currentEntityIndex >= entities.length) currentEntityIndex = 0;

                const currentEntity = entities[currentEntityIndex];

                if (isPlayerControlled(currentEntity) || currentEntity.isGrenade) break;

                const buffer = 5;
                const inActiveRange = (
                    currentEntity.x >= playerCamera.x - buffer &&
                    currentEntity.x <= playerCamera.x + viewportWidth + buffer &&
                    currentEntity.y >= playerCamera.y - buffer &&
                    currentEntity.y <= playerCamera.y + viewportHeight + buffer
                );
                if (inActiveRange) break;
            } while (currentEntityIndex !== 0);

            currentEntityTurnsRemaining = entities[currentEntityIndex].turns;

            const currentEntity = entities[currentEntityIndex];

            if (previousEntity && typeof processInventoryGrenades !== 'undefined') {
                processInventoryGrenades(previousEntity);
            }

            camera = {
                x: currentEntity.x - Math.round(viewportWidth / 2) + 1,
                y: currentEntity.y - Math.round(viewportHeight / 2) + 1
            };

            // Re-center cursor when any player-controlled entity's turn starts
            if (isPlayerControlled(currentEntity) && keyboardMode && cursorVisible) {
                window.cursorWorldPos = {x: currentEntity.x, y: currentEntity.y};
            }

            canvas.init();
            canvas.clear();
            canvas.grid();
            canvas.walls();
            canvas.items();
            canvas.player();
            canvas.enemy();
        }

        const currentEntity = entities[currentEntityIndex];

        if (currentEntity.isGrenade && currentEntityTurnsRemaining > 0) {
            currentEntity.turnsRemaining--;
            if (currentEntity.turnsRemaining <= 0) detonateGrenade(currentEntity);
            currentEntityTurnsRemaining--;
            update();
            return;
        }

        // Following entities - skip if adjacent to lead, otherwise move toward them.
        // Siblings are kept passable so pathfinding routes through them; the move loop
        // stops naturally when it reaches an occupied tile.
        if (currentEntity.following && currentEntity.following.hp > 0 && currentEntityTurnsRemaining > 0) {
            const followTarget = currentEntity.following;

            if (calc.distance(currentEntity.x, followTarget.x, currentEntity.y, followTarget.y) <= 1) {
                currentEntityTurnsRemaining--;
                update();
                return;
            }

            const siblings = entities.filter(e => e !== currentEntity && e.following === followTarget && e.hp > 0);
            const inCombat = currentEntity.seenX !== undefined && (currentEntity.seenX !== 0 || currentEntity.seenY !== 0);
            const inViewport = this.isInViewport(currentEntity);

            populate.reset();
            populate.walls();
            populate.enemies();
            // Re-enable siblings so A* routes through them; the move loop stops when occupied
            siblings.forEach(s => { if (pts[s.x]?.[s.y] !== undefined) pts[s.x][s.y] = 1; });

            if (inCombat && inViewport) isAnimating = true;
            this.enemyMoveToward(currentEntity, followTarget.x, followTarget.y, siblings);
            if (inCombat && inViewport) isAnimating = false;
            update();
            return;
        }

        if (!isPlayerControlled(currentEntity) && currentEntityTurnsRemaining > 0) {
            const target = this.pickTarget(currentEntity);
            const dist = calc.distance(currentEntity.x, target.x, currentEntity.y, target.y);
            const effectiveRange = getEntityAttackRange(currentEntity);
            const canSeeTarget = EntitySystem.hasLOS(currentEntity, target.x, target.y, false);
            const willAttack = canSeeTarget && dist <= effectiveRange;

            const enemyHasSeenPlayer = (currentEntity.seenX !== 0 || currentEntity.seenY !== 0);
            const enemyInViewport = this.isInViewport(currentEntity);

            if (!willAttack && enemyHasSeenPlayer && enemyInViewport) {
                calc.move(currentEntity);
                const previewPath = this.computeEnemyPath(currentEntity, currentEntity.seenX, currentEntity.seenY);
                if (previewPath.length > 0) canvas.path(previewPath, currentEntity.x, currentEntity.y, currentEntity);
            } else if (willAttack && enemyInViewport) {
                const targetingTiles = calculateEntityTargeting(currentEntity, target.x, target.y);
                canvas.los(targetingTiles);
                canvas.crosshair(target.x, target.y);
            }

            if (enemyHasSeenPlayer && enemyInViewport) {
                setTimeout(() => {
                    this.enemyTurn(currentEntity, target, canSeeTarget, dist, effectiveRange);
                    update();
                }, parseInt(document.getElementById('turn-delay').value) || 0);
            } else {
                this.enemyTurn(currentEntity, target, canSeeTarget, dist, effectiveRange);
                update();
            }
            return;
        }

        if (isPlayerControlled(currentEntity) && action.value === "move") {
            calc.move(currentEntity);

            if (window.cursorWorldPos) {
                const endX = window.cursorWorldPos.x;
                const endY = window.cursorWorldPos.y;
                const isValid = valid.find(v => v.x === endX && v.y === endY);

                if (isValid && endX >= 0 && endX < size && endY >= 0 && endY < size) {
                    const validGrid = createAndFillTwoDArray({rows: size, columns: size, defaultValue: 0});
                    valid.forEach(v => {
                        if (validGrid[v.x] && validGrid[v.x][v.y] !== undefined) validGrid[v.x][v.y] = 1;
                    });
                    validGrid[currentEntity.x][currentEntity.y] = 1;

                    const graph = new Graph(validGrid, {diagonal: true});
                    const pathResult = astar.search(graph, graph.grid[currentEntity.x][currentEntity.y], graph.grid[endX][endY]);
                    if (pathResult && pathResult.length > 0) canvas.path(pathResult, currentEntity.x, currentEntity.y, currentEntity);
                }
            }
        }

        if (isPlayerControlled(currentEntity) && action.value === "attack") {
            canvas.attackRangeDim(currentEntity);
            const targetingTiles = calculateEntityTargeting(currentEntity, window.cursorWorldPos.x, window.cursorWorldPos.y);
            if (targetingTiles.length > 0) canvas.los(targetingTiles);
        }

        if (isPlayerControlled(currentEntity)) this.checkEnemyLOS();
    },

    isInViewport: function(entity) {
        return entity.x >= camera.x && entity.x <= camera.x + viewportWidth - 1 &&
               entity.y >= camera.y && entity.y <= camera.y + viewportHeight - 1;
    },

    playerCanSeeEnemy: function(enemy) {
        return EntitySystem.hasLOS(player, enemy.x, enemy.y, true);
    },

    checkEnemyLOS: function() {
        const buffer = 5;
        // All living player-controlled entities
        const playerEntities = entities.filter(e => isPlayerControlled(e) && e.hp > 0);

        allEnemies.forEach(enemy => {
            if (enemy.hp < 1 || enemy.isGrenade) return;
            const inActiveRange = (
                enemy.x >= camera.x - buffer &&
                enemy.x <= camera.x + viewportWidth + buffer &&
                enemy.y >= camera.y - buffer &&
                enemy.y <= camera.y + viewportHeight + buffer
            );
            if (!inActiveRange) return;

            // Check LOS to any player-controlled entity; use the closest visible one
            let closestVisible = null;
            let closestDist = Infinity;
            for (let pe of playerEntities) {
                if (EntitySystem.hasLOS(enemy, pe.x, pe.y, false)) {
                    const d = calc.distance(enemy.x, pe.x, enemy.y, pe.y);
                    if (d < closestDist) { closestDist = d; closestVisible = pe; }
                }
            }

            if (closestVisible) {
                const wasUnaware = (enemy.seenX === 0 && enemy.seenY === 0);
                enemy.seenX = closestVisible.x;
                enemy.seenY = closestVisible.y;

                if (wasUnaware) {
                    // Stop ALL player-entity followings when combat starts
                    [player, ...allPlayers].forEach(p => {
                        if (p.following) {
                            console.log(p.name + " stopped following " + p.following.name + ".");
                            p.following = null;
                        }
                    });
                    if (enemy.following) {
                        console.log(enemy.name + " stopped following " + enemy.following.name + ".");
                        enemy.following = null;
                    }
                    allEnemies.forEach(e => {
                        if (e.following === enemy) {
                            console.log(e.name + " stopped following " + enemy.name + ".");
                            e.following = null;
                        }
                    });
                }
            } else {
                const screenX = (enemy.x - camera.x) * tileSize;
                const screenY = (enemy.y - camera.y) * tileSize;
                if (enemy.seenX === 0 && enemy.seenY === 0) {
                    ctx.fillStyle = "rgba(255, 255, 255, 1)";
                    ctx.font = 'bold 12px serif';
                    ctx.textAlign = 'center';
                    ctx.fillText("?", screenX + tileSize * 0.75, screenY + tileSize * 0.25);
                }
            }
        });
    },

    findWeaponWithAmmo: function(entity) {
        if (!entity.inventory) return -1;
        for (let i = 0; i < entity.inventory.length; i++) {
            const item = entity.inventory[i];
            const itemDef = itemTypes[item.itemType];
            if (itemDef && itemDef.type === "equipment" && itemDef.slot === "weapon") {
                if (itemDef.maxAmmo === undefined) return i;
                const currentAmmo = item.currentAmmo !== undefined ? item.currentAmmo : itemDef.maxAmmo;
                if (currentAmmo > 0) return i;
            }
        }
        return -1;
    },

    findWeaponToReload: function(entity) {
        if (!entity.inventory) return -1;
        if (entity.equipment?.weapon) {
            const weapon = entity.equipment.weapon;
            const weaponDef = itemTypes[weapon.itemType];
            if (weaponDef.maxAmmo !== undefined) {
                const currentAmmo = weapon.currentAmmo !== undefined ? weapon.currentAmmo : weaponDef.maxAmmo;
                if (currentAmmo < weaponDef.maxAmmo) return -2;
            }
        }
        for (let i = 0; i < entity.inventory.length; i++) {
            const item = entity.inventory[i];
            const itemDef = itemTypes[item.itemType];
            if (itemDef && itemDef.type === "equipment" && itemDef.slot === "weapon" && itemDef.maxAmmo !== undefined) {
                const currentAmmo = item.currentAmmo !== undefined ? item.currentAmmo : itemDef.maxAmmo;
                if (currentAmmo < itemDef.maxAmmo) return i;
            }
        }
        return -1;
    },

    // Returns the best player-controlled target for this enemy based on its trait.
    // - aggressive: prefer whoever last attacked this enemy (if still alive), else closest
    // - defensive:  closest (it prioritises cover over target selection)
    // - default:    closest living player-controlled entity
    pickTarget: function(entity) {
        const playerEntities = entities.filter(e => isPlayerControlled(e) && e.hp > 0);
        if (playerEntities.length === 0) return player;

        const closest = playerEntities.reduce((best, e) =>
            calc.distance(entity.x, e.x, entity.y, e.y) < calc.distance(entity.x, best.x, entity.y, best.y) ? e : best
        );

        // Aggressive: pursue whoever last attacked this enemy if still alive
        if (helper.hasTrait(entity, 'aggressive') && entity.lastAttacker && isPlayerControlled(entity.lastAttacker)) {
            const attacker = playerEntities.find(e => e === entity.lastAttacker);
            if (attacker) return attacker;
        }

        // Default and defensive both go for closest
        return closest;
    },

    enemyTurn: function(entity, target, canSeeTarget, dist, effectiveRange) {
        if (entity.hp < 1) { currentEntityTurnsRemaining = 0; return; }

        // Allow callers that don't pass target (e.g. recursive/internal calls)
        if (target === undefined || typeof target !== 'object' || target === null || typeof target.x !== 'number') {
            target = this.pickTarget(entity);
            dist = calc.distance(entity.x, target.x, entity.y, target.y);
            canSeeTarget = EntitySystem.hasLOS(entity, target.x, target.y, false);
            effectiveRange = getEntityAttackRange(entity);
        }

        // Defensive: seek cover from whoever last attacked, regardless of current target
        if (helper.hasTrait(entity, 'defensive') && entity.lastAttacker && entity.hp < entity.maxHp) {
            const attackerPos = entity.lastAttacker;
            const cover = helper.findNearestCover(entity, attackerPos.x, attackerPos.y);
            if (cover) {
                this.enemyMoveToward(entity, cover.x, cover.y);
                if (entity.x === cover.x && entity.y === cover.y) {
                    entity.lastAttacker = null;
                    currentEntityTurnsRemaining--;
                    console.log(entity.name + " hides...");
                }
                return;
            }
        }

        if (canSeeTarget) {
            entity.seenX = target.x;
            entity.seenY = target.y;
            if (entity.huntingTurns !== undefined) entity.huntingTurns = 0;

            if (dist <= effectiveRange) {
                if (!hasAmmo(entity)) {
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
                    if (reloadWeapon(entity)) currentEntityTurnsRemaining--;
                    return;
                }
                if (EntitySystem.attack(entity, target.x, target.y)) currentEntityTurnsRemaining--;
            } else {
                this.enemyMoveToward(entity, target.x, target.y);
            }
        } else {
            const weaponToReload = this.findWeaponToReload(entity);
            if (weaponToReload === -2) {
                if (reloadWeapon(entity)) { currentEntityTurnsRemaining--; return; }
            } else if (weaponToReload >= 0) {
                if (typeof equipItem !== 'undefined') {
                    equipItem(entity, weaponToReload);
                    currentEntityTurnsRemaining--;
                    return;
                }
            }

            if (entity.seenX !== 0 || entity.seenY !== 0) {
                if (entity.x === entity.seenX && entity.y === entity.seenY) {
                    if (helper.hasTrait(entity, 'aggressive')) {
                        if (entity.huntingTurns === undefined) entity.huntingTurns = 0;
                        if (entity.huntingTurns < entity.turns) {
                            const searchRadius = entity.attack_range;
                            const hidingSpots = [];
                            for (let x = Math.max(0, entity.x - searchRadius); x <= Math.min(size - 1, entity.x + searchRadius); x++) {
                                for (let y = Math.max(0, entity.y - searchRadius); y <= Math.min(size - 1, entity.y + searchRadius); y++) {
                                    if (helper.tileBlocked(x, y)) continue;
                                    if (x === entity.x && y === entity.y) continue;
                                    if (!EntitySystem.hasLOS({x: entity.x, y: entity.y}, x, y, false)) {
                                        hidingSpots.push({ x, y, distance: calc.distance(entity.x, x, entity.y, y) });
                                    }
                                }
                            }
                            if (hidingSpots.length > 0) {
                                hidingSpots.sort((a, b) => a.distance - b.distance);
                                const t = hidingSpots[Math.floor(Math.random() * Math.min(3, hidingSpots.length))];
                                this.enemyMoveToward(entity, t.x, t.y);
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
            if (!isWall && !isOccupied && entity.range > 0) {
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

    // Returns the planned movement path for an enemy toward targetX/targetY without moving them.
    computeEnemyPath: function(entity, targetX, targetY) {
        if (!pts || targetX < 0 || targetX >= size || targetY < 0 || targetY >= size) return [];

        const graph = new Graph(pts, { diagonal: true });
        entities.forEach(e => {
            if (e !== entity && e.hp > 0 && !(e.x === targetX && e.y === targetY)) {
                if (graph.grid[e.x]?.[e.y]) graph.grid[e.x][e.y].weight = 0;
            }
        });

        if (!graph.grid[entity.x]?.[entity.y] || !graph.grid[targetX]?.[targetY]) return [];

        const path = astar.search(
            graph,
            graph.grid[entity.x][entity.y],
            graph.grid[targetX][targetY],
            { closest: true, heuristic: astar.heuristics.diagonal }
        );

        if (!path || path.length === 0) return [];

        // Trim to the entity's actual movement range
        let distanceMoved = 0;
        const trimmed = [];
        for (let step of path) {
            const stepCost = walls.some(w => w.x === step.x && w.y === step.y && w.type === 'water') ? 2 : 1;
            if (distanceMoved + stepCost <= entity.range) {
                const occupied = entities.some(e => e !== entity && e.hp > 0 && e.x === step.x && e.y === step.y);
                const isWall = walls.some(w => w.x === step.x && w.y === step.y && w.type !== 'water');
                if (!occupied && !isWall) { trimmed.push(step); distanceMoved += stepCost; }
                else break;
            } else break;
        }
        return trimmed;
    },

    // passable: optional array of entities whose tiles should remain walkable in the graph
    enemyMoveToward: function(entity, targetX, targetY, passable = []) {
        if (!pts) { currentEntityTurnsRemaining--; return; }
        if (targetX < 0 || targetX >= size || targetY < 0 || targetY >= size) {
            entity.seenX = 0; entity.seenY = 0;
            currentEntityTurnsRemaining--;
            return;
        }

        const diagonalGraph = new Graph(pts, { diagonal: true });
        entities.forEach(e => {
            if (e !== entity && e.hp > 0 && !(e.x === targetX && e.y === targetY)) {
                if (passable.some(p => p.x === e.x && p.y === e.y)) return;
                if (diagonalGraph.grid[e.x]?.[e.y]) diagonalGraph.grid[e.x][e.y].weight = 0;
            }
        });

        if (!diagonalGraph.grid[entity.x]?.[entity.y] || !diagonalGraph.grid[targetX]?.[targetY]) {
            entity.seenX = 0; entity.seenY = 0;
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
            entity.seenX = 0; entity.seenY = 0;
            this.enemyRandomMove(entity);
            return;
        }

        let distanceMoved = 0;
        let finalX = entity.x;
        let finalY = entity.y;

        for (let step of path) {
            const stepCost = walls.some(w => w.x === step.x && w.y === step.y && w.type === 'water') ? 2 : 1;
            if (distanceMoved + stepCost <= entity.range) {
                const occupied = entities.some(e => e !== entity && e.hp > 0 && e.x === step.x && e.y === step.y);
                const isWall = walls.some(w => w.x === step.x && w.y === step.y && w.type !== 'water');
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

            if (isPlayerControlled(entity)) {
                if (currentEntityTurnsRemaining <= 0) {
                    if (typeof processInventoryGrenades !== 'undefined') {
                        processInventoryGrenades(entity);
                    }
                }
            }

            if (isPlayerControlled(entity) && currentEntityTurnsRemaining <= 0) {
                currentEntityIndex++;
                if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
                currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
            }

            if (isPlayerControlled(entity)) this.checkEnemyLOS();
            update();

            if (isPlayerControlled(entity) && window.cursorWorldPos && cursorVisible) {
                window.savedCursorScreenX = window.cursorWorldPos.x - camera.x;
                window.savedCursorScreenY = window.cursorWorldPos.y - camera.y;
            }
        }

        if (currentEntityIndex < 0 || !isPlayerControlled(entities[currentEntityIndex])) return;

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

        if (isPlayerControlled(entity)) {
            if (currentEntityTurnsRemaining <= 0) {
                if (typeof processInventoryGrenades !== 'undefined') {
                    processInventoryGrenades(entity);
                }
            }
        }

        if (isPlayerControlled(entity) && currentEntityTurnsRemaining <= 0) {
            currentEntityIndex++;
            if (currentEntityIndex >= entities.length) currentEntityIndex = 0;
            currentEntityTurnsRemaining = entities[currentEntityIndex].turns;
        }
    },

    hasStrictLOS: function(x1, y1, x2, y2) {
        const path = line({x: x1, y: y1}, {x: x2, y: y2});
        for (let i = 1; i < path.length - 1; i++) {
            const wall = walls.find(w => w.x === path[i].x && w.y === path[i].y);
            if (wall && wall.type !== 'glass' && wall.type !== 'water') return false;
        }
        return true;
    }
};