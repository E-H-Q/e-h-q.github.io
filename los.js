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
	// Get all tiles to check (target + adjacent tiles that aren't walls)
	const tilesToCheck = [{x: endX, y: endY}];
	
	// Add adjacent tiles (including diagonals) that aren't walls
	if (typeof helper !== 'undefined' && helper.getAdjacentTiles) {
		const adjacentTiles = helper.getAdjacentTiles(endX, endY, true);
		for (let tile of adjacentTiles) {
			// Only add adjacent tiles if they're not walls
			if (!walls.find(w => w.x === tile.x && w.y === tile.y)) {
				tilesToCheck.push(tile);
			}
		}
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

// Calculate cone-shaped area for shotgun (multiple lines based on spread)
// Stops at walls and respects attack range, uses permissive LOS
// Spread scales with distance
// spread = total width (e.g., 3 = center + 1 left + 1 right, 5 = center + 2 left + 2 right)
function calculateCone(path, startX, startY, endX, endY, maxRange, spread) {
	spread = spread || 3; // default spread
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
	if (distance < 2 || spread <= 1) {
		return Array.from(coneTiles).map(s => {
			const [x, y] = s.split(',').map(Number);
			return {x, y};
		});
	}
	
	const length = distance;
	
	// Perpendicular unit vector (rotated 90 degrees)
	const perpX = -dy / length;
	const perpY = dx / length;
	
	// Calculate how many tiles on each side (spread - 1) / 2
	const tilesPerSide = Math.floor((spread - 1) / 2);
	
	// Store all side paths for gap filling
	const allSidePaths = [];
	
	// Generate lines for each offset from center
	for (let offset = 1; offset <= tilesPerSide; offset++) {
		// Scale offset with distance to create gradual spread
		const scaledOffset = Math.min(offset, (distance - 1) * (offset / tilesPerSide));
		
		// Left side
		const leftEndX = Math.round(endX + perpX * scaledOffset);
		const leftEndY = Math.round(endY + perpY * scaledOffset);
		
		if (hasPermissiveLOS(startX, startY, leftEndX, leftEndY)) {
			const leftLook = {
				start: { x: startX, y: startY },
				end: { x: leftEndX, y: leftEndY }
			};
			let leftPath = calc.los(leftLook);
			
			// Apply range limit and skip first point
			if (leftPath.length > maxRange + 1) {
				leftPath = leftPath.slice(1, maxRange + 1);
			} else if (leftPath.length > 1) {
				leftPath = leftPath.slice(1);
			}
			
			allSidePaths.push(leftPath);
			
			for (let point of leftPath) {
				coneTiles.add(`${point.x},${point.y}`);
			}
		}
		
		// Right side
		const rightEndX = Math.round(endX - perpX * scaledOffset);
		const rightEndY = Math.round(endY - perpY * scaledOffset);
		
		if (hasPermissiveLOS(startX, startY, rightEndX, rightEndY)) {
			const rightLook = {
				start: { x: startX, y: startY },
				end: { x: rightEndX, y: rightEndY }
			};
			let rightPath = calc.los(rightLook);
			
			// Apply range limit and skip first point
			if (rightPath.length > maxRange + 1) {
				rightPath = rightPath.slice(1, maxRange + 1);
			} else if (rightPath.length > 1) {
				rightPath = rightPath.slice(1);
			}
			
			allSidePaths.push(rightPath);
			
			for (let point of rightPath) {
				coneTiles.add(`${point.x},${point.y}`);
			}
		}
	}
	
	// Fill gaps between all paths
	const centerPath = path.slice(startIdx);
	const allPaths = [centerPath, ...allSidePaths];
	
	// Get max length across all paths
	let maxLen = 0;
	for (let p of allPaths) {
		if (p.length > maxLen) maxLen = p.length;
	}
	
	// Fill gaps between adjacent paths at each step
	for (let i = 0; i < maxLen; i++) {
		for (let j = 0; j < allPaths.length - 1; j++) {
			const path1 = allPaths[j];
			const path2 = allPaths[j + 1];
			
			const pt1 = path1[Math.min(i, path1.length - 1)];
			const pt2 = path2[Math.min(i, path2.length - 1)];
			
			if (pt1 && pt2) {
				const fillLine = line({x: pt1.x, y: pt1.y}, {x: pt2.x, y: pt2.y});
				for (let pt of fillLine) {
					coneTiles.add(`${pt.x},${pt.y}`);
				}
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
function getEntitiesInCone(path, startX, startY, endX, endY, maxRange, spread) {
	const coneTiles = calculateCone(path, startX, startY, endX, endY, maxRange, spread);
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

// Get all entities in pierce path
function getEntitiesInPath(path) {
	const entitiesHit = [];
	
	for (let tile of path) {
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

// Calculate area (circle) around a point
function calculateArea(centerX, centerY, radius) {
	const areaTiles = [];
	
	// Use the circle algorithm to generate tiles within radius
	circle(centerY, centerX, radius);
	convert();
	
	if (!pts) return areaTiles;
	
	// Collect all tiles marked as 1 within the circle
	for (let x = Math.max(0, centerX - radius - 1); x <= Math.min(size - 1, centerX + radius + 1); x++) {
		for (let y = Math.max(0, centerY - radius - 1); y <= Math.min(size - 1, centerY + radius + 1); y++) {
			if (pts[x] && pts[x][y] === 1) {
				areaTiles.push({x: x, y: y});
			}
		}
	}
	
	return areaTiles;
}

// Get all entities in area
function getEntitiesInArea(areaTiles) {
	const entitiesHit = [];
	
	for (let tile of areaTiles) {
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
