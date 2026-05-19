<script setup lang="ts">
import { isEmpty } from 'lodash-es';
import { computed, nextTick, ref, watch } from 'vue';
import { useStores } from '@directus/extensions-sdk';
import LanguageHeader from './language-header.vue';
import type { RelationM2M } from './composables/use-relation-m2m';
import type { DisplayItem } from './composables/use-relation-multiple';

const props = defineProps<{
	lang: string;
	language: {
		text: string;
		value: string;
		direction?: string;
		progress: number;
		edited?: boolean;
	};
	disabled?: boolean;
	nonEditable?: boolean;
	autofocus?: boolean;
	relationInfo?: RelationM2M;
	getItemWithLang: (items: Record<string, unknown>[], lang: string | undefined) => DisplayItem | undefined;
	loading?: boolean;
	displayItems: DisplayItem[];
	fetchedItems: Record<string, unknown>[];
	getItemEdits: (item: DisplayItem) => DisplayItem;
	isLocalItem: (item: DisplayItem) => boolean;
	remove: (...items: DisplayItem[]) => void;
	updateValue: (item: DisplayItem | undefined, lang: string | undefined) => void;
}>();

const { useFieldsStore } = useStores();
const fieldsStore = useFieldsStore();

const item = computed(() => {
	const found = props.getItemWithLang(props.displayItems, props.lang);
	if (found === undefined) return undefined;

	const itemEdits = props.getItemEdits(found);

	if (isEmpty(itemEdits) && found.$type === 'deleted') return found;

	return itemEdits;
});

const itemInitial = computed(() => props.getItemWithLang(props.fetchedItems, props.lang));

const itemPrimaryKey = computed(
	() => props.relationInfo && itemInitial.value?.[props.relationInfo.junctionPrimaryKeyField.field],
);

const fields = computed(() => {
	if (!props.relationInfo) return [];

	return fieldsStore
		.getFieldsForCollection(props.relationInfo.junctionCollection.collection)
		.filter((field) => field.type !== 'alias' && field.meta?.hidden !== true);
});

const saveAllowed = computed(() => !props.disabled && !props.nonEditable);
const deleteAllowed = computed(() => !props.disabled && !props.nonEditable);

const formReady = ref(true);

watch(fields, async () => {
	formReady.value = false;
	await nextTick();
	formReady.value = true;
});

const activatorDisabled = computed(() => {
	return (
		props.disabled ||
		(!item.value && !saveAllowed.value) ||
		(item.value && !deleteAllowed.value && !props.isLocalItem(item.value))
	);
});

const pressing = ref(false);
const pressed = ref(false);
const transition = ref(false);

const iconName = computed(() =>
	pressed.value || pressing.value ? 'check_box' : 'check_box_outline_blank',
);

watch(item, (newItem, oldItem) => {
	const isInitialItem = isEmpty(newItem) && isEmpty(oldItem);
	transition.value = isInitialItem ? false : newItem !== oldItem;
});

function onEnableTranslation() {
	if (!isEmpty(item.value) || !isEmpty(itemInitial.value)) return;
	props.updateValue(undefined, props.lang);
}

function onMousedown() {
	pressing.value = true;
	document.addEventListener('mouseup', onMouseupOutside);
}

function onMouseupOutside() {
	pressing.value = false;
	document.removeEventListener('mouseup', onMouseupOutside);
}

function onMouseup() {
	pressed.value = true;
}

function onTransitionEnd() {
	pressed.value = false;
}

function onToggleDelete() {
	if (!isEmpty(item.value)) {
		props.remove(item.value);
		return;
	}

	if (isEmpty(itemInitial.value)) return;

	props.remove(itemInitial.value as DisplayItem);
}
</script>

