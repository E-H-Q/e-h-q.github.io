// MAIN.JS: HOLDS IMPORTANT VARIABLES AND FUNCTIONS

var c = document.getElementById("canvas");
var ctx = c.getContext("2d");
var action = document.getElementById("actions");
var save_button = document.getElementById("save_button");
var input = document.getElementById("file");
input.value = "";

//const timeout = document.getElementById("turn-delay").value || 250;

var edit = document.getElementById("edit");
edit.checked = false;

var tileSize = 32;
var size = 50;
// Default viewport is wider now that the HTML sidebar is gone (0.7 vs old 0.5)
var viewportWidth = Math.floor((window.innerWidth * 0.7) / tileSize);
var viewportHeight = Math.floor((window.innerWidth * 0.5) / tileSize);

// Fire damage configuration
var fireDamage = 5;

// Charm duration in turns
var charmDuration = 3;

// Special mode state: null | 'peek' | 'dashAttack' | 'magDump'
var specialMode = null;
var specialModeEntity = null;
// Peek internals
var peekStep = 0;
var peekStartX = 0;
var peekStartY = 0;
var savedPlayerRange = 0;

// Edit mode tile selection
var selectedEditTiles = []; // array of {x, y} for shift+click selected tiles in edit mode

// Inventory drag/drop + hover state
window.inventoryDrag = { startSlot: -1, startMouse: null, isDragging: false, item: null, overSlot: -1, mouse: null };
window.inventoryHoverSlot = -1;
window.abilityHoverSlot = -1;
window.abilityDrag = { key: null, startMouse: null, isDragging: false, mouse: null };
window.suppressNextClick = false;

// Colors for extra player-controlled entities
const PLAYER_COLORS = [
	"rgba(0, 180, 100, 0.5)",
	"rgba(180, 0, 180, 0.5)",
	"rgba(200, 100, 0, 0.5)",
	"rgba(0, 180, 200, 0.5)",
	"rgba(200, 180, 0, 0.5)",
];

// Trait definitions
var entityTraits = {
	default:    { name: "Default",    description: "Basic enemy behavior" },
	aggressive: { name: "Aggressive", description: "Chases and hunts target" },
	defensive:  { name: "Defensive",  description: "Seeks cover after taking damage" },
	player:     { name: "Player",     description: "Player-controlled entity" },
	explode: 	{ name: "Explode",	  description: "Explodes on death/countdown"},
	active: 	{ name: "Active", 	  description: "Countdown has been activated"},
	fire:       { name: "On Fire",    description: "(Status) " + fireDamage + "DMG per turn" },
	charmed:   { name: "Charmed",    description: "(Status) Swaps allegiance" },
	immolate:   { name: "Immolate",   description: "Attacks spread fire tiles" },
	lifesteal:  { name: "Life Steal", description: "Heals for damage dealt by attacks" },
	dashAttack: { name: "Dash Attack", description: "(Ability) Melee weapons only" },
	magDump:   { name: "Mag Dump",   description: "(Ability) Burst fire weapons only" },
	charm:     { name: "Charm",      description: "(Ability) Direct aim weapons only" }
};

function moveEntityList(from, to, e) {
	const i = from.indexOf(e);
	if (i >= 0) from.splice(i, 1);
	if (!to.includes(e)) to.push(e);
}

// Charm: target joins the charmer's side until it snaps out (1 in 3 each turn).
// Charmed players adopt the charmer's behavior trait. Originals are snapshot in
// _precharm and restored exactly on uncharm.
// Charmer is optional: without one (e.g. trait toggled in the traits window) the
// target flips to the opposite side and keeps its own behavior trait, or 'default'.
function charmEntity(target, charmer) {
	if (target._precharm) return;
	if (charmer && isPlayerControlled(target) === isPlayerControlled(charmer)) return;
	target._precharm = { traits: target.traits.filter(t => t !== 'charmed'), playerColor: target.playerColor };
	entities.forEach(e => { if (e.following === target) e.following = null; });
	target.following = null;
	const joinPlayers = charmer ? isPlayerControlled(charmer) : !isPlayerControlled(target);
	if (joinPlayers) {
		if (!helper.hasTrait(target, 'player')) target.traits.push('player');
		if (!helper.hasTrait(target, 'charmed')) target.traits.push('charmed');
		target.playerColor = "rgba(255, 105, 180, 0.5)";
		moveEntityList(allEnemies, allPlayers, target);
	} else {
		const src = charmer || target;
		const behavior = (src.traits || []).find(t => t === 'default' || t === 'aggressive' || t === 'defensive') || 'default';
		target.traits = target.traits.filter(t => t !== 'player' && t !== 'charmed' && t !== behavior);
		target.traits.push(behavior, 'charmed');
		if (target.seenX === undefined) { target.seenX = 0; target.seenY = 0; }
		if (target.maxHp === undefined) target.maxHp = target.hp;
		if (target.lastAttacker === undefined) target.lastAttacker = null;
		delete target.playerColor;
		moveEntityList(allPlayers, allEnemies, target);
	}
	target.charmRounds = charmDuration;
	const idx = entities.indexOf(target);
	if (idx >= 0 && idx < currentEntityIndex) currentEntityIndex--;
	console.log(target.name + " is Charmed!");
}

