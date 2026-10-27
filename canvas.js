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
const SPRITE_SIZE = 32;
const SPRITE_ACTIVE    = 8;
const SPRITE_CROSSHAIR = 9;
const SPRITE_FOLLOWER = 10;
const SPRITE_FIRE_STATUS = 11;
const SPRITE_LOCKED = 12;
const SPRITE_CHARM_STATUS = 13;
const SPRITE_UNAWARE = 14;
const SPRITE_FLYING = 15;
const SPRITE_LEAD = 16;

const TILE_SPRITE_MAP = {
	wall:     { row: 0, col: 0 },
	glass:    { row: 0, col: 1 },
	door:     { row: 0, col: 2 },
	doorOpen: { row: 0, col: 3 },
	grave:    { row: 0, col: 4 },
	floor:    { row: 1, col: 0 },
	water:    { row: 1, col: 1 },
	fire:     { row: 1, col: 2 },
	pit:      { row: 1, col: 3 },
	damage:   { row: 2, col: 0 },
	blood:    { row: 2, col: 1 }
};

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
	key:            { row: 1, col: 4 },
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
	if ((typeof inventoryHidden !== 'undefined' && inventoryHidden) || !isPlayerControlled(entities[currentEntityIndex])) return -1;
	const o = getInventoryOrigin();
	const w = INVENTORY_COLS * tileSize;
	const h = INVENTORY_ROWS * tileSize;
	if (canvasX < o.x || canvasX >= o.x + w) return -1;
	if (canvasY < o.y || canvasY >= o.y + h) return -1;
	const col = Math.floor((canvasX - o.x) / tileSize);
	const row = Math.floor((canvasY - o.y) / tileSize);
	return row * INVENTORY_COLS + col;
}

// Ability bar: 2 rows, fills right-to-left column by column (top, then bottom).
const ABILITY_BAR_ROWS = 2;

// Own traits plus traits from equipped items.
function getEntityAbilities(entity) {
	if (!entity) return [];
	const fromItems = Object.values(entity.equipment || {}).flatMap(i => getItemDef(i)?.traits || []);
	return [...new Set([...(entity.traits || []), ...fromItems])].filter(t => abilityTypes[t]);
}

// entity.abilityOrder: bar order, index = bar slot. New abilities append, removed ones drop out.
function syncAbilityBar(entity) {
	if (!entity) return;
	const all = getEntityAbilities(entity);
	const order = (entity.abilityOrder || []).filter(k => all.includes(k));
	all.forEach(k => { if (!order.includes(k)) order.push(k); });
	entity.abilityOrder = order;
}

function abilityAtBarSlot(entity, slot) {
	syncAbilityBar(entity);
	return entity.abilityOrder[slot] || null;
}

// Trait sprites from traits.png, 32x32 sprites on a 6x4 grid. Row 3 = abilities.
const TRAIT_GRID_COLS = 6;
const TRAIT_GRID_ROWS = 4;
// Overlays on traits.png, drawn over trait icons. Not part of the trait grid.
const TRAIT_OVERLAY_MAP = {
	itemMarker: { row: 0, col: 4 }
};

const TRAIT_SPRITE_MAP = {
	player:     { row: 0, col: 0 },
	default:    { row: 0, col: 1 },
	defensive:  { row: 0, col: 2 },
	aggressive: { row: 0, col: 3 },
	fire:       { row: 1, col: 0 },
	charmed:    { row: 1, col: 1 },
	explode:    { row: 1, col: 2 },
	active:     { row: 1, col: 3 },
	fireDef:    { row: 1, col: 4 },
	flying:     { row: 1, col: 5 },
	immolate:   { row: 2, col: 0 },
	lifesteal:  { row: 2, col: 1 },
	canBreach:  { row: 2, col: 2 },
	canDestroy: { row: 2, col: 3 },
	dashAttack: { row: 3, col: 0 },
	magDump:    { row: 3, col: 1 },
	charm:      { row: 3, col: 2 },
	donor:      { row: 3, col: 3 },
	shield:     { row: 3, col: 4 },
	detonate:   { row: 3, col: 5 }
};

