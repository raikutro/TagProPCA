<script>
	export let dimensionRanges;
	export let map;

	let outerWallPath = "";

	if(map && map.length > 0) {
		let currentRangeIndex = 0;
		for (let i = 0; i < dimensionRanges.length; i++) {
			const [type, range] = dimensionRanges[i];

			if(type === "OUTER_WALL") {
				let path = [`M ${map[currentRangeIndex]} ${map[currentRangeIndex+1]}`];
				for (let i = 2; i < range; i += 2) {
					const idx = currentRangeIndex + i;
					const wallNode = {x: map[idx], y: map[idx+1]};
					path.push(`L ${wallNode.x} ${wallNode.y}`);
				}

				path.push(`L ${map[currentRangeIndex]} ${map[currentRangeIndex+1]}`);

				outerWallPath = path.join(' ');
			}
		}
	}
</script>

<div>
	<svg class="map-display d-block mx-auto" viewBox="-0.1 -0.1 1.2 1.2">
		<g><path class="outer-wall" d={outerWallPath} /></g>
	</svg>
</div>

<style>
	.outer-wall {
		stroke: black;
		fill: transparent;
		stroke-width: 0.01;
	}
</style>