// Keeps charm state consistent with the 'charmed' trait, however it was toggled.
function syncCharm(entity) {
	const has = helper.hasTrait(entity, 'charmed');
	if (has && !entity._precharm) charmEntity(entity);
	else if (!has && entity._precharm) uncharmEntity(entity);
}

function uncharmEntity(target) {
	if (!target._precharm) return;
	target.traits = target._precharm.traits.slice();
	if (target._precharm.playerColor !== undefined) target.playerColor = target._precharm.playerColor;
	else delete target.playerColor;
	delete target._precharm;
	delete target.charmRounds;
	if (isPlayerControlled(target)) moveEntityList(allEnemies, allPlayers, target);
	else moveEntityList(allPlayers, allEnemies, target);
	const idx = entities.indexOf(target);
	if (idx >= 0 && idx < currentEntityIndex) currentEntityIndex--;
	entities.forEach(e => {
		if (e.following === target) {
			console.log(e.name + " stopped following " + target.name + ".");
            e.following = null;
		}
	});
	target.following = null;
	console.log(target.name + " is no longer Charmed!");
}

// Ability definitions. canUse returns null if usable, otherwise the unmet requirement.
var abilityTypes = {
	dashAttack: {
		name: "Dash Attack",
		description: "Slash through enemies. Costs 2AP",
		canUse: function(entity) {
			if (currentEntityTurnsRemaining < 2) return "Requires 2 action points";
			const w = entity.equipment?.weapon ? itemTypes[entity.equipment.weapon.itemType] : null;
			if (!w || w.aimStyle !== "melee") return "Must equip melee weapon";
			return null;
		}
	},
	magDump: {
		name: "Mag Dump",
		description: "Shoot all remaining ammo in weapon. Costs 2AP",
		canUse: function(entity) {
			if (currentEntityTurnsRemaining < 2) return "Requires 2 action points";
			const weapon = entity.equipment?.weapon;

			const w = weapon ? itemTypes[weapon.itemType] : null;
			if (!w || !w.burst) return "Must equip a burst fire weapon";
			const ammo = weapon.currentAmmo !== undefined ? weapon.currentAmmo : w.maxAmmo;
			if (w.maxAmmo == Infinity || w.aimStyle == "melee") return "Incompatible weapon"
			//if (ammo < w.maxAmmo) return "Requires full ammo";
			return null;
		}
	},
	charm: {
		name: "Charm",
		description: "Charm an enemy on hit. Lasts " + charmDuration + " turns. Costs 1AP",
		canUse: function(entity) {
			const w = entity.equipment?.weapon ? itemTypes[entity.equipment.weapon.itemType] : null;
			if (!w || w.aimStyle !== "direct") return "Requires a Direct aim weapon";
			return null;
		}
	}
};

// Console override for logging
(function() {
	var logger = document.getElementById('log');
	console.log = function(message) {
		logger.insertAdjacentHTML('beforeend', (typeof message === 'object' ? JSON.stringify(message) : message) + '<br />');
		while (logger.childNodes.length > 800) logger.removeChild(logger.firstChild);
	};
})();

function createAndFillTwoDArray({rows, columns, defaultValue}) {
	return Array.from({length: rows}, () => Array(columns).fill(defaultValue));
}

function resizePtsArray() {
	pts = createAndFillTwoDArray({rows: size, columns: size, defaultValue: 1});
}

