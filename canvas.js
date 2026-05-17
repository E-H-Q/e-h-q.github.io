// CANVAS.JS: DRAWS STUFF ON THE CANVAS "SCREEN"

const DIR_TO_SPRITE = {
	"0,-1": 0,  // up
	"1,-1": 1,  // up-right
	"1,0":  2,  // right
	"1,1":  3,  // down-right
	"0,1":  4,  // down
	"-1,1": 5,  // down-left
	"-1,0": 6,  // left
	"-1,-1":7   // up-left
};
const MOVE_SPRITE_SIZE = 32;
const SPRITE_ACTIVE    = 8;
const SPRITE_CROSSHAIR = 9;
const SPRITE_FOLLOWER = 10;
const SPRITE_FIRE_STATUS = 11;

const TILE_SIZE        = 32;
const TILE_WALL        = 0;
const TILE_FLOOR       = 1;
const TILE_GLASS       = 2;
const TILE_BROKEN      = 3;
const TILE_WATER       = 4;
const TILE_FIRE        = 5;
const TILE_DOOR_CLOSED = 6;
const TILE_DOOR_OPEN   = 7;

const ITEM_SPRITE_SIZE = 32;
// Row 0 = weapons, Row 1 = consumables, Row 2 = equipment
// Order matches the dropdown menus in the UI (same order as itemTypes defined in items.js)
const ITEM_SPRITE_MAP = {
	// Weapons row (top, row 0): knife, rifle, shotgun, rocketLauncher, machinegun, pistol
	knife:          { row: 0, col: 0 },
	rifle:          { row: 0, col: 1 },
	shotgun:        { row: 0, col: 2 },
	rocketLauncher: { row: 0, col: 3 },
	machinegun:     { row: 0, col: 4 },
	pistol:	        { row: 0, col: 5 },
	// Consumables row (middle, row 1): healthPotion, speedPotion, grenade, grenadeLive
	healthPotion:   { row: 1, col: 0 },
	speedPotion:    { row: 1, col: 1 },
	grenade:        { row: 1, col: 2 },
	grenadeLive:    { row: 1, col: 3 },
	// Equipment row (bottom, row 2): kevlarVest, scope, breachingKit, flameBadge
	kevlarVest:     { row: 2, col: 0 },
	scope:          { row: 2, col: 1 },
	breachingKit:   { row: 2, col: 2 },
	flameBadge:     { row: 2, col: 3 },
};

// Inventory display layout
const INV_NAME_BUFFER = 22;  // space above the grid for the hover-name text

// Inventory is pinned flush to the bottom-right of the canvas so its slots line
// up with the map tile grid (slot size = tileSize). The hover-name strip sits
// above the grid; the grid's bottom row hugs the bottom edge of the canvas.
function getInventoryOrigin() {
	return {
		x: c.width  - INVENTORY_COLS * tileSize,
		y: c.height - INVENTORY_ROWS * tileSize
	};
}

// Returns the slot index (0..29) under a canvas-pixel position, or -1 if outside
// (or if the inventory is currently hidden — treat the area as empty space).
function getInventorySlotAt(canvasX, canvasY) {
	if (typeof inventoryHidden !== 'undefined' && inventoryHidden) return -1;
	const o = getInventoryOrigin();
	const w = INVENTORY_COLS * tileSize;
	const h = INVENTORY_ROWS * tileSize;
	if (canvasX < o.x || canvasX >= o.x + w) return -1;
	if (canvasY < o.y || canvasY >= o.y + h) return -1;
	const col = Math.floor((canvasX - o.x) / tileSize);
	const row = Math.floor((canvasY - o.y) / tileSize);
	return row * INVENTORY_COLS + col;
}

// Returns a Set of "x,y" strings for every tile occupied by a living entity.
function getOccupiedTiles() {
	const occupied = new Set();
	entities.forEach(e => { if (e.hp > 0) occupied.add(`${e.x},${e.y}`); });
	return occupied;
}

