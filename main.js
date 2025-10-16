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
var size = 15;
var viewportSize = 15;

(function () { // REDIRECTS CONSOLE.LOG TO HTML!
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
var array; // Used by circle.js
var graph; // Used by calc.move()

var player = {
	name: "player",
	hp: 20,
	x: Math.floor(viewportSize / 2),
	y: Math.floor(viewportSize / 2),
	range: 3,
	attack_range: 4,
	turns: 2
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
	seenY: 0
};

// Store all enemy instances here for easy duplication
var allEnemies = [];

var entities = [];

function updatePlayer() {
	// Get values from player settings form
	const playerName = document.getElementById('player_name').value || "player";
	const playerHp = parseInt(document.getElementById('player_hp').value) || 20;
	const playerX = document.getElementById('player_x').value;
	const playerY = document.getElementById('player_y').value;
	const playerRange = parseInt(document.getElementById('player_range').value) || 3;
	const playerAttackRange = parseInt(document.getElementById('player_attack_range').value) || 4;
	const playerTurns = parseInt(document.getElementById('player_turns').value) || 2;
	
	// Update player stats
	player.name = playerName;
	player.hp = playerHp;
	player.range = playerRange;
	player.attack_range = playerAttackRange;
	player.turns = playerTurns;
	
	// Update position if provided
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
	// Get values from spawn settings form
	const spawnName = document.getElementById('spawn_name').value || "enemy";
	const spawnHp = parseInt(document.getElementById('spawn_hp').value) || 15;
	const manualX = document.getElementById('spawn_x').value;
	const manualY = document.getElementById('spawn_y').value;
	const spawnRange = parseInt(document.getElementById('spawn_range').value) || 3;
	const spawnAttackRange = parseInt(document.getElementById('spawn_attack_range').value) || 3;
	const spawnTurns = parseInt(document.getElementById('spawn_turns').value) || 2;
	
	let spawnX = null;
	let spawnY = null;
	
	// Use manual coordinates if provided
	if (manualX !== "" && manualY !== "") {
		const x = parseInt(manualX);
		const y = parseInt(manualY);
		
		// Validate manual coordinates
		if (x >= 0 && x < size && y >= 0 && y < size) {
			const hasWall = walls.find(w => w.x === x && w.y === y);
			const hasEntity = allEnemies.find(e => e.hp > 0 && e.x === x && e.y === y);
			const hasPlayer = (player.x === x && player.y === y);
			
			if (!hasWall && !hasEntity && !hasPlayer) {
				spawnX = x;
				spawnY = y;
			}
		}
		document.getElementById('spawn_x').value ="";
		document.getElementById('spawn_y').value = "";
	} else {
		// Auto-find adjacent tile
		const adjacentOffsets = [
			[1, 0], [-1, 0], [0, 1], [0, -1],  // orthogonal
			[1, 1], [1, -1], [-1, 1], [-1, -1]  // diagonal
		];
		
		for (let offset of adjacentOffsets) {
			for (var i = 0; i < allEnemies.length; i++) {
				const testX = allEnemies[i].x + offset[0];
				const testY = allEnemies[i].y + offset[1];
			
				if (testX < 0 || testX >= size || testY < 0 || testY >= size) continue;
			
				const hasWall = walls.find(w => w.x === testX && w.y === testY);
				const hasEntity = allEnemies.find(e => e.hp > 0 && e.x === testX && e.y === testY);
				const hasPlayer = (player.x === testX && player.y === testY);
			
				if (!hasWall && !hasEntity && !hasPlayer) {
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
			seenY: 0
		};
		
		allEnemies.push(newEnemy);
		
		// Check if enemy can see player after adding to array
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

var calc = {
	random: function(n) {
		return Math.floor(Math.random() * n) + 1;
	},
	coordinate: function(x, y) {
		this.x = x;
		this.y = y;
	},
	distance: function(x1, x2, y1, y2) {
		// Use Chebyshev distance (diagonal = 1 tile) for attack range
		return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
	},
	move: function(entity) {
		circle(entity.y, entity.x, entity.range);
		convert();
		if(!pts) return false;

		graph = new Graph(pts);	
		graph.diagonal = false;

		// Block tiles occupied by other entities
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
					canvas.range(res, entity);
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
