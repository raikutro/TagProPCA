// Creates vector dataspaces using options: CTF/NF, Element Types (extended, minimal, etc...), and Source (Rotation, Top Maps + Rotation, F-M)

const fs = require('fs');
const util = require('util');
const path = require('path');
const TPMI = require('tpmi-toolkit');

const writeFile = util.promisify(fs.writeFile);
const readdir = util.promisify(fs.readdir);

const SETTINGS = {
	SPACES_FOLDER: path.join(__dirname, '../data/spaces'),
	MAPS_FOLDER: path.join(__dirname, '../data/maps'),
	RANDOM_SEED: "splonktime"
};

const seed = cyrb128(SETTINGS.RANDOM_SEED);
const random = sfc32(...seed);

const ELEMENT_PACKERS = {
	OUTER_WALL: new Packer({
		// 50 Wall Nodes: 50x(x, y)
		DIMENSIONS: 50 * 2,
		PACKER: (self, vectorMap) => {
			
		}
	}),
	ISLANDS: new Packer({
		// 8, 16 Island Node + 1 Exist Param per island: 8x(exists, 16x(x, y))
		DIMENSIONS: 8 * ((16 * 2) + 1),
		PACKER: (self, vectorMap) => {
			
		}
	}),
	BOOSTS: new Packer({
		// 8 Boost Nodes + 1 Team Param + 1 Exist Param: 8x(exists, x, y, team)
		DIMENSIONS: 8 * (2 + 1 + 1),
		PACKER: (self, vectorMap) => {
			
		}
	}),
	BOMBS: new Packer({
		// 8 Bomb Nodes + 1 Exist Param: 8x(exists, x, y)
		DIMENSIONS: 8 * (2 + 1),
		PACKER: (self, vectorMap) => {
			
		}
	}),
	SPIKES: new Packer({
		// 16 Spike Nodes + 1 Exist Param: 16x(exists, x, y)
		DIMENSIONS: 16 * (2 + 1),
		PACKER: (self, vectorMap) => {
			
		}
	}),
	PORTALS: new Packer({
		// 8 Portal Nodes + 1 Exist Param: 8x(exists, x, y)
		DIMENSIONS: 8 * (2 + 1),
		PACKER: (self, vectorMap) => {
			
		}
	}),
	GATES: new Packer({
		// 8, 16 Gate Nodes + 1 Exist Param per island: 8x(exists, 16x(x, y))
		DIMENSIONS: 8 * ((16 * 2) + 1),
		PACKER: (self, vectorMap) => {
			
		}
	}),
	FLAGS: new Packer({
		// 1 Flag Node + Color
		DIMENSIONS: 2 + 1,
		PACKER: (self, vectorMap) => {
			
		}
	}),
	POWERUPS: new Packer({
		// 3 Powerup Nodes + Exists
		DIMENSIONS: 3 * (2 + 1),
		PACKER: (self, vectorMap) => {
			
		}
	})
};

(async () => {
	const input = process.argv.slice(2);

	const { gameMode, elementsTemplate, sources } = {
		gameMode: input[0],
		elementsTemplate: input[1],
		sources: input[2].split(',').filter(a => a.trim().length)
	};

	try { fs.unlinkSync(`${SETTINGS.SPACES_FOLDER}/${spaceName}.json`); } catch(e) { console.log(e) }
	const fileStream = fs.createWriteStream(`${SETTINGS.SPACES_FOLDER}/${spaceName}.json`, {flags: 'a'});

	fileStream.write(`{
		"meta": {
			"dimensionRanges": 
		},
		"data": [
	`);

	let mapFilePaths = [];
	
	for (let i = 0; i < sources.length; i++) {
		const mapsPath = `${SETTINGS.MAPS_FOLDER}/${sources[i]}`;
		const fileNames = await readdir(mapsPath);
		mapFilePaths = mapFilePaths.concat(fileNames.map(f => `${mapsPath}/${f}`));
	}


})();

function adjustPointsToTargetAmount(points, targetPoints) {
	points = points.map(p => TPMI.Flatten.point(p));

	if(points.length > targetPoints) {
		let pointAreas = [];
		let amountOfPointsToRemove = points.length - targetPoints;
		for (let i = 0; i < points.length; i++) {
			pointAreas.push({idx: i, area: triangleArea(points.at(i-1), points[i], points.at(i+1))});
		}

		pointAreas = pointAreas.sort((a, b) => a.area - b.area);

		for (let i = amountOfPointsToRemove - 1; i >= 0; i--) {
			points.splice(pointAreas[i].idx, 1);
		}
	} else if(points.length < targetPoints) {

	}

	return points;
}

function triangleArea(p1, p2, p3) {
	return ((p1.x * (p2.y - p3.y)) + (p2.x * (p3.y - p1.y)) + (p3.x * (p1.y - p2.y))) / 2;
}

class Packer {
	constructor({DIMENSIONS, PACKER}) {
		this.DIMENSIONS = dimensions;
		this.PACKER = (vMap) => PACKER(this, vMap);
	}
}

function cyrb128(str) {
	let h1 = 1779033703, h2 = 3144134277,
		h3 = 1013904242, h4 = 2773480762;
	for (let i = 0, k; i < str.length; i++) {
		k = str.charCodeAt(i);
		h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
		h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
		h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
		h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
	}
	h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
	h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
	h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
	h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
	return [(h1^h2^h3^h4)>>>0, (h2^h1)>>>0, (h3^h1)>>>0, (h4^h1)>>>0];
}

function sfc32(a, b, c, d) {
	return function() {
		a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
		let t = (a + b) | 0;
		a = b ^ b >>> 9;
		b = c + (c << 3) | 0;
		c = (c << 21 | c >>> 11);
		d = d + 1 | 0;
		t = t + d | 0;
		c = c + t | 0;
		return (t >>> 0) / 4294967296;
	}
}