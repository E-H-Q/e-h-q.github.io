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
					ctx.drawImage(tilesImg, TILE_FLOOR * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, screenX, screenY, tileSize, tileSize);
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
			ctx.font = 'italic bold 16px sans';
			ctx.fillStyle = "#FF0000";
			ctx.fillText("EDIT MODE ON", 5, 16); // RED EDIT MODE TEXT !!!!!!!!!!!!!!
		}
	},

	items: () => {
		if (!mapItems) return;

		mapItems.forEach(item => {
			const itemDef = itemTypes[item.itemType];
			const isEquipment = itemDef?.type === "equipment";
			ctx.fillStyle = isEquipment ? "rgba(255, 165, 0, 0.8)" : "rgba(255, 255, 255, 0.8)";
			const screenX = (item.x - camera.x) * tileSize;
			const screenY = (item.y - camera.y) * tileSize;
			ctx.fillRect(screenX, screenY, tileSize, tileSize);
			if (!isZoomedOut && itemLabels[item.itemType]) {
				ctx.fillStyle = isEquipment ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)";
				ctx.font = 'bold 12px serif';
				ctx.textAlign = 'center';
				ctx.fillText(itemLabels[item.itemType], screenX + tileSize / 2, screenY + tileSize / 2 + 4);
				ctx.textAlign = 'left';
			}
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

	los: (path, directOnly = false) => {
		if (!path || path.length === 0) return;
		const movesImg = document.getElementById("moves");
		ctx.fillStyle = "rgba(255, 255, 0, 0.5)";
		path.forEach(point => {
			ctx.fillRect((point.x - camera.x) * tileSize, (point.y - camera.y) * tileSize, tileSize, tileSize);
		});
		if (movesImg && movesImg.complete && movesImg.naturalWidth > 0) {
			path.forEach(point => {
				const isCursor = window.cursorWorldPos && point.x === window.cursorWorldPos.x && point.y === window.cursorWorldPos.y;
				const hasTarget = !directOnly && (
					entities.some(e => e.hp > 0 && e.x === point.x && e.y === point.y) ||
					walls.some(w => w.x === point.x && w.y === point.y && w.type !== 'water' && w.type !== 'fire')
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

	cursor: () => {
		if (!cursorVisible || !window.cursorWorldPos) return;
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
		allEnemies.forEach(entity => {
			// Draw grenades (entities with explode trait)
			if (helper.hasTrait(entity, 'explode') && entity.hp > 0 && entity.turnsRemaining) {
				const screenX = entity.x - camera.x;
				const screenY = entity.y - camera.y;
				if (screenX >= 0 && screenX < viewportWidth && screenY >= 0 && screenY < viewportHeight) {
					ctx.fillStyle = "#FFFFFF";
					ctx.font = (tileSize / 3) + "px monospace";
					ctx.textAlign = "center";
					ctx.fillText("Gnade",
						(screenX * tileSize) + (tileSize / 2),
						(screenY * tileSize) + 2);
					ctx.fillStyle = "#FF0000";
					ctx.font = "bold " + (tileSize / 2) + "px monospace";
					ctx.textAlign = "center";
					ctx.fillText(entity.turnsRemaining.toString(),
						(screenX * tileSize) + (tileSize / 2),
						(screenY * tileSize) + (tileSize * 0.65));
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

	window: () => {
		if (typeof WindowSystem !== 'undefined') {
			WindowSystem.draw();
		}
	}
};