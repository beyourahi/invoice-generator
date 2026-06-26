<!--
	Decorative animated Copilot glyph (2×2 boxes) for the mobile FAB and desktop launcher.
	Purely CSS-animated; aria-hidden as it carries no meaning. (AiWelcome renders the 4-bar
	`launcher-*-row` variant inline as raw markup, not via this component.)
-->
<script lang="ts">
	let { class: className = "" }: { class?: string } = $props();
</script>

<div class={`launcher-icon launcher-idle ${className}`} aria-hidden="true">
	<div class="launcher-box-a"></div>
	<div class="launcher-box-b"></div>
	<div class="launcher-box-c"></div>
	<div class="launcher-box-d"></div>
</div>
