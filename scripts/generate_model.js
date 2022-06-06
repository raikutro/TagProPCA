// Generates PCA Models with a vector dataspace as input
const fs = require('fs');
const TagProPCAModel = require('../src/TagProPCAModel');

const [spaceName] = process.argv.slice(2);
const dataset = require(`../data/spaces/${spaceName}.json`);

const tagproPCAModel = new TagProPCAModel(dataset);
console.log("Writing...");
fs.writeFile(__dirname + `/../data/models/${spaceName}.json`, tagproPCAModel.toJSON(), err => {
	if(err) console.error(err);

	console.log("Generated.");
});