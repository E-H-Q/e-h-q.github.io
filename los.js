// LOS.JS: LINE OF SIGHT (LERP) + MOVEMENT RANGE (BRESENHAM CIRCLE)

function lerp(start, end, t) {
	return start + t * (end - start);
}

function lerp_point(p0, p1, t) {
	return new calc.coordinate(lerp(p0.x, p1.x, t), lerp(p0.y, p1.y, t));
}

function round_point(p) {
	return new calc.coordinate(Math.round(p.x), Math.round(p.y));
}

function line(p0, p1) {
	const points = [];
	const N = calc.distance(p0.x, p1.x, p0.y, p1.y);
	for (let step = 0; step <= N; step++) {
		const t = N === 0 ? 0.0 : step / N;
		points.push(round_point(lerp_point(p0, p1, t)));
	}
	return points;
}

function wallBlocksLOS(wall, ignoreShields = false) {
	if (!wall) return false;
	if (wall.type === 'glass' || FLOOR_TILES.has(wall.type)) return false;
	if (ignoreShields && wall.type === 'shield') return false;
	if (wall.type === 'door' && wall.open) return false;
	return true;
}

// Clips a path to the first blocking wall.
// canBreach: pass through 1 adjacent regular wall/door + 1 tile beyond.
function clipPathAtWall(path, canBreach = false) {
	if (!path || path.length === 0) return [];

	for (let i = 1; i < path.length; i++) {
		if (!wallBlocksLOS(wallAt(path[i].x, path[i].y))) continue;
		if (canBreach) return path.slice(0, Math.min(i + 2, path.length));
		return path.slice(0, i);
	}
	return path;
}

// LOS check for canBreach/canDestroy: clear path OR 1 adjacent regular wall tile + 1 tile beyond it.
function hasBreachingLOS(startX, startY, endX, endY) {
	const path = line({x: startX, y: startY}, {x: endX, y: endY});
	let wallsHit = 0;
	for (let i = 1; i < path.length; i++) {
		if (!wallBlocksLOS(wallAt(path[i].x, path[i].y))) continue;
		if (wallsHit === 0) { wallsHit++; i++; continue; }
		return false;
	}
	return true;
}

function getEntitiesInTiles(tiles) {
	const hit = [];
	for (const tile of tiles) {
		for (const entity of entities) {
			if (entity.hp > 0 && entity.x === tile.x && entity.y === tile.y && !hit.includes(entity)) {
				hit.push(entity);
			}
		}
	}
	return hit;
}

function calculateCone(path, startX, startY, endX, endY, maxRange, spread) {
	spread = spread || 3;
	const coneTiles = new Set();

	for (let point of path) coneTiles.add(`${point.x},${point.y}`);

	const dx = endX - startX;
	const dy = endY - startY;
	const distance = Math.sqrt(dx * dx + dy * dy);

	if (distance < 1) {
		return Array.from(coneTiles).map(s => { const [x, y] = s.split(',').map(Number); return {x, y}; });
	}

	const perpX = -dy / distance;
	const perpY = dx / distance;
	const tilesPerSide = Math.floor((spread - 1) / 2);
	const allSidePaths = [];

	for (let side of [-1, 1]) {
		for (let offset = 1; offset <= tilesPerSide; offset++) {
			const dirX = dx / distance;
			const dirY = dy / distance;
			const rayEndX = Math.round(startX + dirX * maxRange + perpX * offset * side);
			const rayEndY = Math.round(startY + dirY * maxRange + perpY * offset * side);

			let sidePath = line({x: startX, y: startY}, {x: rayEndX, y: rayEndY});
			sidePath = clipPathAtWall(sidePath);

			if (sidePath.length > 1) {
				sidePath = sidePath.length > maxRange + 1 ? sidePath.slice(1, maxRange + 1) : sidePath.slice(1);
				allSidePaths.push(sidePath);
				for (let point of sidePath) coneTiles.add(`${point.x},${point.y}`);
			}
		}
	}

	const allPaths = [path, ...allSidePaths];
	let maxLen = 0;
	for (let p of allPaths) if (p.length > maxLen) maxLen = p.length;

	for (let i = 0; i < maxLen; i++) {
		const pointsAtDepth = allPaths.map(p => p[Math.min(i, p.length - 1)]).filter(Boolean);
		for (let j = 0; j < pointsAtDepth.length - 1; j++) {
			const fillLine = line({x: pointsAtDepth[j].x, y: pointsAtDepth[j].y},
			                      {x: pointsAtDepth[j+1].x, y: pointsAtDepth[j+1].y});
			for (let pt of fillLine) coneTiles.add(`${pt.x},${pt.y}`);
		}
	}

	return Array.from(coneTiles).map(s => { const [x, y] = s.split(',').map(Number); return {x, y}; });
}

function circle(xc, yc, r) {
	if (!array || array.length !== size * size) array = new Uint8Array(size * size);
	else array.fill(0);
	if (r < 1) return;

	let xoff = 0;
	let yoff = r;
	let b = -r;

	while (xoff <= yoff) {
		const p0 = xc - xoff;
		const p1 = xc - yoff;
		const w0 = xoff + xoff;
		const w1 = yoff + yoff;

		hl(p0, yc - yoff, yc + yoff, w0);
		hl(p1, yc - xoff, yc + xoff, w1);

		if ((b += xoff++ + xoff) >= 0) {
			b -= --yoff + yoff;
		}
	}

	function hl(x, y1, y2, w) {
		w++;
		while (w--) {
			const xw = x + w;
			if (helper.inBounds(xw, y1)) {
				array[y1 * size + xw] = 1;
			}
			if (helper.inBounds(xw, y2)) {
				array[y2 * size + xw] = 1;
			}
		}
	}
}

function convert() {
	if (!pts || pts.length !== size || pts[0]?.length !== size) resizePtsArray();
	for (let i = 0; i < size; i++) {
		const row = pts[i];
		for (let j = 0; j < size; j++) row[j] = array[i * size + j];
	}
	
	walls.forEach(wall => {
		if (pts[wall.x]?.[wall.y] !== undefined) {
			if (wall.type === 'water') {
				pts[wall.x][wall.y] = 2;
			} else if (wall.type === 'fire') {
				pts[wall.x][wall.y] = 3;
			} else if (wall.type === 'door' && wall.open == true) {
				pts[wall.x][wall.y] = 1;
			} else {
				pts[wall.x][wall.y] = 0;
			}
		}
	});
}