var pts = createAndFillTwoDArray({rows: size, columns: size, defaultValue: 1});
var valid = [];
var walls = [];

var _wallMap = new Map();
var _wallSrc = null;
function _indexWalls() {
	_wallMap.clear();
	for (const w of walls) {
		const k = w.x + ',' + w.y;
		if (!_wallMap.has(k)) _wallMap.set(k, w);
	}
	if (_wallSrc !== walls) {
		_wallSrc = walls;
		['push', 'splice'].forEach(m => {
			const orig = walls[m].bind(walls);
			walls[m] = (...a) => { _wallMap._stale = true; return orig(...a); };
		});
	}
	_wallMap._stale = false;
}
function wallAt(x, y) {
	if (_wallSrc !== walls || _wallMap._stale) _indexWalls();
	return _wallMap.get(x + ',' + y);
}
var turns_taken = 0;
var enemyChainDepth = 0; // >0 while synchronously resolving enemy actions; rendering deferred to chain end
var camera = {x: 0, y: 0};
var mouse_pos = {x: 0, y: 0};
var array;
var graph;

// 30-slot sparse inventory (length stays fixed, nulls = empty slots)
var player = {
	name: "player",
	hp: 20,
	x: Math.floor(viewportWidth / 2),
	y: Math.floor(viewportHeight / 2),
	range: 3,
	attack_range: 4,
	turns: 2,
	inventory: new Array(30).fill(null),
	equipment: {},
	traits: ['player'],
	playerColor: "rgba(0, 0, 255, 0.5)"
};

var enemy = {
	name: "enemy",
	hp: 15,
	x: 2,
	y: 2,
	range: 3,
	attack_range: 3,
	turns: 2,
	seenX: 0,
	seenY: 0,
	inventory: new Array(30).fill(null),
	traits: []
};

var allEnemies = [];
var allPlayers = [player]; // All player-controlled entities; player is always allPlayers[0]
var entities = [];

// Returns true if entity has the 'player' trait
function isPlayerControlled(entity) {
	return entity && entity.traits && entity.traits.includes('player');
}

// Returns the active player-controlled entity this turn, or original player as fallback
function getActivePlayerEntity() {
	const current = entities[currentEntityIndex];
	return (current && isPlayerControlled(current)) ? current : player;
}

function updatePlayer() {
	const target = (typeof getSelectedPlayer === 'function') ? getSelectedPlayer() : player;

	// Strip equipment effects so we're working with raw base stats
	if (target.equipment) {
		for (let slot in target.equipment) {
			if (target.equipment[slot]) {
				const itemDef = itemTypes[target.equipment[slot].itemType];
				if (itemDef) applyEquipmentEffects(target, itemDef, false);
			}
		}
	}

	// Apply new base stats from fields
	target.name = document.getElementById('player_name').value || target.name;
	target.hp = parseInt(document.getElementById('player_hp').value) || target.hp;
	target.range = parseInt(document.getElementById('player_range').value) || target.range;
	target.attack_range = parseInt(document.getElementById('player_attack_range').value) || target.attack_range;
	target.turns = parseInt(document.getElementById('player_turns').value) || target.turns;

	// Re-apply equipment effects on top of new base stats
	if (target.equipment) {
		for (let slot in target.equipment) {
			if (target.equipment[slot]) {
				const itemDef = itemTypes[target.equipment[slot].itemType];
				if (itemDef) applyEquipmentEffects(target, itemDef, true);
			}
		}
	}

	const playerX = document.getElementById('player_x').value;
	const playerY = document.getElementById('player_y').value;

	if (playerX !== "" && playerY !== "") {
		const x = parseInt(playerX);
		const y = parseInt(playerY);
		if (x >= 0 && x < size && y >= 0 && y < size) {
			target.x = x;
			target.y = y;
		}
		document.getElementById('player_x').value = "";
		document.getElementById('player_y').value = "";
	}

	if (typeof updatePlayerSelect === 'function') updatePlayerSelect();
	update();
}

