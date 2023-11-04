// MAIN.JS: HOLDS IMPORTANT VARIABLES AND FUNCTIONS

var c = document.getElementById("canvas");
var ctx = c.getContext("2d");
var cursor = document.getElementById("cursor");
var action = document.getElementById("actions");
var save_button = document.getElementById("save_button");
var input = document.getElementById("file"); // file input
input.value = "";

var edit = document.getElementById("edit");
edit.checked = false;

var tileSize = 32; // size (in px) of every tile ***DONT CHANGE THIS***
var size = 15; // canvas size (in tiles), (move into the map gen file as an object w/ X & Y values so it can be calculated w/ the map)
var viewportSize = 15; // !!! IMPORTANT !!!

function createAndFillTwoDArray({
  rows,
  columns,
  defaultValue
}){
  return Array.from({ length:rows }, () => (
      Array.from({ length:columns }, ()=> defaultValue)
   ))
}

//var pts = new Array();
var pts = createAndFillTwoDArray({rows:size, columns:size, defaultValue: 1});
var valid = new Array();
var walls = new Array();

var turns_taken = 0;

var player = {
	name: "player",
	hp: 20,
	x: Math.floor(viewportSize/2),
	y: Math.floor(viewportSize/2),
	range: 3,
	turns: 2
};

var enemy = {
	name: "enemy",
	hp: 15,
	x: 2,
	y: 2,
	range: 3,
	turns: 2,
	// seenX/Y: the last seen x y coords of the player
	seenX: 1,
	seenY: 1
};

var entities = new Array();
entities.push(enemy);

var populate = { // "spawns" things in, (enemies + items)
	enemies: function() {
		for (i = 0; i < entities.length; i++) {
			if (entities[i].hp > 0) {
				pts[entities[i].x][entities[i].y] = 0;
			} else {
				continue;
			}
		}

	}
};

var calc = { // HOLDS IMPORTANT FUNCTIONS
	random: function(n) {
		return~~ (Math.random() * (n)) + 1;
	},
	coordinate: function(x, y) {
		this.x = x;
		this.y = y;
	},
	repeat: function(item) {
		if (item.x == i && item.y == j) {
			return true;
		} else {
			return false;
		}
	},
	distance: function(x1, x2, y1, y2) {
		return Math.floor(Math.hypot(x2-x1, y2-y1));
	},
	move: function(entity) { // handles the players movement range area
		circle(entity.y, entity.x, entity.range);
		convert();
		//convert(camera);
		if(!pts) return false;

		/////// THIS NEEDS TO GO SOMEWHERE ELSE BUT ENEMY COLLISION DOESNT WORK UNLESS ITS HERE \\\\\\\
		//populate.enemies();

		graph = new Graph(pts);	
		graph.diagonal = false;

		for (i = 0; i < pts.length; i++) { // pts feels clunky, needs(?) a better solution
			for (j = 0; j < pts.length; j++) {
				if (pts[i][j] == 1) { // '1' is an open tile, whereas '0' is a wall
					var res = astar.search(graph, graph.grid[entity.x][entity.y], graph.grid[i][j]);
					canvas.range(res);
				} else {
					continue;
				}
			}
		}
	},
	los: function(look) {
		if (!look) {
			var look = {
				start: {
					x: player.x,
					y: player.y
				},
				end: {
					x: Math.ceil(camera.x + mouse_pos.x / tileSize) - 1,
					y: Math.ceil(camera.y + mouse_pos.y / tileSize) - 1
				}
			};
			var path = line(look.start, look.end);
		} else {
			var path = line(look.start, look.end);
		}
		for (i = 0; i < walls.length; i++) {
			//find index of path[i].x & path[i].y in walls array
			let res = path.findIndex( element => {
				if (element.x === walls[i].x && element.y === walls[i].y) {
					return true;
				}
			});
			if (res > 0 && res) {
				path.length = res;
			}
		}
		return path;
	},
	roll: function(sides, dice) { // sides eg:6 and dice: how many times to roll
		var roll;
		var rolls = new Array();

		for (i = 0; i < dice; i++) {
			roll = calc.random(sides);
			rolls.push(roll);
		}
		if (rolls.length > 1) {
			return(rolls);
		} else {
			return roll;
		}
	}
};
