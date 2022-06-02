// Creates vector dataspaces using options: CTF/NF, Element Types (extended, minimal, etc...), and Source (Rotation, Top Maps + Rotation, F-M)

const fs = require('fs');
const util = require('util');
const path = require('path');
const TPMI = require('../tpmi-toolkit');
const cliProgress = require('cli-progress');

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
		dimensions: 50 * 2,
		pack: (self, vectorMap) => {
			let outerWallFlatVector = vectorMap.elements.outerWall.toPoints().map(p => [p.x / vectorMap.width, p.y / vectorMap.height]).flat();
			outerWallFlatVector = adjustPointsToTargetAmount(outerWallFlatVector, self.dimensions);
			return outerWallFlatVector;
		}
	}),
	ISLANDS: new Packer({
		// 8, 16 Island Node + 1 Exist Param per island: 8x(exists, 16x(x, y))
		dimensions: 8 * ((16 * 2) + 1),
		pack: (self, vectorMap) => {
			
		}
	}),
	BOOSTS: new Packer({
		// 8 Boost Nodes + 1 Team Param + 1 Exist Param: 8x(exists, x, y, team)
		dimensions: 8 * (2 + 1 + 1),
		pack: (self, vectorMap) => {
			
		}
	}),
	BOMBS: new Packer({
		// 8 Bomb Nodes + 1 Exist Param: 8x(exists, x, y)
		dimensions: 8 * (2 + 1),
		pack: (self, vectorMap) => {
			
		}
	}),
	SPIKES: new Packer({
		// 16 Spike Nodes + 1 Exist Param: 16x(exists, x, y)
		dimensions: 16 * (2 + 1),
		pack: (self, vectorMap) => {
			
		}
	}),
	PORTALS: new Packer({
		// 8 Portal Nodes + 1 Exist Param: 8x(exists, x, y)
		dimensions: 8 * (2 + 1),
		pack: (self, vectorMap) => {
			
		}
	}),
	GATES: new Packer({
		// 8, 16 Gate Nodes + 1 Exist Param per island: 8x(exists, 16x(x, y))
		dimensions: 8 * ((16 * 2) + 1),
		pack: (self, vectorMap) => {
			
		}
	}),
	FLAGS: new Packer({
		// 1 Flag Node + Color
		dimensions: 2 + 1,
		pack: (self, vectorMap) => {
			
		}
	}),
	POWERUPS: new Packer({
		// 3 Powerup Nodes + Exists
		dimensions: 3 * (2 + 1),
		pack: (self, vectorMap) => {
			
		}
	})
};

const ELEMENT_CURATIONS = {
	WALLS: ["OUTER_WALL"]
};

(async () => {
	const input = process.argv.slice(2);

	const { gameMode, elementsTemplate, sources } = {
		gameMode: (input[0] || "CTF").toUpperCase(),
		elementsTemplate: (input[1] || "WALLS").toUpperCase(),
		sources: (input[2] || "TINY").toUpperCase().split(',').filter(a => a.trim().length)
	};

	const spaceName = `${gameMode}-${elementsTemplate}-${sources.join("-")}`;

	try { fs.unlinkSync(`${SETTINGS.SPACES_FOLDER}/${spaceName}.json`); } catch(e) { console.log(e) }
	const fileStream = fs.createWriteStream(`${SETTINGS.SPACES_FOLDER}/${spaceName}.json`, {flags: 'a'});

	let mapFilePaths = [];
	
	logger("Reading map sources...");
	for (let i = 0; i < sources.length; i++) {
		const mapsPath = `${SETTINGS.MAPS_FOLDER}/${sources[i].toLowerCase()}`;
		const fileNames = await readdir(mapsPath);
		mapFilePaths = mapFilePaths.concat(fileNames.map(f => `${mapsPath}/${f}`));
	}

	logger("Generating map vectors...");

	const progressBar = new cliProgress.SingleBar();
	const curationElements = ELEMENT_CURATIONS[elementsTemplate];
	const totalDimensions = curationElements.reduce((acc, val) => acc + ELEMENT_PACKERS[val].dimensions, 0);
	const dimensionRanges = curationElements.reduce((acc, val) => ([
		...acc, [val, ELEMENT_PACKERS[val].dimensions]
	]), []);

	fileStream.write(`{
		"meta": {
			"dimensionRanges": ${JSON.stringify(dimensionRanges)}
		},
		"data": [
	`);

	progressBar.start(mapFilePaths.length, 1);
	for (let i = 0; i < mapFilePaths.length; i++) {
		const tileMap = TPMI.MapUtilities.fileToTileMap(mapFilePaths[i]);
		const vectorMap = TPMI.Vectorizer.createVectorMapFromTileMap(tileMap);
		const flags = TPMI.VectorUtilities.getFlagPair(vectorMap.flags);

		if(flags[0] === null) continue;
		if(flags[0].team === TPMI.CONSTANTS.TEAMS.NONE && gameMode !== "NF") continue;
		if(flags[0].team === TPMI.CONSTANTS.TEAMS.RED && gameMode !== "CTF") continue;

		let mapVector = [];

		for (let i = 0; i < curationElements.length; i++) {
			const packer = ELEMENT_PACKERS[curationElements[i]];

			mapVector = mapVector.concat(packer.pack(vectorMap));
		}

		let dataString = JSON.stringify(mapVector);
		fileStream.write(`${dataString}${i !== mapFilePaths.length - 1 ? "," : ""}\n`);

		progressBar.increment();

		// Quick wait
		await new Promise(res => setTimeout(res, 0));
	}

	progressBar.stop();

	fileStream.end("]\n}");

	logger(`Finished generating dataspace ${spaceName}.json`);
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
		let pointDistances = [];
		let amountOfPointsToAdd = targetPoints - points.length;
		for (let i = 0; i < points.length; i++) {
			pointDistances.push({idx: i, dist: TPMI.Utilities.distanceBetween(points.at(i), points.at(i+1))});
		}

		pointDistances = pointDistances.sort((a, b) => b.dist - a.dist);

		for (let i = amountOfPointsToAdd - 1; i >= 0; i--) {
			points.splice(pointDistances[i].idx, 0, midpoint(points.at(i), points.at(i+1)));
		}
	}

	return points;
}

function triangleArea(p1, p2, p3) {
	return ((p1.x * (p2.y - p3.y)) + (p2.x * (p3.y - p1.y)) + (p3.x * (p1.y - p2.y))) / 2;
}

function midpoint(p1, p2) {
	return TPMI.Flatten.point((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
}

function logger(...args) {
	console.log(`[${new Date().toLocaleTimeString()}]`, ...args);
}

class Packer {
	constructor({dimensions, pack}) {
		this.dimensions = dimensions;
		this.pack = (vMap) => pack(this, vMap);
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