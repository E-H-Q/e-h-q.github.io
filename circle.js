function circle(xc, yc, r) {
	width = height = size;
	array = new Uint8Array(width * height);

	if (r < 1) return;

	var x = r, y = 0,  // for Bresenham / mid-point circle
		cd = 0,
		xoff = 0,
		yoff = r,
		b = -r,
		p0, p1, w0, w1;

	while (xoff <= yoff) {
		p0 = xc - xoff;
		p1 = xc - yoff;
		w0 = xoff + xoff;
		w1 = yoff + yoff;

		hl(p0, yc - yoff, yc + yoff, w0);  // fill a "line"
		hl(p1, yc - xoff, yc + xoff, w1);

		if ((b += xoff+++xoff) >= 0) {
			b -= --yoff + yoff;
		}
	}

	// for fill
	function hl(x, y1, y2, w) {
		w++;
		var xw = 0;
		while (w--) {
		xw = x + w;
		setPixel(xw, y1);
		setPixel(xw, y2);
		}
	}

	function setPixel(x, y) {
		if (x < width && y < height && x >= 0 && y >= 0)
			array[y * width + x] = 1;
	}
}

function convert() {
	pts = [];
	var conv = Array.from(array); // converts uint8Array into a normal array
	while(conv.length) {
		pts.push(conv.splice(0, size));
	}
	for (i = 0; i < walls.length; i++) {
		pts[walls[i].x][walls[i].y] = 0;
	}

	array = new Uint8Array(width * height);
}