function spawnEnemy() {
	const name = document.getElementById('spawn_name').value || "enemy";
	const hp = parseInt(document.getElementById('spawn_hp').value) || 15;
	const manualX = document.getElementById('spawn_x').value;
	const manualY = document.getElementById('spawn_y').value;
	const range = parseInt(document.getElementById('spawn_range').value);
	const attackRange = parseInt(document.getElementById('spawn_attack_range').value) || 3;
	const turnsVal = parseInt(document.getElementById('spawn_turns').value) || 2;
	const trait = document.getElementById('spawn_trait').value || "default";

	let spawnX = null, spawnY = null;

	if (manualX !== "" && manualY !== "") {
		const x = parseInt(manualX);
		const y = parseInt(manualY);
		if (x >= 0 && x < size && y >= 0 && y < size && !helper.tileBlocked(x, y)) {
			spawnX = x;
			spawnY = y;
		}
		document.getElementById('spawn_x').value = "";
		document.getElementById('spawn_y').value = "";
	} else {
		const adjacentOffsets = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
		outerLoop:
		for (let offset of adjacentOffsets) {
			for (let e of allEnemies) {
				const testX = e.x + offset[0];
				const testY = e.y + offset[1];
				if (testX >= 0 && testX < size && testY >= 0 && testY < size && !helper.tileBlocked(testX, testY)) {
					spawnX = testX;
					spawnY = testY;
					break outerLoop;
				}
			}
		}
	}

	if (spawnX !== null) {
		const newEnemy = {
			name, hp, range,
			x: spawnX, y: spawnY,
			attack_range: attackRange,
			turns: turnsVal,
			seenX: 0, seenY: 0,
			inventory: new Array(maxInventorySlots).fill(null),
			traits: [trait],
			maxHp: hp,
			lastAttacker: null,
			following: null
		};
		allEnemies.push(newEnemy);
		if (typeof turns !== 'undefined' && turns.hasStrictLOS &&
		    turns.hasStrictLOS(newEnemy.x, newEnemy.y, player.x, player.y)) {
			newEnemy.seenX = player.x;
			newEnemy.seenY = player.y;
		}
		update();
	} else {
		console.log("No valid spawn location found!");
	}
}

var populate = {
	reset: () => {
		if (pts.length !== size || pts[0]?.length !== size) resizePtsArray();
		else pts.forEach(r => r.fill(1));
	},
	walls: () => {
		walls.forEach(w => {
			if (pts[w.x]?.[w.y] !== undefined) {
				if (w.type === 'water') {
					pts[w.x][w.y] = 2;
				} else if (w.type === 'fire') {
					pts[w.x][w.y] = 3;
				} else if (w.type === 'door' && w.open) {
					pts[w.x][w.y] = 1;
				} else {
					pts[w.x][w.y] = 0;
				}
			}
		});
	},
	enemies: () => {
		entities.forEach(e => {
			if (e !== player && e.hp > 0 && !helper.isGrenadeEntity(e) && pts[e.x]?.[e.y] !== undefined) {
				pts[e.x][e.y] = 0;
			}
		});
	},
	player: () => {
		if (player.hp > 0 && pts[player.x]?.[player.y] !== undefined) {
			pts[player.x][player.y] = 0;
		}
	}
};

