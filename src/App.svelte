<script>
	import { onMount } from 'svelte';
	import MapDisplay from './MapDisplay.svelte';
	import * as Comlink from 'comlink';
	import TagProPCAModelWorker from 'web-worker:./TagProPCAModelWorker.js';

	const rawPCAWorker = new TagProPCAModelWorker();
	const TagProPCAModel = Comlink.wrap(rawPCAWorker);

	let modelList = null;

	let componentValues = [];

	let currentModel = null;
	let componentCount = 0;
	let selectedComponents = 0;
	let selectedModel = null;
	let modelDataset = null;

	$: displayedMap = currentModel ? currentModel.getMapFromComponents(componentValues.slice(0, selectedComponents)) : [];

	async function getModels() {
		let json = await fetch('/model_list').then(r => r.json());
		return json.models;
	}

	onMount(async () => {
		modelList = await getModels();
		selectedModel = modelList[0];
	});

	function getModelData(modelName) {
		return fetch('/models/' + modelName).then(r => r.json());
	}

	async function loadModel() {
		const modelData = await getModelData(selectedModel);
		currentModel = TagProPCAModel;
		await currentModel.load(modelData);

		modelDataset = await currentModel.dataset;
		componentCount = await currentModel.componentCount;
		selectedComponents = Math.floor(componentCount / 2);
		await displaySampleMap(0);

		console.log(modelDataset, componentValues);
	}

	async function displaySampleMap(idx) {
		componentValues = await currentModel.getComponentsFromMap(modelDataset.data[idx]);
	}

	function mapSelectHandler(event) {
		displaySampleMap(Number(event.target.value));
	}

	function wait(ms) {
		return new Promise(res => setTimeout(res, ms));
	}

	function padArray(array, length, fill) {
		return length > array.length ? array.concat(Array(length - array.length).fill(fill)) : array;
	}
</script>

<div class="container">
	<h1 class="text-center">Principle Component Analysis of TagPro Maps</h1>
	<hr>
	<div class="input-group mb-3">
		<span class="input-group-text" id="basic-addon1">PCA Model</span>
		<select class="form-select" aria-label="models" bind:value={selectedModel}>
			<option selected disabled>
				{#if modelList}
					Select a Model
				{:else}
					Loading Models...
				{/if}
			</option>
			{#if modelList}
				{#each modelList as model}
					<option value={model}>{model.replace('.json', '').replace(/-/g, ' / ')}</option>
				{/each}
			{/if}
		</select>
		<button class="btn btn-primary" type="button" on:click={loadModel} disabled={!modelList}>Load Model</button>
	</div>
	<hr>
	{#if currentModel && modelDataset}
		<div class="row">
			<div class="col">
				{#await displayedMap}
					<MapDisplay dimensionRanges={modelDataset.meta.dimensionRanges} map={[]} />
				{:then map}
					<MapDisplay dimensionRanges={modelDataset.meta.dimensionRanges} map={map} />
				{/await}
			</div>
			<div class="col">
				<div class="input-group mb-3">
					<label for="maxDimensions" class="form-label" id="maxDimensionsLabel">Dimensions: {selectedComponents}</label>
					<input type="range" class="form-range" bind:value={selectedComponents} min="1" max={componentCount} step="1">
				</div>
				<div class="input-group mb-3">
					<span class="input-group-text" id="basic-addon1">Sample Map</span>
					<select class="form-select" aria-label="maps" on:input={mapSelectHandler} on:change={mapSelectHandler}>
						<option selected disabled>Select a Map</option>
						{#each modelDataset.data as map, i}
							<option value={i} selected={i === 0}>Map #{i+1}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>
		<hr>
		<div class="row">
			<div class="col">
				<div class="slider-container">
					
				</div>
			</div>
		</div>
	{/if}
</div>