// Granted by equipment only, not the entity's own traits.
function traitFromItemOnly(entity, key) {
	return !(entity.traits || []).includes(key) &&
		Object.values(entity.equipment || {}).some(i => getItemDef(i)?.traits?.includes(key));
}

function traitAtSlot(slot) {
	return Object.keys(TRAIT_SPRITE_MAP).find(k =>
		TRAIT_SPRITE_MAP[k].row * TRAIT_GRID_COLS + TRAIT_SPRITE_MAP[k].col === slot) || null;
}

// Entity sprites from entities.png, 32x32 sprites on a 3x3 grid.
// Row 0 = player, Row 1 = enemies (default, defensive, aggressive), Row 2 = death anim, grave
const ENTITY_SPRITE_MAP = {
	player:     { row: 0, col: 0 },
	enemy:      { row: 1, col: 0 },
	defensive:  { row: 1, col: 1 },
	aggressive: { row: 1, col: 2 },
	death:      { row: 2, col: 0 }
};

// Cosmetic blood splatter, "x,y" -> quarter-turn rotation. Saved with map, rotation re-rolled on load. Cleared on regen.
var bloodTiles = new Map();

// A tile takes blood if it isn't water or fire and isn't already bloodied.
function canBleedOn(x, y) {
	const t = wallAt(x, y)?.type;
	return !FLOOR_TILES.has(t) && !bloodTiles.has(x + ',' + y);
}

function addBlood(x, y) {
	bloodTiles.set(x + ',' + y, calc.random(4) - 1);
}

// One splatter under the entity, plus one adjacent per 25% of max HP taken (8 at double HP).
function spillBlood(entity, dmg) {
	if (helper.isGrenadeEntity(entity)) return;
	if (canBleedOn(entity.x, entity.y)) addBlood(entity.x, entity.y);
	let n = Math.min(8, Math.round(dmg / (entity.maxHp || entity.hp + dmg) * 4));
	const tiles = helper.getAdjacentTiles(entity.x, entity.y, true).filter(t => canBleedOn(t.x, t.y));
	while (n-- > 0 && tiles.length) {
		const t = tiles.splice(calc.random(tiles.length) - 1, 1)[0];
		addBlood(t.x, t.y);
	}
}

// Sprites follow original allegiance: charmed entities keep their pre-charm sprite.
// Aggressive wins over defensive when an enemy carries both.
function entitySpriteId(e) {
	const t = (e._precharm ? e._precharm.traits : e.traits) || [];
	if (t.includes('player')) return "player";
	if (t.includes('aggressive')) return "aggressive";
	if (t.includes('defensive')) return "defensive";
	return "enemy";
}

function drawSprite(sheet, sp, sx, sy, size = tileSize) {
	const img = document.getElementById(sheet);
	if (!sp || !img || !img.complete || !img.naturalWidth) return false;
	ctx.drawImage(img, sp.col * SPRITE_SIZE, sp.row * SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE, sx, sy, size, size);
	return true;
}

function toScreenX(x) {
	return (x - camera.x) * tileSize;
}

function toScreenY(y) {
	return (y - camera.y) * tileSize;
}

function fillTile(x, y) {
	ctx.fillRect(toScreenX(x), toScreenY(y), tileSize, tileSize);
}

function drawWall(wall, sx, sy, size = tileSize) {
	if (wall.type === 'shield') drawTraitSprite('shield', sx, sy, true, size);
	else drawSprite('tiles', TILE_SPRITE_MAP[wall.type === 'door' && wall.open ? 'doorOpen' : TILE_SPRITE_MAP[wall.type] ? wall.type : 'wall'], sx, sy, size);
	if (wall.damaged) {
		if (wall.type !== 'glass') ctx.filter = 'invert(1)';
		drawSprite('tiles', TILE_SPRITE_MAP.damage, sx, sy, size);
		ctx.filter = 'none';
	}
	canvas.drawStatusSprites(wall, sx, sy, size);
}

// Generic timed animation queue; each entry re-renders the live scene, then calls draw(t).
const anims = [];

