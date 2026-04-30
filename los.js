// LOS.JS: LINE OF SIGHT CALCULATIONS USING BRESENHAM/LERP

function lerp(start, end, t) {
	return start + t * (end - start);
}

function lerp_point(p0, p1, t) {
	return new calc.coordinate(lerp(p0.x, p1.x, t), lerp(p0.y, p1.y, t));
}

function chebyshev_distance(p0, p1) {
	const dx = p1.x - p0.x;
	const dy = p1.y - p0.y;
	return Math.max(Math.abs(dx), Math.abs(dy));
}

function round_point(p) {
	return new calc.coordinate(Math.round(p.x), Math.round(p.y));
}

function line(p0, p1) {
	const points = [];
	const N = chebyshev_distance(p0, p1);
	for (let step = 0; step <= N; step++) {
		const t = N === 0 ? 0.0 : step / N;
		points.push(round_point(lerp_point(p0, p1, t)));
	}
	return points;
}

// Returns true if a wall tile blocks LOS (closed doors block, open doors don't)
function wallBlocksLOS(wall) {
	if (!wall) return false;
	if (wall.type === 'glass' || wall.type === 'water' || wall.type === 'fire') return false;
	if (wall.type === 'door' && wall.open) return false;
	return true;
}

// Clips a path array at the first blocking wall. Pass canDestroy=true to ignore walls.
// Optional stopAtDoor=true includes the door tile in the path so it can be targeted.
function clipPathAtWall(path, canDestroy = false, stopAtDoor = false) {
	if (canDestroy) return path;
	for (let i = 1; i < path.length; i++) {
		const wall = walls.find(w => w.x === path[i].x && w.y === path[i].y);
		if (!wall) continue;
		if (wall.type === 'water' || wall.type === 'fire') continue;
		if (wall.type === 'glass' && !wall.damaged) continue;
		if (wall.type === 'door' && wall.open) continue;
		if (wall.type === 'door' && !wall.open && stopAtDoor) return path.slice(0, i + 1);
		return path.slice(0, i);
	}
	return path;
}

function hasPermissiveLOS(startX, startY, endX, endY) {
	const end = {x: endX, y: endY};
	const path = line({x: startX, y: startY}, end);
	for (let i = 1; i < path.length - 1; i++) {
		const wall = walls.find(w => w.x === path[i].x && w.y === path[i].y);
		if (wallBlocksLOS(wall)) return false;
	}
	return true;
}

// Returns all unique living entities whose position appears in the given tile list.
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