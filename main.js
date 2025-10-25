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

(function () {
    if (!console) {
        console = {};
    }
    var old = console.log;
    var logger = document.getElementById('log');
    console.log = function (message) {
        if (typeof message == 'object') {
            logger.innerHTML += (JSON && JSON.stringify ? JSON.stringify(message) : String(message)) + '<br />';
        } else {
            logger.innerHTML += message + '<br />';
        }
    }
})();

function createAndFillTwoDArray({rows, columns, defaultValue}) {
	return Array.from({ length: rows }, () => 
		Array.from({ length: columns }, () => defaultValue)
	);
}

function resizePtsArray() {
	pts = createAndFillTwoDArray({rows: size, columns: size, defaultValue: 1});
}

var pts = createAndFillTwoDArray({rows: size, columns: size, defaultValue: 1});
var valid = [];
var walls = [];
var turns_taken = 0;
var camera = { x: 0, y: 0 };
var mouse_pos = { x: 0, y: 0 };
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
	const playerName = document.getElementById('player_name').value || "player";
	const playerHp = parseInt(document.getElementById('player_hp').value) || 20;
	const playerX = document.getElementById('player_x').value;
	const playerY = document.getElementById('player_y').value;
	const playerRange = parseInt(document.getElementById('player_range').value) || 3;
	const playerAttackRange = parseInt(document.getElementById('player_attack_range').value) || 4;
	const playerTurns = parseInt(document.getElementById('player_turns').value) || 2;
	
	player.name = playerName;
	player.hp = playerHp;
	player.range = playerRange;
	player.attack_range = playerAttackRange;
	player.turns = playerTurns;
	
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
	const spawnName = document.getElementById('spawn_name').value || "enemy";
	const spawnHp = parseInt(document.getElementById('spawn_hp').value) || 15;
	const manualX = document.getElementById('spawn_x').value;
	const manualY = document.getElementById('spawn_y').value;
	const spawnRange = parseInt(document.getElementById('spawn_range').value) || 3;
	const spawnAttackRange = parseInt(document.getElementById('spawn_attack_range').value) || 3;
	const spawnTurns = parseInt(document.getElementById('spawn_turns').value) || 2;
	
	let spawnX = null;
	let spawnY = null;
	
	if (manualX !== "" && manualY !== "") {
		const x = parseInt(manualX);
		const y = parseInt(manualY);
		
		if (x >= 0 && x < size && y >= 0 && y < size) {
			if (!helper.tileBlocked(x, y)) {
				spawnX = x;
				spawnY = y;
			}
		}
		document.getElementById('spawn_x').value ="";
		document.getElementById('spawn_y').value = "";
	} else {
		const adjacentOffsets = [
			[1, 0], [-1, 0], [0, 1], [0, -1],
			[1, 1], [1, -1], [-1, 1], [-1, -1]
		];
		
		for (let offset of adjacentOffsets) {
			for (var i = 0; i < allEnemies.length; i++) {
				const testX = allEnemies[i].x + offset[0];
				const testY = allEnemies[i].y + offset[1];
			
				if (testX < 0 || testX >= size || testY < 0 || testY >= size) continue;
				if (!helper.tileBlocked(testX, testY)) {
					spawnX = testX;
					spawnY = testY;
					break;
				}
			}
		}
	}
	
	if (spawnX !== null) { 
		const newEnemy = {
			name: spawnName,
			hp: spawnHp,
			x: spawnX,
			y: spawnY,
			range: spawnRange,
			attack_range: spawnAttackRange,
			turns: spawnTurns,
			seenX: 0,
			seenY: 0,
			inventory: []
		};
		
		allEnemies.push(newEnemy);
		
		const dist = calc.distance(newEnemy.x, player.x, newEnemy.y, player.y);
		const look = {
			start: { x: newEnemy.x, y: newEnemy.y },
			end: { x: player.x, y: player.y }
		};
		const check = calc.los(look);
		const lengthDiff = Math.abs(check.length - dist);
		
		if (lengthDiff <= 1 && check.length >= dist) {
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
	reset: function() {
		resizePtsArray(); // Reset pts to all 1s
	},
	enemies: function() {
		for (let i = 0; i < entities.length; i++) {
			if (entities[i] !== player && entities[i].hp > 0) {
				if (pts[entities[i].x] && pts[entities[i].x][entities[i].y] !== undefined) {
					pts[entities[i].x][entities[i].y] = 0;
				}
			}
		}
	},
	player: function() {
		if (player.hp > 0) {
			if (pts[player.x] && pts[player.x][player.y] !== undefined) {
				pts[player.x][player.y] = 0;
			}
		}
	}
};

var helper = {
	tileBlocked: function(x, y) {
		const hasWall = walls.find(w => w.x === x && w.y === y);
		const hasEntity = allEnemies.find(e => e.hp > 0 && e.x === x && e.y === y);
		const hasPlayer = (player.x === x && player.y === y);
		return hasWall || hasEntity || hasPlayer;
	},
	
	getAdjacentTiles: function(x, y, includeDiagonal = true) {
		const tiles = [];
		const offsets = includeDiagonal ? [
			[-1, -1], [0, -1], [1, -1],
			[-1, 0], [1, 0],
			[-1, 1], [0, 1], [1, 1]
		] : [
			[0, -1], [-1, 0], [1, 0], [0, 1]
		];
		
		for (let [dx, dy] of offsets) {
			const newX = x + dx;
			const newY = y + dy;
			if (newX >= 0 && newX < size && newY >= 0 && newY < size) {
				tiles.push({x: newX, y: newY});
			}
		}
		return tiles;
	}
};

var calc = {
	random: function(n) {
		return Math.floor(Math.random() * n) + 1;
	},
	coordinate: function(x, y) {
		this.x = x;
		this.y = y;
	},
	distance: function(x1, x2, y1, y2) {
		return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
	},
	move: function(entity) {
		// Special case for peek mode - show adjacent tiles only
		if (entity === player && isPeekMode && peekStep === 1) {
			const adjacentTiles = helper.getAdjacentTiles(entity.x, entity.y, true);
			
			for (let tile of adjacentTiles) {
				if (!helper.tileBlocked(tile.x, tile.y)) {
					if (!valid.find(item => item.x === tile.x && item.y === tile.y)) {
						valid.push(new calc.coordinate(tile.x, tile.y));
					}
					ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
					ctx.fillRect((tile.x - camera.x) * tileSize, (tile.y - camera.y) * tileSize, tileSize, tileSize);
				}
			}
			return;
		}
		
		circle(entity.y, entity.x, entity.range);
		convert();
		if(!pts) return false;

		graph = new Graph(pts, {diagonal: true});

		for (let i = 0; i < entities.length; i++) {
			if (entities[i] !== entity && entities[i].hp > 0) {
				if (pts[entities[i].x] && pts[entities[i].x][entities[i].y] !== undefined) {
					pts[entities[i].x][entities[i].y] = 0;
				}
			}
		}

		for (let i = 0; i < pts.length; i++) {
			for (let j = 0; j < pts.length; j++) {
				if (pts[i][j] === 1) {
					var res = astar.search(graph, graph.grid[entity.x][entity.y], graph.grid[i][j]);
					
					// Check if path length (with diagonal cost) is within range
					if (res.length > 0) {
						let pathCost = 0;
						for (let k = 0; k < res.length; k++) {
							if (k === 0) {
								pathCost += 1;
							} else {
								const prev = res[k - 1];
								const curr = res[k];
								const isDiagonal = (prev.x !== curr.x && prev.y !== curr.y);
								pathCost += isDiagonal ? 1.41421 : 1;
							}
						}
						
						if (pathCost <= entity.range) {
							canvas.range(res, entity);
						}
					}
				}
			}
		}
	},
	los: function(look) {
		var path = line(look.start, look.end);
		
		for (let i = 0; i < walls.length; i++) {
			var res = path.findIndex(el => el.x === walls[i].x && el.y === walls[i].y);
			if (res > 0) {
				path.length = res;
				break;
			}
		}
		return path;
	},
	roll: function(sides, dice) {
		if (dice === 1) {
			return this.random(sides);
		}
		var rolls = [];
		for (let i = 0; i < dice; i++) {
			rolls.push(this.random(sides));
		}
		return rolls;
	}
};