function stepAnims() {
	const now = performance.now();
	for (let i = anims.length - 1; i >= 0; i--) {
		if (now - anims[i].start >= anims[i].duration) anims.splice(i, 1);
	}
	update();
	if (anims.length) requestAnimationFrame(stepAnims);
}

function drawTraitSprite(key, sx, sy, active = true, size = tileSize) {
	if (!active) ctx.filter = "grayscale(100%)";
	const drawn = drawSprite('traits', TRAIT_SPRITE_MAP[key] || TRAIT_OVERLAY_MAP[key], sx, sy, size);
	ctx.filter = "none";
	if (!drawn) {
		ctx.fillStyle = "#FF00FF";
		ctx.fillRect(sx, sy, size, size);
	}
}

// Slot i -> cell; col counts leftward from the inventory.
function abilityIndexToCell(i) {
	return { col: i >> 1, row: i & 1 };
}

function abilityCellToIndex(row, col) {
	return col * 2 + row;
}

function getAbilityBarCols(entity) {
	const n = getEntityAbilities(entity).length;
	let cols = 0;
	for (let i = 0; i < n; i++) cols = Math.max(cols, abilityIndexToCell(i).col + 1);
	return cols;
}

function abilitySlotPos(i) {
	const o = getInventoryOrigin(), cell = abilityIndexToCell(i);
	return { x: o.x - (cell.col + 1) * tileSize, y: o.y + cell.row * tileSize };
}

// Returns the ability slot under a canvas-pixel position, or -1.
function getAbilitySlotAt(canvasX, canvasY) {
	if ((typeof inventoryHidden !== 'undefined' && inventoryHidden) || !isPlayerControlled(entities[currentEntityIndex])) return -1;
	const o = getInventoryOrigin();
	const col = Math.floor((o.x - canvasX) / tileSize);
	const row = Math.floor((canvasY - o.y) / tileSize);
	if (canvasX >= o.x || col >= getAbilityBarCols(getActivePlayerEntity()) || row < 0 || row >= ABILITY_BAR_ROWS) return -1;
	return abilityCellToIndex(row, col);
}

// Returns a Set of "x,y" strings for every tile occupied by a living entity.
function getOccupiedTiles() {
	const occupied = new Set();
	entities.forEach(e => { if (e.hp > 0 && !helper.isGrenadeEntity(e)) occupied.add(e.x + ',' + e.y); });
	return occupied;
}