<template>
	<div class="translation-column">
		<div class="header-row">
			<LanguageHeader
				:language="language"
				:danger="item?.$type === 'deleted'"
				:disabled="disabled"
			/>

			<div class="header-actions">
				<span
					v-if="loading"
					class="activator-loading-placeholder"
				/>

				<Transition
					v-else
					:name="transition ? (item ? 'rotate-in' : 'rotate-out') : undefined"
					:duration="transition ? undefined : 0"
					mode="out-in"
					@after-leave="onTransitionEnd"
					@leave-cancelled="onTransitionEnd"
				>
					<v-icon
						v-if="item || nonEditable"
						name="translate"
						:disabled="activatorDisabled"
					/>

					<v-icon
						v-else
						v-tooltip="!activatorDisabled ? $t('enable') : null"
						:class="{ disabled: activatorDisabled }"
						:name="iconName"
						:disabled="activatorDisabled"
						clickable
						@click.stop="onEnableTranslation"
						@mousedown="onMousedown"
						@mouseup="onMouseup"
					/>
				</Transition>

				<v-remove
					v-if="item && !(nonEditable && item.$type !== 'deleted')"
					:class="{ disabled: activatorDisabled }"
					:disabled="activatorDisabled"
					:item-type="item.$type"
					:item-info="relationInfo"
					:item-is-local="isLocalItem(item)"
					:item-edits="getItemEdits(item)"
					@action="onToggleDelete"
				/>
			</div>
		</div>

		<v-form
			v-if="formReady"
			:key="lang"
			:primary-key="itemPrimaryKey ?? '+'"
			:class="{ unselected: !item, disabled }"
			:disabled="disabled || !saveAllowed || item?.$type === 'deleted'"
			:non-editable="nonEditable"
			:loading="loading"
			:fields="fields"
			:model-value="item"
			:initial-values="itemInitial"
			:badge="language.text"
			:direction="language.direction"
			:autofocus="autofocus"
			inline
			@update:model-value="updateValue($event, lang)"
		/>

		<v-divider />
	</div>
</template>

<style scoped>
.translation-column {
	display: flex;
	flex-direction: column;
	min-inline-size: 0;
}

.header-row {
	display: flex;
	gap: 0.5rem;
	align-items: flex-start;
}

.header-row :deep(.language-header) {
	flex: 1;
}

.header-actions {
	display: flex;
	flex-shrink: 0;
	gap: 0.25rem;
	align-items: center;
	padding-block-start: 0.35rem;
}

.activator-loading-placeholder {
	--size: 1.375rem;

	display: inline-block;
	inline-size: var(--size);
	block-size: var(--size);
}

.v-icon.disabled {
	--v-icon-color: var(--theme--primary-subdued);
}

.v-form {
	--theme--form--row-gap: 1.8125rem;
	--v-chip-color: var(--theme--primary);
	--v-chip-background-color: var(--theme--primary-background);

	margin-block-start: 1.8125rem;
}

.v-form.unselected:not(.disabled) {
	opacity: 0.5;
}

.v-form.unselected:not(.disabled):hover,
.v-form.unselected:not(.disabled):focus-within {
	opacity: 1;
}

.v-divider {
	--v-divider-color: var(--theme--primary-subdued);
	margin-block-start: var(--theme--form--row-gap);
}

.rotate-in-enter-active,
.rotate-in-enter-active.has-click,
.rotate-out-enter-active,
.rotate-out-enter-active.has-click {
	transition: transform var(--medium) var(--transition-in);
}

.rotate-in-leave-active,
.rotate-in-leave-active.has-click,
.rotate-out-leave-active,
.rotate-out-leave-active.has-click {
	transition: transform var(--medium) var(--transition-out);
}

.rotate-in-leave-from,
.rotate-in-enter-to,
.rotate-out-leave-from,
.rotate-out-enter-to {
	transform: rotate(0deg);
}

.rotate-in-enter-from,
.rotate-out-leave-to {
	transform: rotate(90deg);
}

.rotate-in-leave-to,
.rotate-out-enter-from {
	transform: rotate(-90deg);
}
</style>
