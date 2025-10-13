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

function createAndFillTwoDArray({rows, columns, defaultValue}) {
	return Array.from({ length: rows }, () => 
		Array.from({ length: columns }, () => defaultValue)
	);
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

var enemy2 = {
	name: "enemy2",
	hp: 15,
	x: 4,
	y: 2,
	range: 3,
	attack_range: 3,
	turns: 2,
	seenX: 0,
	seenY: 0
};

// Store all enemy instances here for easy duplication
var allEnemies = [enemy, enemy2];

var entities = [];

var populate = {
	enemies: function() {
		for (let i = 0; i < entities.length; i++) {
			if (entities[i] !== player && entities[i].hp > 0) {
				pts[entities[i].x][entities[i].y] = 0;
			}
		}
	},
	player: function() {
		if (player.hp > 0) {
			pts[player.x][player.y] = 0;
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
				pts[entities[i].x][entities[i].y] = 0;
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