var canvas = {
	init: () => {
		const w = tileSize * viewportWidth, h = tileSize * viewportHeight;
		if (c.width !== w) c.width = w;
		if (c.height !== h) c.height = h;
		ctx.imageSmoothingEnabled = false; // resizing the canvas resets context state
	},

	clear: () => {
		ctx.clearRect(0, 0, c.width, c.height);
	},

	grid: () => {
		for (let i = 0; i < viewportWidth; i++) {
			for (let j = 0; j < viewportHeight; j++) {
				const worldX = camera.x + i;
				const worldY = camera.y + j;
				const screenX = i * tileSize;
				const screenY = j * tileSize;
				if (!helper.inBounds(worldX, worldY)) {
					ctx.strokeStyle = "rgba(255, 0, 0, 0.2)";
					ctx.lineWidth = 1;
					ctx.beginPath();
					ctx.moveTo(screenX, screenY);
					ctx.lineTo(screenX + tileSize, screenY + tileSize);
					ctx.moveTo(screenX + tileSize, screenY);
					ctx.lineTo(screenX, screenY + tileSize);
					ctx.stroke();
				} else {
					drawSprite('tiles', TILE_SPRITE_MAP.floor, screenX, screenY);
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
		walls.forEach(wall => drawWall(wall, toScreenX(wall.x), toScreenY(wall.y)));
	},

	// Drawn after walls: sits on floor and wall tiles, under entities and items
	blood: () => {
		bloodTiles.forEach((rot, key) => {
			const [x, y] = key.split(',').map(Number);
			const t = wallAt(x, y)?.type;
			if (FLOOR_TILES.has(t) || t === 'shield') return;
			ctx.save();
			ctx.translate(toScreenX(x + 0.5), toScreenY(y + 0.5));
			ctx.rotate(rot * Math.PI / 2);
			drawSprite('tiles', TILE_SPRITE_MAP.blood, -tileSize / 2, -tileSize / 2);
			ctx.restore();
		});
	},

	// onlyTiles: optional Set of "x,y" keys to limit which tiles are drawn
	items: (onlyTiles = null) => {
		if (!mapItems) return;

		const occupied = getOccupiedTiles();

		// Group items by tile position
		const tileMap = new Map();
		mapItems.forEach(item => {
			const key = item.x + ',' + item.y;
			if (!tileMap.has(key)) tileMap.set(key, []);
			const stack = tileMap.get(key);
			if (itemTypes[item.itemType]?.type === "consumable") stack.push(item);
			else stack.unshift(item);
		});

		tileMap.forEach((tileItems, key) => {
			if (onlyTiles && !onlyTiles.has(key)) return;
			const topItem = tileItems[tileItems.length - 1];
			const screenX = toScreenX(topItem.x);
			const screenY = toScreenY(topItem.y);
			const hasStack = tileItems.length > 1;

			if (occupied.has(key)) ctx.globalAlpha = 0.5;

			drawSprite('items', ITEM_SPRITE_MAP[topItem.itemType], screenX, screenY);

			// Draw "+" indicator for stacks
			if (hasStack) {
				const fontSize = Math.max(8, Math.round(tileSize * 0.35));
				ctx.font = 'bold ' + fontSize + 'px sans-serif';
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
			fillTile(coord.x, coord.y);
		}
	},

	// Highlights all tiles in 'path' yellow and draws crosshairs on entities/walls within them.
	// 'directOnly': if true, only draws crosshairs on the first entity hit, not walls.
	// 'hitTiles': optional subset of tiles where crosshairs are allowed (e.g. blast area only,
	//             excluding the travel path). When null, all tiles in 'path' are eligible.
	los: (path, directOnly = false, hitTiles = null) => {
		if (!path || path.length === 0) return;
		ctx.fillStyle = "rgba(255, 255, 0, 0.5)";
		path.forEach(point => fillTile(point.x, point.y));
		// Build a fast lookup for the crosshair-eligible tiles.
		const crosshairSet = hitTiles
			? new Set(hitTiles.map(t => t.x + ',' + t.y))
			: null;

		path.forEach(point => {
			// Skip this tile for crosshair purposes if it's outside the hit area.
			if (crosshairSet && !crosshairSet.has(point.x + ',' + point.y)) return;

			const isCursor = window.cursorWorldPos && point.x === window.cursorWorldPos.x && point.y === window.cursorWorldPos.y;
			const w = wallAt(point.x, point.y);
			const hasTarget = !directOnly && (
				helper.entityAt(point.x, point.y) ||
				(w && !FLOOR_TILES.has(w.type) && !w.open)
			);
			if (isCursor || hasTarget) canvas.crosshair(point.x, point.y);
		});
	},

	path: (path, startX, startY, entity) => {
		if (!path || path.length === 0) return;

		ctx.fillStyle = "rgba(255, 255, 0, 0.5)";
		path.forEach(point => fillTile(point.x, point.y));

		if (startX !== undefined && startY !== undefined) {
			path.forEach((point, i) => {
				if (i === path.length - 1) return;
				const prevX = i === 0 ? startX : path[i - 1].x;
				const prevY = i === 0 ? startY : path[i - 1].y;
				const dx = Math.sign(point.x - prevX);
				const dy = Math.sign(point.y - prevY);
				const spriteIndex = DIR_TO_SPRITE[dx + ',' + dy];
				if (spriteIndex !== undefined) drawSprite('moves', {col: spriteIndex, row: 0}, toScreenX(point.x), toScreenY(point.y));
			});
		}

		if (entity) {
			const last = path[path.length - 1];
			ctx.globalAlpha = 0.4;
			drawSprite('entities', ENTITY_SPRITE_MAP[entitySpriteId(entity)], toScreenX(last.x), toScreenY(last.y));
			ctx.globalAlpha = 1.0;
		}
	},

	// Sprite overlays for entities and walls; shared by the map and the examine window.
	drawStatusSprites: (entity, screenX, screenY, size = tileSize) => {
		const sprite = (i, ox = 0) => drawSprite('moves', {col: i, row: 0}, screenX + ox, screenY, size);

		if (!isPlayerControlled(entity) && entity.seenX === 0 && entity.seenY === 0) sprite(SPRITE_UNAWARE);
		if (helper.hasTrait(entity, 'fire')) sprite(SPRITE_FIRE_STATUS);
		if (entity.locked) sprite(SPRITE_LOCKED);
		if (helper.hasTrait(entity, 'flying')) sprite(SPRITE_FLYING);
		if (helper.hasTrait(entity, 'charmed')) {
			for (let i = 0; i < entity.charmRounds; i++) sprite(SPRITE_CHARM_STATUS, i * 3);
		}
	},

	// Turn-order overlays: remaining action points, and markers over this entity's followers.
	drawTurnIndicators: (entity, screenX, screenY) => {
		const m = activeContextMenu, c = m && helper.entityAt(m.tileX, m.tileY), lead = c && (c.following || c);
		if (lead && entity.following === lead) drawSprite('moves', {col: SPRITE_FOLLOWER, row: 0}, screenX, screenY);
		if (lead === entity && entities.some(e => e.following === entity)) drawSprite('moves', {col: SPRITE_LEAD, row: 0}, screenX, screenY);
		if (entities[currentEntityIndex] !== entity) return;

		for (let i = 0; i < currentEntityTurnsRemaining; i++) {
			drawSprite('moves', {col: SPRITE_ACTIVE, row: 0}, screenX - (i * 3), screenY);
		}
		entities.forEach(e => {
			if (e.following === entity) drawSprite('moves', {col: SPRITE_FOLLOWER, row: 0}, toScreenX(e.x), toScreenY(e.y));
		});
	},

	drawEntity: (entity, color, imgId) => {
		const hasActed = !entity.following && entity.has_acted;
		ctx.fillStyle = color;
		const screenX = toScreenX(entity.x);
		const screenY = toScreenY(entity.y);

		if (hasActed) ctx.filter = "grayscale(75%)";
		ctx.fillRect(screenX, screenY, tileSize, tileSize);
		if (hasActed) ctx.filter = "brightness(75%)";
		drawSprite('entities', ENTITY_SPRITE_MAP[imgId], screenX, screenY);
		canvas.drawStatusSprites(entity, screenX, screenY);

		if (!isZoomedOut) {
			ctx.fillStyle = "rgba(255, 255, 255, 1)";
			ctx.font = '16px serif';
			ctx.textAlign = 'left';
			ctx.fillText(entity.hp, screenX, screenY + tileSize);
		}
		ctx.filter = 'none';

		canvas.drawTurnIndicators(entity, screenX, screenY);
	},

	// duration in ms, draw(t) called each frame with t going 0 -> 1
	addAnim: (duration, draw) => {
		if (!duration) return;
		const wasEmpty = !anims.length;
		anims.push({start: performance.now(), duration, draw});
		if (wasEmpty) requestAnimationFrame(stepAnims);
	},

	deathAnim: (entity) => {
		const x = entity.x, y = entity.y;
		canvas.addAnim(750, t => {
			ctx.globalAlpha = 1 - t;
			drawSprite('entities', ENTITY_SPRITE_MAP.death, toScreenX(x), toScreenY(y - 2 * t));
			ctx.globalAlpha = 1.0;
		});
	},

	centerOn: (x, y) => {
		camera = {x: x - Math.round(viewportWidth / 2) + 1, y: y - Math.round(viewportHeight / 2) + 1};
	},

	// Pans the camera until (x, y) is 1 tile inside the view, over the turn delay.
	panTo: (x, y, done) => {
		const delay = parseInt(document.getElementById("turn-delay").value) || 0;
		const from = {x: camera.x, y: camera.y};
		const to = {
			x: Math.min(Math.max(camera.x, x - viewportWidth + 2), x - 1),
			y: Math.min(Math.max(camera.y, y - viewportHeight + 2), y - 1)
		};
		canvas.addAnim(delay, t => {
			camera = {x: Math.round(from.x + (to.x - from.x) * t), y: Math.round(from.y + (to.y - from.y) * t)};
		});
		setTimeout(() => { camera = to; if (done) done(); update(); }, delay);
	},

	explosionAnim: (x, y) => {
		//const duration = parseInt(document.getElementById("turn-delay").value) || 0;
		const size = 5 * tileSize; // explode radius of 2 = 5 tiles across. +1 for explode sprite margins.
		//canvas.addAnim(duration, t => {
		canvas.addAnim(1000, t => {
			const img = document.getElementById("explode");
			if (!img || !img.complete || !img.naturalWidth) return;
			ctx.globalAlpha = 1 - t;
			ctx.drawImage(img, toScreenX(x + 0.5) - size / 2, toScreenY(y + 0.5) - size / 2, size, size);
			ctx.globalAlpha = 1.0;
		});
	},

	playAnims: () => {
		const now = performance.now();
		anims.forEach(a => a.draw(Math.min(1, (now - a.start) / a.duration)));
	},

	drawOnionskin: () => {
		if (specialMode === 'peek' && peekStep > 0) {
			ctx.fillStyle = "rgba(0, 0, 255, 0.2)";
			fillTile(peekStartX, peekStartY);
			ctx.globalAlpha = 0.3;
			drawSprite('entities', ENTITY_SPRITE_MAP.player, toScreenX(peekStartX), toScreenY(peekStartY));
			ctx.globalAlpha = 1.0;
		}
	},

	selectedEditTiles: () => {
		if (!edit.checked || !selectedEditTiles || selectedEditTiles.length === 0) return;
		ctx.fillStyle = "rgba(0, 220, 255, 0.45)";
		selectedEditTiles.forEach(t => fillTile(t.x, t.y));
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
				if (helper.hasGrabbableAt(tile.x, tile.y)) fillTile(tile.x, tile.y);
			}
		} else if (adjacentSelect.mode === 'door') {
			const doorTiles = helper.getAdjacentTiles(activeEnt.x, activeEnt.y, true)
				.filter(tile => wallAt(tile.x, tile.y)?.type === 'door');
			for (const tile of doorTiles) fillTile(tile.x, tile.y);
		}
	},

	cursor: () => {
		if (!cursorVisible || !window.cursorWorldPos) return;
		// Hide the world cursor while mousing over the inventory panel or an ability tile
		if (!keyboardMode && (window.inventoryHoverSlot >= 0 || window.abilityHoverSlot >= 0)) return;
		const screenX = toScreenX(window.cursorWorldPos.x);
		const screenY = toScreenY(window.cursorWorldPos.y);
		if (screenX >= 0 && screenX < c.width && screenY >= 0 && screenY < c.height) {
			ctx.strokeStyle = "rgba(255, 0, 0, 1)";
			ctx.lineWidth = 2;
			ctx.strokeRect(screenX, screenY, tileSize, tileSize);
		}
	},

	player: () => {
		allPlayers.forEach(e => {
			if (e.hp >= 1) {
				const color = isPlayerControlled(e) ? (e.playerColor || "rgba(0, 0, 255, 0.5)") : "rgba(0, 0, 0, 0)";
				const sprite = entitySpriteId(e);
				canvas.drawEntity(e, color, sprite);
			}
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

			/*
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
			*/

			// Restore array so the rest of the frame isn't affected
			if (savedArray) array = savedArray;
			else array = new Uint8Array(size * size);
		}
	},

	// 1px perimeter outline of a blast area
	grenadeOutline: (grenade) => {
		const r = grenade._radius ?? itemTypes.grenade?.damageRadius;
		if (r === undefined) return;

		const savedArray = array ? new Uint8Array(array) : null;
		circle(grenade.y, grenade.x, r);
		const inBlast = (x, y) => helper.inBounds(x, y) && array[x * size + y] === 1;

		ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let wx = Math.max(0, grenade.x - r - 1); wx <= Math.min(size - 1, grenade.x + r + 1); wx++) {
			for (let wy = Math.max(0, grenade.y - r - 1); wy <= Math.min(size - 1, grenade.y + r + 1); wy++) {
				if (!inBlast(wx, wy)) continue;
				const bx = toScreenX(wx), by = toScreenY(wy);
				if (bx < -tileSize || bx >= c.width || by < -tileSize || by >= c.height) continue;
				if (!inBlast(wx, wy - 1)) { ctx.moveTo(bx, by + 0.5); ctx.lineTo(bx + tileSize, by + 0.5); }
				if (!inBlast(wx, wy + 1)) { ctx.moveTo(bx, by + tileSize - 0.5); ctx.lineTo(bx + tileSize, by + tileSize - 0.5); }
				if (!inBlast(wx - 1, wy)) { ctx.moveTo(bx + 0.5, by); ctx.lineTo(bx + 0.5, by + tileSize); }
				if (!inBlast(wx + 1, wy)) { ctx.moveTo(bx + tileSize - 0.5, by); ctx.lineTo(bx + tileSize - 0.5, by + tileSize); }
			}
		}
		ctx.stroke();

		if (savedArray) array = savedArray;
		else array = new Uint8Array(size * size);
	},

	enemy: () => {
		allEnemies.forEach(entity => {
			// Draw grenades (entities with explode trait)
			if (helper.hasTrait(entity, 'explode') && entity.hp > 0 && entity.turnsRemaining) {
				const screenX = toScreenX(entity.x);
				const screenY = toScreenY(entity.y);
				if (screenX >= -tileSize && screenX < c.width && screenY >= -tileSize && screenY < c.height) {
					// If another living entity (e.g. the player) is on this tile, match
					// canvas.items: draw at half opacity so the entity beneath stays visible.
					const isOccupied = helper.entityAt(entity.x, entity.y, e => e !== entity);
					if (isOccupied) ctx.globalAlpha = 0.5;
					// Draw live grenade sprite
					drawSprite('items', ITEM_SPRITE_MAP.grenadeLive, screenX, screenY);
					// Red countdown number — only while active
					if (helper.hasTrait(entity, 'active')) {
						ctx.fillStyle = "#FF0000";
						ctx.font = "bold " + (tileSize / 2) + "px monospace";
						ctx.textAlign = "center";
						ctx.fillText(entity.turnsRemaining.toString(),
							screenX + tileSize / 2,
							screenY + tileSize * 0.65);
					}
					ctx.globalAlpha = 1.0;
				}
			} else { // not grenade
				if (entity.hp >= 1) { // player controlled entities always get the player sprite, this will need to change down the line.
					const color = isPlayerControlled(entity) ? (entity.playerColor || "rgba(0, 0, 255, 0.5)") : "rgba(0, 0, 0, 0)";
					const sprite = entitySpriteId(entity);
					canvas.drawEntity(entity, color, sprite);
				}
			}
		});
	},

	crosshair: (x, y) => {
		drawSprite('moves', {col: SPRITE_CROSSHAIR, row: 0}, toScreenX(x), toScreenY(y));
	},

	hitLabel: (x, y, pct) => {
		ctx.font = 'bold 16px monospace';
		ctx.fillStyle = 'red';
		ctx.textAlign = 'center';
		//ctx.fillText('HIT: ' + pct + '%', toScreenX(x) + tileSize / 2, toScreenY(y) - 2);
		ctx.fillText(pct + '%', toScreenX(x) + tileSize / 2, toScreenY(y) - 2);
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
		if ((typeof inventoryHidden !== 'undefined' && inventoryHidden) || !isPlayerControlled(entities[currentEntityIndex])) return;
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

					drawSprite('items', sp, sx, sy, slot);

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
						ctx.font = '12px monospace';
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
			const def = getItemDef(item);
			let name = getItemLabel(item);
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
		} else if (window.abilityHoverSlot >= 0 && abilityAtBarSlot(entity, window.abilityHoverSlot)) {
			const key = abilityAtBarSlot(entity, window.abilityHoverSlot);
			ctx.fillStyle = "#FFFFFF";
			ctx.font = "13px monospace";
			ctx.textAlign = "left";
			ctx.fillText(abilityTypes[key].name, origin.x + 4, origin.y - 6);
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
			ctx.globalAlpha = 0.75;
			drawSprite('items', sp, drag.mouse.x - slot / 2, drag.mouse.y - slot / 2, slot);
			ctx.globalAlpha = 1.0;
		}
	},

	abilityTile: (key, entity, sx, sy, myTurn, highlight = key === specialMode) => {
		const usable = myTurn && !abilityTypes[key].canUse(entity);
		drawTraitSprite(key, sx, sy, usable);
		if (highlight) {
			ctx.strokeStyle = "rgba(255, 255, 0, 1)";
			ctx.lineWidth = 1;
			ctx.strokeRect(sx + 0.5, sy + 0.5, tileSize - 1, tileSize - 1);
		}
	},

	// Ability tiles: the bar, drop-target highlight and the drag ghost.
	abilityBar: () => {
		if ((typeof inventoryHidden !== 'undefined' && inventoryHidden) || !isPlayerControlled(entities[currentEntityIndex])) return;
		const entity = getActivePlayerEntity();
		if (!entity) return;
		const myTurn = entities[currentEntityIndex] === entity;
		const ad = window.abilityDrag;
		syncAbilityBar(entity);
		const order = entity.abilityOrder;

		const gridSel = typeof uiGridSelect !== 'undefined' ? uiGridSelect : null;
		if (gridSel && gridSel.grid === 'ability') {
			ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
			ctx.lineWidth = 1;
			const cols = getAbilityBarCols(entity);
			for (let i = 0; i < cols * ABILITY_BAR_ROWS; i++) {
				if (abilityIndexToCell(i).col >= cols) continue;
				const p = abilitySlotPos(i);
				ctx.strokeRect(p.x + 0.5, p.y + 0.5, tileSize - 1, tileSize - 1);
			}
		}

		order.forEach((key, i) => {
			if (ad.isDragging && ad.fromBar === i) return;
			const p = abilitySlotPos(i);
			canvas.abilityTile(key, entity, p.x, p.y, myTurn);
		});

		if (ad.isDragging && ad.key && ad.mouse) {
			const b = getAbilitySlotAt(ad.mouse.x, ad.mouse.y);
			ctx.fillStyle = "rgba(255, 255, 0, 0.25)";
			if (b >= 0 && b < order.length) {
				const p = abilitySlotPos(b);
				ctx.fillRect(p.x, p.y, tileSize, tileSize);
			}
			canvas.abilityTile(ad.key, entity, ad.mouse.x - tileSize / 2, ad.mouse.y - tileSize / 2, myTurn);
		}

		if (gridSel) {
			const g = UI_GRIDS[gridSel.grid];
			const go = g.origin();
			const cols = g.cols();
			ctx.strokeStyle = "rgba(255, 255, 0, 1)";
			ctx.lineWidth = 2;
			ctx.strokeRect(go.x + (gridSel.slot % cols) * tileSize + 1,
				go.y + ((gridSel.slot / cols) | 0) * tileSize + 1, tileSize - 2, tileSize - 2);
		}
	},

	abilityPopup: () => {
		const p = abilityPopup;
		if (!p) return;
		WindowSystem.drawContextMenu(p);
		p.keys.forEach((k, i) => canvas.abilityTile(k, getActivePlayerEntity(), p.x + p.padding + i * tileSize, p.y + p.padding, true, k === p.hover));
	},

	// Top layer, drawn last in update() so nothing can cover it
	editModeText: () => {
		if (!edit.checked) return;
		ctx.save();
		ctx.font = 'italic bold 16px sans';
		ctx.fillStyle = "#FF0000";
		ctx.textAlign = 'left';
		ctx.fillText("EDIT MODE ON", 5, 16);
		ctx.restore();
	},

	window: () => {
		if (typeof WindowSystem !== 'undefined') {
			WindowSystem.draw();
		}
	}
};