var canvas = {
	init: () => {
		c.width = tileSize * viewportWidth;
		c.height = tileSize * viewportHeight;
	},

	clear: () => {
		ctx.clearRect(0, 0, c.width, c.height);
	},

	grid: () => {
		const tilesImg = document.getElementById("tiles");
		const occupied = getOccupiedTiles();
		for (let i = 0; i < viewportWidth; i++) {
			for (let j = 0; j < viewportHeight; j++) {
				const worldX = camera.x + i;
				const worldY = camera.y + j;
				const screenX = i * tileSize;
				const screenY = j * tileSize;
				if (worldX < 0 || worldY < 0 || worldX >= size || worldY >= size) {
					ctx.strokeStyle = "rgba(255, 0, 0, 0.2)";
					ctx.lineWidth = 1;
					ctx.beginPath();
					ctx.moveTo(screenX, screenY);
					ctx.lineTo(screenX + tileSize, screenY + tileSize);
					ctx.moveTo(screenX + tileSize, screenY);
					ctx.lineTo(screenX, screenY + tileSize);
					ctx.stroke();
				} else if (tilesImg && tilesImg.complete && tilesImg.naturalWidth > 0) {
					if (occupied.has(`${worldX},${worldY}`)) ctx.globalAlpha = 0.5;
					ctx.drawImage(tilesImg, TILE_FLOOR * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, screenX, screenY, tileSize, tileSize);
					ctx.globalAlpha = 1.0;
				}
			}
		}

		ctx.beginPath();
		ctx.lineWidth = 0.1;
		ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
		for (let i = 0; i <= viewportWidth; i++) {
			const pos = i * tileSize;
			ctx.moveTo(pos, 0);
			ctx.lineTo(pos, c.height);
		}
		for (let j = 0; j <= viewportHeight; j++) {
			const pos = j * tileSize;
			ctx.moveTo(0, pos);
			ctx.lineTo(c.width, pos);
		}
		ctx.stroke();
	},

	walls: () => {
		const tilesImg = document.getElementById("tiles");
		const hasSprites = tilesImg && tilesImg.complete && tilesImg.naturalWidth > 0;
		walls.forEach(wall => {
			const screenX = (wall.x - camera.x) * tileSize;
			const screenY = (wall.y - camera.y) * tileSize;
			if (wall.type === 'glass') {
				if (hasSprites) {
					ctx.drawImage(tilesImg, TILE_GLASS * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, screenX, screenY, tileSize, tileSize);
					if (wall.damaged) ctx.drawImage(tilesImg, TILE_BROKEN * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, screenX, screenY, tileSize, tileSize);
				} else {
					ctx.fillStyle = wall.damaged ? "rgba(0, 100, 255, 0.3)" : "rgba(0, 100, 255, 0.5)";
					ctx.fillRect(screenX, screenY, tileSize, tileSize);
				}
			} else if (wall.type === 'water') {
				if (hasSprites) {
					ctx.drawImage(tilesImg, TILE_WATER * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, screenX, screenY, tileSize, tileSize);
				} else {
					ctx.fillStyle = "rgba(0, 50, 200, 0.5)";
					ctx.fillRect(screenX, screenY, tileSize, tileSize);
				}
			} else if (wall.type === 'fire') {
				if (hasSprites) {
					ctx.drawImage(tilesImg, TILE_FIRE * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, screenX, screenY, tileSize, tileSize);
				} else {
					ctx.fillStyle = "rgba(255, 100, 0, 0.6)";
					ctx.fillRect(screenX, screenY, tileSize, tileSize);
				}
			} else if (wall.type === 'door') {
				if (hasSprites) {
					const doorTile = wall.open ? TILE_DOOR_OPEN : TILE_DOOR_CLOSED;
					ctx.drawImage(tilesImg, doorTile * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, screenX, screenY, tileSize, tileSize);
					if (wall.damaged) {
						ctx.filter = "invert(1)";
						ctx.drawImage(tilesImg, TILE_BROKEN * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, screenX, screenY, tileSize, tileSize);
						ctx.filter = "none";
					}
				} else {
					ctx.fillStyle = wall.open ? "rgba(139, 90, 43, 0.3)" : "rgba(139, 90, 43, 0.8)";
					ctx.fillRect(screenX, screenY, tileSize, tileSize);
				}
			} else {
				if (hasSprites) {
					ctx.drawImage(tilesImg, TILE_WALL * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, screenX, screenY, tileSize, tileSize);
				} else {
					ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
					ctx.fillRect(screenX, screenY, tileSize, tileSize);
				}
			}
		});
		if (edit.checked) {
			ctx.save();
			ctx.font = 'italic bold 16px sans';
			ctx.fillStyle = "#FF0000";
			ctx.fillText("EDIT MODE ON", 5, 16); // RED EDIT MODE TEXT !!!!!!!!!!!!!!
			ctx.restore();
		}
	},

	items: () => {
		if (!mapItems) return;

		const itemsImg = document.getElementById("items");
		const hasItemSprites = itemsImg && itemsImg.complete && itemsImg.naturalWidth > 0;
		const occupied = getOccupiedTiles();

		// Group items by tile position
		const tileMap = new Map();
		mapItems.forEach(item => {
			const key = `${item.x},${item.y}`;
			if (!tileMap.has(key)) tileMap.set(key, []);
			tileMap.get(key).push(item);
		});

		tileMap.forEach((tileItems, key) => {
			const topItem = tileItems[tileItems.length - 1];
			const screenX = (topItem.x - camera.x) * tileSize;
			const screenY = (topItem.y - camera.y) * tileSize;
			const hasStack = tileItems.length > 1;

			if (occupied.has(key)) ctx.globalAlpha = 0.5;

			const spriteInfo = ITEM_SPRITE_MAP[topItem.itemType];
			if (hasItemSprites && spriteInfo) {
				ctx.drawImage(
					itemsImg,
					spriteInfo.col * ITEM_SPRITE_SIZE,
					spriteInfo.row * ITEM_SPRITE_SIZE,
					ITEM_SPRITE_SIZE,
					ITEM_SPRITE_SIZE,
					screenX,
					screenY,
					tileSize,
					tileSize
				);
			}

			// Draw "+" indicator for stacks
			if (hasStack) {
				const fontSize = Math.max(8, Math.round(tileSize * 0.35));
				ctx.font = `bold ${fontSize}px sans-serif`;
				ctx.textAlign = 'right';
				ctx.fillStyle = '#000000';
				ctx.fillText('+', screenX + tileSize - 1, screenY + tileSize - 1);
				ctx.fillStyle = '#FFFFFF';
				ctx.fillText('+', screenX + tileSize - 2, screenY + tileSize - 2);
				ctx.textAlign = 'left';
			}

			ctx.globalAlpha = 1.0;
		});
	},

	range: (res, entity) => {
		if (res.length > 0 && res.length <= entity.range + 1) {
			const coord = new calc.coordinate(res[res.length - 1].x, res[res.length - 1].y);
			if (isPlayerControlled(entity) && !valid.find(item => item.x === coord.x && item.y === coord.y)) {
				valid.push(coord);
			}
			ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
			ctx.fillRect((coord.x - camera.x) * tileSize, (coord.y - camera.y) * tileSize, tileSize, tileSize);
		}
	},

	// Highlights all tiles in `path` yellow and draws crosshairs on entities/walls within them.
	// `directOnly`: if true, only draws crosshairs on the first entity hit, not walls.
	// `hitTiles`: optional subset of tiles where crosshairs are allowed (e.g. blast area only,
	//             excluding the travel path). When null, all tiles in `path` are eligible.
	los: (path, directOnly = false, hitTiles = null) => {
		if (!path || path.length === 0) return;
		const movesImg = document.getElementById("moves");
		ctx.fillStyle = "rgba(255, 255, 0, 0.5)";
		path.forEach(point => {
			ctx.fillRect((point.x - camera.x) * tileSize, (point.y - camera.y) * tileSize, tileSize, tileSize);
		});
		if (movesImg && movesImg.complete && movesImg.naturalWidth > 0) {
			// Build a fast lookup for the crosshair-eligible tiles.
			const crosshairSet = hitTiles
				? new Set(hitTiles.map(t => `${t.x},${t.y}`))
				: null;

			path.forEach(point => {
				// Skip this tile for crosshair purposes if it's outside the hit area.
				if (crosshairSet && !crosshairSet.has(`${point.x},${point.y}`)) return;

				const isCursor = window.cursorWorldPos && point.x === window.cursorWorldPos.x && point.y === window.cursorWorldPos.y;
				const hasTarget = !directOnly && (
					entities.some(e => e.hp > 0 && e.x === point.x && e.y === point.y) ||
					walls.some(w => w.x === point.x && w.y === point.y && w.type !== 'water' && w.type !== 'fire' && !w.open)
				);
				if (isCursor || hasTarget) {
					ctx.drawImage(movesImg, SPRITE_CROSSHAIR * MOVE_SPRITE_SIZE, 0, MOVE_SPRITE_SIZE, MOVE_SPRITE_SIZE,
						(point.x - camera.x) * tileSize, (point.y - camera.y) * tileSize, tileSize, tileSize);
				}
			});
		}
	},

	path: (path, startX, startY, entity) => {
		if (!path || path.length === 0) return;

		const moveImg = document.getElementById("moves");
		const useSprites = moveImg && moveImg.complete && moveImg.naturalWidth > 0
			&& startX !== undefined && startY !== undefined;

		ctx.fillStyle = "rgba(255, 255, 0, 0.5)";
		path.forEach(point => {
			ctx.fillRect((point.x - camera.x) * tileSize, (point.y - camera.y) * tileSize, tileSize, tileSize);
		});

		if (useSprites) {
			path.forEach((point, i) => {
				if (i === path.length - 1) return;
				const prevX = i === 0 ? startX : path[i - 1].x;
				const prevY = i === 0 ? startY : path[i - 1].y;
				const dx = Math.sign(point.x - prevX);
				const dy = Math.sign(point.y - prevY);
				const spriteIndex = DIR_TO_SPRITE[`${dx},${dy}`];
				if (spriteIndex !== undefined) {
					ctx.drawImage(moveImg, spriteIndex * MOVE_SPRITE_SIZE, 0, MOVE_SPRITE_SIZE, MOVE_SPRITE_SIZE,
						(point.x - camera.x) * tileSize, (point.y - camera.y) * tileSize, tileSize, tileSize);
				}
			});
		}

		if (entity) {
			const last = path[path.length - 1];
			const pepImg = document.getElementById(isPlayerControlled(entity) ? "pep" : "enemy");
			if (pepImg && pepImg.complete) {
				ctx.globalAlpha = 0.4;
				ctx.drawImage(pepImg, (last.x - camera.x) * tileSize, (last.y - camera.y) * tileSize, tileSize, tileSize);
				ctx.globalAlpha = 1.0;
			}
		}
	},

	drawEntityStatusSprites: (entity, screenX, screenY) => {
		const movesImg = document.getElementById("moves");
		if (!movesImg || !movesImg.complete || !movesImg.naturalWidth) return;

		// Draw fire status if entity has fire trait
		if (helper.hasTrait(entity, 'fire')) {
			ctx.drawImage(movesImg, SPRITE_FIRE_STATUS * MOVE_SPRITE_SIZE, 0, MOVE_SPRITE_SIZE, MOVE_SPRITE_SIZE,
				screenX, screenY, tileSize, tileSize);
		}

		// Draw active indicator if this is the current entity
		const isActive = entities[currentEntityIndex] === entity;
		if (isActive) {
			ctx.drawImage(movesImg, SPRITE_ACTIVE * MOVE_SPRITE_SIZE, 0, MOVE_SPRITE_SIZE, MOVE_SPRITE_SIZE,
				screenX, screenY, tileSize, tileSize);
		}

		// Draw follower indicators
		if (isActive) {
			for (var i = 0; i < entities.length; i++) {
				if (entities[i].following && entities[i].following == entity) {
					ctx.drawImage(movesImg, SPRITE_FOLLOWER * MOVE_SPRITE_SIZE, 0, MOVE_SPRITE_SIZE, MOVE_SPRITE_SIZE,
						(entities[i].x - camera.x) * tileSize, (entities[i].y - camera.y) * tileSize, tileSize, tileSize);
				}
			}
		}
	},

	drawEntity: (entity, color, imgId) => {
		const entityIdx = entities.indexOf(entity);
		const hasActed = isPlayerControlled(entity) && entityIdx >= 0 && entityIdx < currentEntityIndex;
		ctx.fillStyle = color;
		const screenX = (entity.x - camera.x) * tileSize;
		const screenY = (entity.y - camera.y) * tileSize;
		const img = document.getElementById(imgId);
		
		if (hasActed) ctx.filter = "grayscale(75%)";
		ctx.fillRect(screenX, screenY, tileSize, tileSize);
		if (hasActed) ctx.filter = "brightness(75%)";
		ctx.drawImage(img, screenX, screenY, tileSize, tileSize);
		
		if (!isZoomedOut) {
			ctx.fillStyle = "rgba(255, 255, 255, 1)";
			ctx.font = '16px serif';
			ctx.textAlign = 'left';
			ctx.fillText(entity.hp, screenX, screenY + tileSize);
		}
		ctx.filter = 'none';
		
		// Draw status sprites
		canvas.drawEntityStatusSprites(entity, screenX, screenY);
	},

	drawOnionskin: () => {
		if (isPeekMode && peekStep > 0) {
			const screenX = (peekStartX - camera.x) * tileSize;
			const screenY = (peekStartY - camera.y) * tileSize;
			ctx.fillStyle = "rgba(0, 0, 255, 0.2)";
			ctx.fillRect(screenX, screenY, tileSize, tileSize);
			const img = document.getElementById("pep");
			ctx.globalAlpha = 0.3;
			ctx.drawImage(img, screenX, screenY, tileSize, tileSize);
			ctx.globalAlpha = 1.0;
		}
	},

	selectedEditTiles: () => {
		if (!edit.checked || !selectedEditTiles || selectedEditTiles.length === 0) return;
		ctx.fillStyle = "rgba(0, 220, 255, 0.45)";
		selectedEditTiles.forEach(t => {
			const sx = (t.x - camera.x) * tileSize;
			const sy = (t.y - camera.y) * tileSize;
			ctx.fillRect(sx, sy, tileSize, tileSize);
		});
	},
	
	drawAdjacentSelect: () => {
		if (!adjacentSelect) return;
		const activeEnt = getActivePlayerEntity();
		ctx.fillStyle = "rgba(0, 220, 255, 0.45)";

		if (adjacentSelect.mode === 'grab') {
			const grabTiles = [
				{x: activeEnt.x, y: activeEnt.y},
				...helper.getAdjacentTiles(activeEnt.x, activeEnt.y, true)
			];
			for (const tile of grabTiles) {
				if (mapItems.some(item => item.x === tile.x && item.y === tile.y)) {
					ctx.fillRect((tile.x - camera.x) * tileSize, (tile.y - camera.y) * tileSize, tileSize, tileSize);
				}
			}
		} else if (adjacentSelect.mode === 'door') {
			const doorTiles = helper.getAdjacentTiles(activeEnt.x, activeEnt.y, true)
				.filter(tile => walls.some(w => w.x === tile.x && w.y === tile.y && w.type === 'door'));
			canvas.walls(); // without this open doors do not get rendered?
			for (const tile of doorTiles) {
				ctx.fillRect((tile.x - camera.x) * tileSize, (tile.y - camera.y) * tileSize, tileSize, tileSize);
			}
		}
	},

	cursor: () => {
		if (!cursorVisible || !window.cursorWorldPos) return;
		// Hide the world cursor while mousing over the inventory panel
		if (window.inventoryHoverSlot >= 0) return;
		const screenX = (window.cursorWorldPos.x - camera.x) * tileSize;
		const screenY = (window.cursorWorldPos.y - camera.y) * tileSize;
		if (screenX >= 0 && screenX < c.width && screenY >= 0 && screenY < c.height) {
			ctx.strokeStyle = "rgba(255, 0, 0, 1)";
			ctx.lineWidth = 2;
			ctx.strokeRect(screenX, screenY, tileSize, tileSize);
		}
	},

	player: () => {
		allPlayers.forEach(e => {
			if (e.hp >= 1) canvas.drawEntity(e, e.playerColor || "rgba(0, 0, 255, 0.5)", "pep");
		});
	},

	grenadeAreas: (grenade) => {
		const itemDef = itemTypes.grenade;
		if (!itemDef) return;
		if (helper.hasTrait(grenade, 'explode')) {
			const damageRadius = grenade._radius ?? itemDef.damageRadius;

			// Save array state — circle() overwrites the global array
			const savedArray = array ? new Uint8Array(array) : null;

			circle(grenade.y, grenade.x, damageRadius);

			ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
			for (let wx = Math.max(0, grenade.x - damageRadius - 1); wx <= Math.min(size - 1, grenade.x + damageRadius + 1); wx++) {
				for (let wy = Math.max(0, grenade.y - damageRadius - 1); wy <= Math.min(size - 1, grenade.y + damageRadius + 1); wy++) {
					// Use the raw circle array (=== 1) so only tiles inside the blast radius
					// are highlighted — avoids water/fire tiles that convert() would set to 2/3
					if (array[wx * size + wy] === 1) {
						const screenX = (wx - camera.x) * tileSize;
						const screenY = (wy - camera.y) * tileSize;
						if (screenX >= -tileSize && screenX < c.width && screenY >= -tileSize && screenY < c.height) {
							ctx.fillRect(screenX, screenY, tileSize, tileSize);
						}
					}
				}
			}

			// Restore array so the rest of the frame isn't affected
			if (savedArray) array = savedArray;
			else array = new Uint8Array(size * size);
		}
	},

	enemy: () => {
		const itemsImg = document.getElementById("items");
		const hasItemSprites = itemsImg && itemsImg.complete && itemsImg.naturalWidth > 0;
		const liveGrenadeSprite = ITEM_SPRITE_MAP.grenadeLive;

		allEnemies.forEach(entity => {
			// Draw grenades (entities with explode trait)
			if (helper.hasTrait(entity, 'explode') && entity.hp > 0 && entity.turnsRemaining) {
				const screenX = (entity.x - camera.x) * tileSize;
				const screenY = (entity.y - camera.y) * tileSize;
				if (screenX >= -tileSize && screenX < c.width && screenY >= -tileSize && screenY < c.height) {
					// Draw live grenade sprite
					if (hasItemSprites && liveGrenadeSprite) {
						ctx.drawImage(itemsImg,
							liveGrenadeSprite.col * ITEM_SPRITE_SIZE, liveGrenadeSprite.row * ITEM_SPRITE_SIZE,
							ITEM_SPRITE_SIZE, ITEM_SPRITE_SIZE,
							screenX, screenY, tileSize, tileSize);
					}
					// Draw red countdown number
					ctx.fillStyle = "#FF0000";
					ctx.font = "bold " + (tileSize / 2) + "px monospace";
					ctx.textAlign = "center";
					ctx.fillText(entity.turnsRemaining.toString(),
						screenX + tileSize / 2,
						screenY + tileSize * 0.65);
				}
			} else { // not grenade
				if (entity.hp >= 1) canvas.drawEntity(entity, "rgba(125, 125, 0, 0.5)", "enemy");
			}
		});
	},

	crosshair: (x, y) => {
		const movesImg = document.getElementById("moves");
		if (!movesImg || !movesImg.complete || !movesImg.naturalWidth) return;
		ctx.drawImage(movesImg, SPRITE_CROSSHAIR * MOVE_SPRITE_SIZE, 0, MOVE_SPRITE_SIZE, MOVE_SPRITE_SIZE,
			(x - camera.x) * tileSize, (y - camera.y) * tileSize, tileSize, tileSize);
	},

	attackRangeDim: (entity) => {
		const range = getEntityAttackRange(entity);
		ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
		for (let i = 0; i < viewportWidth; i++) {
			for (let j = 0; j < viewportHeight; j++) {
				if (calc.distance(entity.x, camera.x + i, entity.y, camera.y + j) > range) {
					ctx.fillRect(i * tileSize, j * tileSize, tileSize, tileSize);
				}
			}
		}
	},

	// Draws the 3×10 inventory in the bottom-right corner of the canvas.
	// Slot size = tileSize. Top row (cols 0..9) is the hotbar (numeric keys 1..0).
	// Equipped items get a faint yellow overlay. Hovered slot's item name renders below the grid.
	// While dragging, the source slot is dimmed and a ghost sprite follows the cursor.
	inventory: () => {
		if (typeof inventoryHidden !== 'undefined' && inventoryHidden) return;
		if (allPlayers.length === 0) return;
		const entity = getActivePlayerEntity();
		if (!entity) return;
		const inv = getInventory(entity);

		const origin = getInventoryOrigin();
		const cols = INVENTORY_COLS;
		const rows = INVENTORY_ROWS;
		const slot = tileSize;
		const w = cols * slot;
		const h = rows * slot;

		const itemsImg = document.getElementById("items");
		const hasItemSprites = itemsImg && itemsImg.complete && itemsImg.naturalWidth > 0;
		const drag = window.inventoryDrag;

		// Translucent dark backdrop — covers the hover-name strip above the grid
		// plus the grid itself. No horizontal padding so the right edge hugs the canvas.
		ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
		ctx.fillRect(origin.x, origin.y - INV_NAME_BUFFER, w, h + INV_NAME_BUFFER);

		for (let r = 0; r < rows; r++) {
			for (let col = 0; col < cols; col++) {
				const i = r * cols + col;
				const sx = origin.x + col * slot;
				const sy = origin.y + r * slot;
				const item = inv[i];

				// Highlight a valid drop-target slot during drag
				if (drag.isDragging && drag.overSlot === i && drag.startSlot !== i) {
					ctx.fillStyle = "rgba(255, 255, 0, 0.25)";
					ctx.fillRect(sx, sy, slot, slot);
				}

				if (item) {
					const def = itemTypes[item.itemType];
					let spriteKey = item.itemType;
					if (item.isLive && def?.effect === "grenade") spriteKey = "grenadeLive";
					const sp = ITEM_SPRITE_MAP[spriteKey];

					// Dim the source slot while it's being dragged
					const isDragSource = drag.isDragging && drag.startSlot === i;
					if (isDragSource) ctx.globalAlpha = 0.3;

					if (hasItemSprites && sp) {
						ctx.drawImage(itemsImg,
							sp.col * ITEM_SPRITE_SIZE, sp.row * ITEM_SPRITE_SIZE,
							ITEM_SPRITE_SIZE, ITEM_SPRITE_SIZE,
							sx, sy, slot, slot);
					}

					// Faint yellow overlay on equipped items
					if (isItemEquipped(entity, item)) {
						ctx.fillStyle = "rgba(255, 255, 0, 0.25)";
						ctx.fillRect(sx, sy, slot, slot);
					}

					// Quantity (bottom-left, white, like HP)
					if (item.quantity && item.quantity > 1) {
						ctx.fillStyle = "rgba(255, 255, 255, 1)";
						ctx.font = '14px serif';
						ctx.textAlign = 'left';
						ctx.fillText(item.quantity, sx + 2, sy + slot - 2);
					}

					// Live grenade countdown (centered red number)
					if (item.isLive && def?.effect === "grenade") {
						ctx.fillStyle = "#FF0000";
						ctx.font = "bold " + (slot / 2) + "px monospace";
						ctx.textAlign = "center";
						ctx.fillText(item.turnsRemaining, sx + slot / 2, sy + slot * 0.65);
					}

					// Ammo (bottom-right, yellow / red when empty)
					if (def?.slot === "weapon" && def.maxAmmo !== undefined && def.maxAmmo !== Infinity) {
						const ammo = item.currentAmmo !== undefined ? item.currentAmmo : def.maxAmmo;
						ctx.fillStyle = ammo === 0 ? "#FF0000" : "#FFFF00";
						ctx.font = '10px monospace';
						ctx.textAlign = 'right';
						ctx.fillText(ammo + "/" + def.maxAmmo, sx + slot - 2, sy + slot - 2);
					}

					if (isDragSource) ctx.globalAlpha = 1.0;
				}

				// Slot outline: green for hotbar (top row), white otherwise.
				// Hotbar slots also get a small filled green badge in the upper-left
				// with the matching number-key label (slot 0 = "1", ..., slot 9 = "0").
				const isHotbar = r === 0;
				if (isHotbar) {
					const badgeSize = 12;
					ctx.fillStyle = "rgba(0, 200, 0, 1)";
					ctx.fillRect(sx + 1, sy + 1, badgeSize, badgeSize);
					ctx.fillStyle = "#FFFFFF";
					ctx.font = "bold 10px monospace";
					ctx.textAlign = "center";
					ctx.fillText(col === 9 ? "0" : String(col + 1), sx + 1 + badgeSize / 2, sy + 1 + badgeSize - 2);
				}
				ctx.strokeStyle = isHotbar ? "rgba(0, 255, 0, 1)" : "rgba(255, 255, 255, 1)";
				ctx.lineWidth = 1;
				ctx.strokeRect(sx + 0.5, sy + 0.5, slot - 1, slot - 1);
			}
		}

		// Hover name above the grid (default to "INVENTORY" when nothing is hovered).
		// Yellow + centered to match the context-menu title style.
		const hover = window.inventoryHoverSlot;
		const hoveredItem = (hover !== undefined && hover !== null && hover >= 0) ? inv[hover] : null;
		if (hoveredItem) {
			const item = hoveredItem;
			const def = itemTypes[item.itemType];
			let name = def.displayName;
			if (item.isLive && def.effect === "grenade") {
				name = "Grenade (LIVE: " + item.turnsRemaining + "/" + def.fuse + ")";
			} else if (item.quantity > 1) {
				name = "(" + item.quantity + ") " + name;
			}
			if (def.slot === "weapon" && def.maxAmmo !== undefined && def.maxAmmo !== Infinity) {
				const ammo = item.currentAmmo !== undefined ? item.currentAmmo : def.maxAmmo;
				name += " [" + ammo + "/" + def.maxAmmo + "]";
			}
			if (isItemEquipped(entity, item)) name += " (equipped)";
			ctx.fillStyle = "#FFFFFF";
			ctx.font = "13px monospace";
			ctx.textAlign = "left";
			ctx.fillText(name, origin.x + 4, origin.y - 6);
		} else {
			ctx.fillStyle = "#ffdf00";
			ctx.font = "14px monospace";
			ctx.textAlign = "center";
			ctx.fillText("INVENTORY", origin.x + w / 2, origin.y - 6);
		}

		// Drag ghost — follows the cursor
		if (drag.isDragging && drag.item && drag.mouse) {
			const def = itemTypes[drag.item.itemType];
			let spriteKey = drag.item.itemType;
			if (drag.item.isLive && def?.effect === "grenade") spriteKey = "grenadeLive";
			const sp = ITEM_SPRITE_MAP[spriteKey];
			if (hasItemSprites && sp) {
				ctx.globalAlpha = 0.75;
				ctx.drawImage(itemsImg,
					sp.col * ITEM_SPRITE_SIZE, sp.row * ITEM_SPRITE_SIZE,
					ITEM_SPRITE_SIZE, ITEM_SPRITE_SIZE,
					drag.mouse.x - slot / 2, drag.mouse.y - slot / 2, slot, slot);
				ctx.globalAlpha = 1.0;
			}
		}
	},

	window: () => {
		if (typeof WindowSystem !== 'undefined') {
			WindowSystem.draw();
		}
	}
};