var helper = {
	moveCursorTo: (wx, wy, center = false) => { // moves cursor to x/y, can center camera on cursor!
		window.cursorWorldPos = {
			x: Math.max(0, Math.min(size - 1, wx)),
			y: Math.max(0, Math.min(size - 1, wy))
		};
		cursorVisible = true;
		keyboardMode = true;

		if (isAiming) {
			if (center) {
				const halfW = Math.round(viewportWidth / 2);
				const halfH = Math.round(viewportHeight / 2);

				camera = aimCamera = {
					x: Math.round(wx - halfW + 1),
					y: Math.round(wy - halfH + 1)
				};
			} else {
				updateCamera();
			}
			canvas.init();
		}
		update();
	},

	isGrenadeEntity: (e) => !!e && helper.hasTrait(e, 'explode') && e.turnsRemaining !== undefined,

	hasGrabbableAt: (x, y) => mapItems.some(i => i.x === x && i.y === y) ||
	                         allEnemies.some(e => helper.isGrenadeEntity(e) && e.hp > 0 && e.x === x && e.y === y),

	tileBlocked: (x, y, passThroughPlayers = false) => {
		const w = wallAt(x, y);
		return (w && w.type !== 'water' && w.type !== 'fire' && !(w.type === 'door' && w.open)) ||
		       allEnemies.some(e => e.hp > 0 && !helper.isGrenadeEntity(e) && e.x === x && e.y === y) ||
		       (!passThroughPlayers && (allPlayers.some(e => e.hp > 0 && e.x === x && e.y === y) || (player.x === x && player.y === y)));
	},

	getAdjacentTiles: (x, y, includeDiagonal = true) => {
		const offsets = includeDiagonal ?
			[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] :
			[[0,-1],[-1,0],[1,0],[0,1]];
		return offsets
			.map(([dx, dy]) => ({x: x + dx, y: y + dy}))
			.filter(tile => tile.x >= 0 && tile.x < size && tile.y >= 0 && tile.y < size);
	},

	hasTrait: (entity, trait) => {
		if (!entity) return;
		return entity.traits && entity.traits.includes(trait);
	},

	findNearestCover: (entity, fromX, fromY) => {
		const searchRadius = entity.range * entity.turns;
		const coverTiles = [];
		for (let x = Math.max(0, entity.x - searchRadius); x <= Math.min(size - 1, entity.x + searchRadius); x++) {
			for (let y = Math.max(0, entity.y - searchRadius); y <= Math.min(size - 1, entity.y + searchRadius); y++) {
				if (helper.tileBlocked(x, y)) continue;
				if (x === entity.x && y === entity.y) continue;
				const blocksLOS = !EntitySystem.hasLOS({x, y}, fromX, fromY, true); // USES PERMISSIVE LOS!!!!!!!!!!!
				// Tiles adjacent to an open door count as cover — entity can close it to block LOS
				const nearOpenDoor = helper.getAdjacentTiles(x, y, false)
					.some(t => { const w = wallAt(t.x, t.y); return w && w.type === 'door' && w.open; });
				if (blocksLOS || nearOpenDoor) {
					coverTiles.push({ x, y, distance: calc.distance(entity.x, x, entity.y, y) });
				}
			}
		}
		if (coverTiles.length === 0) return null;
		coverTiles.sort((a, b) => a.distance - b.distance);
		return coverTiles[0];
	},

	applyStatusEffects: function(entity) {
		if (!entity) return;

		if (helper.hasTrait(entity, "fire")) {
			// 1 in 3 chance to remove fire trait
			if (calc.roll(3) == 1) {
				entity.traits = entity.traits.filter(trait => trait != "fire");
				console.log(entity.name + " stopped burning.");
			} else {
				if (entity.equipment && entity.equipment.accessory && entity.equipment.accessory.itemType == "flameBadge") { // Flame badge wearers take no fire damage
					return;
				}
				entity.hp -= fireDamage;
				console.log(entity.name + " takes " + fireDamage + " fire damage!");
			}
		}

		if (helper.hasTrait(entity, "charmed")) {
			entity.charmRounds = (entity.charmRounds || charmDuration) - 1;
			if (entity.charmRounds <= 0) uncharmEntity(entity);
		}

		if (entity.hp <= 0) {
			EntitySystem.death(entity);
		}
	},

	removeRandomFireTiles: function() {
		for (let i = walls.length - 1; i >= 0; i--) {
			if (walls[i].type === 'fire' && !walls[i].permanent) {
				// 1 in 5 chance to remove fire tile
				if (calc.roll(5) === 1) {
					walls.splice(i, 1);
				}
			}
		}
	}
};

var calc = {
	random: (n) => Math.floor(Math.random() * n) + 1,

	coordinate: function(x, y) {
		this.x = x;
		this.y = y;
	},

	distance: (x1, x2, y1, y2) => Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)),

	move: function(entity) {
		// Peek movement display only applies to the entity that activated it
		const mode = (specialMode === 'peek' && peekStep === 1 && entity === specialModeEntity) ? 'peek' : null;
		EntitySystem.displayMovement(entity, mode);
	},

	los: function(look) {
		const path = line(look.start, look.end);
		let earliestWallIndex = path.length;
		for (let wall of walls) {
			const wallIndex = path.findIndex(el => el.x === wall.x && el.y === wall.y);
			if (wallIndex > 0 && wallIndex < earliestWallIndex) {
				earliestWallIndex = wallIndex;
			}
		}
		if (earliestWallIndex < path.length) {
			path.length = earliestWallIndex;
		}
		return path;
	},

	roll: function(sides, dice = 1) {
		if (dice === 1) return this.random(sides);
		return Array.from({length: dice}, () => this.random(sides));
	}
};