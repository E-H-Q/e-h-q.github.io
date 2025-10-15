// CIRCLE.JS: BRESENHAM CIRCLE ALGORITHM FOR MOVEMENT RANGE

function circle(xc, yc, r) {
	const width = size;
	const height = size;
	array = new Uint8Array(width * height);

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
			setPixel(xw, y1);
			setPixel(xw, y2);
		}
	}

	function setPixel(x, y) {
		if (x >= 0 && x < width && y >= 0 && y < height) {
			array[y * width + x] = 1;
		}
	}
}

function convert() {
	pts = [];
	const conv = Array.from(array);
	while(conv.length) {
		pts.push(conv.splice(0, size));
	}
	
	for (let i = 0; i < walls.length; i++) {
		if (pts[walls[i].x] && pts[walls[i].x][walls[i].y] !== undefined) {
			pts[walls[i].x][walls[i].y] = 0;
		}
	}

	array = new Uint8Array(size * size);
}
