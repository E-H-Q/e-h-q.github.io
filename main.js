// MAIN.JS: HOLDS IMPORTANT VARIABLES AND FUNCTIONS

var c = document.getElementById("canvas");
var ctx = c.getContext("2d");
var cursor = document.getElementById("cursor");
var action = document.getElementById("actions");
var save_button = document.getElementById("save_button");
var input = document.getElementById("file");
input.value = "";

var edit = document.getElementById("edit");
edit.checked = false;

var tileSize = 32;
var size = 50;
var viewportSize = Math.floor((window.innerWidth * 0.5) / tileSize);

// Peek mode variables
var isPeekMode = false;
var peekStep = 0;
var peekStartX = 0;
var peekStartY = 0;
var savedPlayerRange = 0;

// Console override for logging
(function() {
	var logger = document.getElementById('log');
	console.log = function(message) {
		logger.innerHTML += (typeof message === 'object' ? JSON.stringify(message) : message) + '<br />';
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
var turns_taken = 0;
var camera = {x: 0, y: 0};
var mouse_pos = {x: 0, y: 0};
var array;
var graph;

var player = {
	name: "player",
	hp: 20,
	x: Math.floor(viewportSize / 2),
	y: Math.floor(viewportSize / 2),
	range: 3,
	attack_range: 4,
	turns: 2,
	inventory: [],
	equipment: {}
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
	inventory: []
};

var allEnemies = [];
var entities = [];

function updatePlayer() {
	player.name = document.getElementById('player_name').value || "player";
	player.hp = parseInt(document.getElementById('player_hp').value) || 20;
	player.range = parseInt(document.getElementById('player_range').value) || 3;
	player.attack_range = parseInt(document.getElementById('player_attack_range').value) || 4;
	player.turns = parseInt(document.getElementById('player_turns').value) || 2;
	
	const playerX = document.getElementById('player_x').value;
	const playerY = document.getElementById('player_y').value;
	
	if (playerX !== "" && playerY !== "") {
		const x = parseInt(playerX);
		const y = parseInt(playerY);
		
		if (x >= 0 && x < size && y >= 0 && y < size) {
			player.x = x;
			player.y = y;
			console.log("Player moved to: " + x + ", " + y);
		}
		document.getElementById('player_x').value = "";
		document.getElementById('player_y').value = "";
	}
	
	console.log("Player updated");
	update();
}

function spawnEnemy() {
	const name = document.getElementById('spawn_name').value || "enemy";
	const hp = parseInt(document.getElementById('spawn_hp').value) || 15;
	const manualX = document.getElementById('spawn_x').value;
	const manualY = document.getElementById('spawn_y').value;
	const range = parseInt(document.getElementById('spawn_range').value) || 3;
	const attackRange = parseInt(document.getElementById('spawn_attack_range').value) || 3;
	const turnsVal = parseInt(document.getElementById('spawn_turns').value) || 2;
	
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
			x: spawnX,
			y: spawnY,
			attack_range: attackRange,
			turns: turnsVal,
			seenX: 0,
			seenY: 0,
			inventory: []
		};
		
		allEnemies.push(newEnemy);
		
		// Check initial LOS using strict LOS
		if (typeof turns !== 'undefined' && turns.hasStrictLOS && 
		    turns.hasStrictLOS(newEnemy.x, newEnemy.y, player.x, player.y)) {
			newEnemy.seenX = player.x;
			newEnemy.seenY = player.y;
		}
	
		update();
		console.log("Spawned " + newEnemy.name + " at " + spawnX + ", " + spawnY);
	} else {
		console.log("No valid spawn location found!");
	}
}

var populate = {
	reset: () => resizePtsArray(),
	enemies: () => {
		entities.forEach(e => {
			if (e !== player && e.hp > 0 && pts[e.x]?.[e.y] !== undefined) {
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
	tileBlocked: (x, y) => {
		return walls.some(w => w.x === x && w.y === y) ||
		       allEnemies.some(e => e.hp > 0 && e.x === x && e.y === y) ||
		       (player.x === x && player.y === y);
	},
	
	getAdjacentTiles: (x, y, includeDiagonal = true) => {
		const offsets = includeDiagonal ? 
			[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] :
			[[0,-1],[-1,0],[1,0],[0,1]];
		
		return offsets
			.map(([dx, dy]) => ({x: x + dx, y: y + dy}))
			.filter(tile => tile.x >= 0 && tile.x < size && tile.y >= 0 && tile.y < size);
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
		// Use unified entity system
		const specialMode = (entity === player && isPeekMode && peekStep === 1) ? 'peek' : null;
		EntitySystem.displayMovement(entity, specialMode);
	},
	
	los: function(look) {
		const path = line(look.start, look.end);
		
		for (let wall of walls) {
			const res = path.findIndex(el => el.x === wall.x && el.y === wall.y);
			if (res > 0) {
				path.length = res;
				break;
			}
		}
		return path;
	},
	
	roll: function(sides, dice = 1) {
		if (dice === 1) return this.random(sides);
		return Array.from({length: dice}, () => this.random(sides));
	}
};
