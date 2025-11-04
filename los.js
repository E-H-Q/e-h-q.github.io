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

// Permissive LOS: checks rays to target tile and its adjacent tiles
function hasPermissiveLOS(startX, startY, endX, endY) {
	// Get all tiles to check (target + adjacent tiles)
	const tilesToCheck = [{x: endX, y: endY}];
	
	// Add adjacent tiles (including diagonals)
	if (typeof helper !== 'undefined' && helper.getAdjacentTiles) {
		const adjacentTiles = helper.getAdjacentTiles(endX, endY, true);
		tilesToCheck.push(...adjacentTiles);
	}
	
	const start = {x: startX, y: startY};
	
	// Try each tile
	for (let targetTile of tilesToCheck) {
		const end = {x: targetTile.x, y: targetTile.y};
		const path = line(start, end);
		
		// Check if this ray is clear (exclude start and end points from wall check)
		let blocked = false;
		for (let i = 1; i < path.length - 1; i++) {
			const point = path[i];
			if (walls.find(w => w.x === point.x && w.y === point.y)) {
				blocked = true;
				break;
			}
		}
		
		// If any ray succeeds, we have LOS
		if (!blocked) {
			return true;
		}
	}
	
	return false;
}

// Calculate cone-shaped area for shotgun (3 lines: center + 1 on each side)
// Stops at walls and respects attack range, uses permissive LOS
// Spread scales with distance (max 1 tile on each side)
function calculateCone(path, startX, startY, endX, endY, maxRange) {
	const coneTiles = new Set();
	
	// Process main line (already has walls/range applied from calc.los)
	// Skip first point (player position) ONLY if path has more than 1 point
	const startIdx = path.length > 1 ? 1 : 0;
	for (let i = startIdx; i < path.length; i++) {
		coneTiles.add(`${path[i].x},${path[i].y}`);
	}
	
	// Calculate perpendicular direction
	const dx = endX - startX;
	const dy = endY - startY;
	const distance = Math.sqrt(dx * dx + dy * dy);
	
	// Only add spread if distance is at least 2
	if (distance < 2) {
		return Array.from(coneTiles).map(s => {
			const [x, y] = s.split(',').map(Number);
			return {x, y};
		});
	}
	
	const length = distance;
	
	// Perpendicular unit vector (rotated 90 degrees)
	const perpX = -dy / length;
	const perpY = dx / length;
	
	// Scale spread: start at 0, reach 1 at distance 2+
	const spread = Math.min(1, (distance - 1) / 1);
	
	// Calculate two parallel lines (spread tile offset on each side)
	const leftEndX = Math.round(endX + perpX * spread);
	const leftEndY = Math.round(endY + perpY * spread);
	const rightEndX = Math.round(endX - perpX * spread);
	const rightEndY = Math.round(endY - perpY * spread);
	
	let leftPath = [];
	let rightPath = [];
	
	// Draw left line with permissive LOS check
	if (hasPermissiveLOS(startX, startY, leftEndX, leftEndY)) {
		const leftLook = {
			start: { x: startX, y: startY },
			end: { x: leftEndX, y: leftEndY }
		};
		leftPath = calc.los(leftLook);
		
		// Apply range limit and skip first point
		if (leftPath.length > maxRange + 1) {
			leftPath = leftPath.slice(1, maxRange + 1);
		} else if (leftPath.length > 1) {
			leftPath = leftPath.slice(1);
		}
		
		for (let point of leftPath) {
			coneTiles.add(`${point.x},${point.y}`);
		}
	}
	
	// Draw right line with permissive LOS check
	if (hasPermissiveLOS(startX, startY, rightEndX, rightEndY)) {
		const rightLook = {
			start: { x: startX, y: startY },
			end: { x: rightEndX, y: rightEndY }
		};
		rightPath = calc.los(rightLook);
		
		// Apply range limit and skip first point
		if (rightPath.length > maxRange + 1) {
			rightPath = rightPath.slice(1, maxRange + 1);
		} else if (rightPath.length > 1) {
			rightPath = rightPath.slice(1);
		}
		
		for (let point of rightPath) {
			coneTiles.add(`${point.x},${point.y}`);
		}
	}
	
	// Fill gaps between center and side lines
	const centerPath = path.slice(startIdx);
	const maxLen = Math.max(centerPath.length, leftPath.length, rightPath.length);
	
	for (let i = 0; i < maxLen; i++) {
		// Get points at this step (or last point if path is shorter)
		const centerPt = centerPath[Math.min(i, centerPath.length - 1)];
		const leftPt = leftPath[Math.min(i, leftPath.length - 1)];
		const rightPt = rightPath[Math.min(i, rightPath.length - 1)];
		
		if (leftPt && centerPt) {
			// Fill between left and center
			const fillLine = line({x: leftPt.x, y: leftPt.y}, {x: centerPt.x, y: centerPt.y});
			for (let pt of fillLine) {
				coneTiles.add(`${pt.x},${pt.y}`);
			}
		}
		
		if (rightPt && centerPt) {
			// Fill between right and center
			const fillLine = line({x: rightPt.x, y: rightPt.y}, {x: centerPt.x, y: centerPt.y});
			for (let pt of fillLine) {
				coneTiles.add(`${pt.x},${pt.y}`);
			}
		}
	}
	
	// Convert back to coordinate array
	return Array.from(coneTiles).map(s => {
		const [x, y] = s.split(',').map(Number);
		return {x, y};
	});
}

// Get all entities in cone area
function getEntitiesInCone(path, startX, startY, endX, endY, maxRange) {
	const coneTiles = calculateCone(path, startX, startY, endX, endY, maxRange);
	const entitiesHit = [];
	
	for (let tile of coneTiles) {
		for (let entity of entities) {
			if (entity.x === tile.x && entity.y === tile.y && entity.hp > 0) {
				if (!entitiesHit.includes(entity)) {
					entitiesHit.push(entity);
				}
			}
		}
	}
	
	return entitiesHit;
}
