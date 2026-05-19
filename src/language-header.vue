<script setup lang="ts">
defineProps<{
	language: {
		text: string;
		value: string;
		progress: number;
		edited?: boolean;
	};
	danger?: boolean;
	disabled?: boolean;
}>();
</script>

<template>
	<div
		class="language-header"
		:class="{ danger, disabled }"
	>
		<span
			class="dot"
			:class="{ show: language.edited }"
		/>
		<span class="display-value">{{ language.text }}</span>
		<span class="code">{{ language.value }}</span>
		<v-progress-linear
			v-tooltip="`${language.progress}%`"
			:value="language.progress"
			rounded
			colorful
			class="progress"
		/>
	</div>
</template>

<style scoped>
.language-header {
	display: flex;
	gap: 0.5rem;
	align-items: center;
	inline-size: 100%;
	min-block-size: var(--theme--form--field--input--height);
	padding: var(--theme--form--field--input--padding);
	color: var(--theme--primary);
	background-color: var(--theme--primary-background);
	border-radius: var(--theme--border-radius);
}

.language-header.danger {
	color: var(--theme--danger);
	background-color: var(--theme--danger-background);
}

.language-header.disabled {
	color: var(--theme--form--field--input--foreground-subdued);
	background-color: var(--theme--form--field--input--background-subdued);
}

.dot {
	inline-size: 0.4375rem;
	flex-shrink: 0;
}

.dot.show::before {
	display: block;
	inline-size: 0.25rem;
	block-size: 0.25rem;
	background-color: var(--theme--form--field--input--foreground-subdued);
	border-radius: 2px;
	content: '';
}

.display-value {
	flex-grow: 1;
	font-weight: 600;
}

.code {
	color: var(--theme--foreground-subdued);
	font-size: 0.75rem;
}

.progress {
	flex: 0 0 5rem;
	max-inline-size: 5.625rem;
}
</style>
