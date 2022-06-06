const { PCA } = require('ml-pca');

class TagProPCAModel {
	constructor(model) {
		this.componentCount = 32;

		if(model && typeof model.pca !== 'undefined') {
			this.load(model);
			return this;
		}

		if(model) {
			this.dataset = model;
			this.pca = new PCA(this.dataset.data);

			this._update();
		}
	}

	getComponentsFromMap(map) {
		return this.pca.predict([map]).to1DArray();
	}

	getMapFromComponents(components) {
		return this.pca.invert([padArray(components, this.componentCount, 0)]).to1DArray();
	}

	projectMap(map) {
		return this.pca.invert([this.pca.predict([map]).to1DArray()]).to1DArray();
	}

	load(modelRaw) {
		const model = typeof modelRaw === 'string' ? JSON.parse(modelRaw) : modelRaw;
		this.dataset = model.dataset;
		this.pca = PCA.load(model.pca);

		this._update();

		return this;
	}

	_update() {
		this.componentCount = this.pca.getEigenvalues().length;
	}

	toJSON() {
		return JSON.stringify({
			dataset: this.dataset,
			pca: this.pca.toJSON()
		});
	}
}

function padArray(array, length, fill) {
	return length > array.length ? array.concat(Array(length - array.length).fill(fill)) : array;
}

module.exports = TagProPCAModel;