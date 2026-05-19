<script setup lang="ts">
import type { ContentVersion } from '@directus/types';
import { useApi, useStores } from '@directus/extensions-sdk';
import { getEndpoint } from '@directus/utils';
import { isNil } from 'lodash-es';
import { computed, ref, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import TranslationForm from './translation-form.vue';
import { useInjectNestedValidation } from './composables/use-nested-validation';
import { useRelationM2M } from './composables/use-relation-m2m';
import { type DisplayItem, type RelationQueryMultiple, useRelationMultiple } from './composables/use-relation-multiple';
import { fetchAll } from './utils/fetch-all';
import { unexpectedError } from './utils/unexpected-error';
import { validateItem } from './utils/validate-item';

const props = withDefaults(
	defineProps<{
		collection: string;
		field: string;
		primaryKey: string | number;
		languageField?: string | null;
		languageDirectionField?: string | null;
		defaultLanguage?: string | null;
		userLanguage?: boolean;
		columnMinWidth?: number;
		value?: (number | string | Record<string, unknown>)[] | Record<string, unknown> | null;
		autofocus?: boolean;
		disabled?: boolean;
		nonEditable?: boolean;
		version: ContentVersion | null;
	}>(),
	{
		languageField: null,
		languageDirectionField: 'direction',
		value: () => [],
		autofocus: false,
		disabled: false,
		nonEditable: false,
		defaultLanguage: null,
		userLanguage: false,
		columnMinWidth: 320,
	},
);

const emit = defineEmits<{
	input: [value: unknown];
}>();

const api = useApi();

const value = computed({
	get: () => props.value ?? [],
	set: (val) => {
		emit('input', val);
	},
});

const { collection, field, primaryKey, version } = toRefs(props);
const { relationInfo } = useRelationM2M(collection, field);
const { locale } = useI18n();
const { useFieldsStore } = useStores();
const fieldsStore = useFieldsStore();

const columnMinWidthPx = computed(() => `${props.columnMinWidth}px`);

const fields = computed(() => {
	if (!relationInfo.value) return [];
	return fieldsStore.getFieldsForCollection(relationInfo.value.junctionCollection.collection);
});

const query = ref<RelationQueryMultiple>({ fields: ['*'], limit: -1, page: 1 });

const {
	create,
	update,
	remove,
	isLocalItem,
	displayItems,
	loading: itemsLoading,
	fetchedItems,
	getItemEdits,
} = useRelationMultiple(value, query, relationInfo, primaryKey, version, api);

const { languageOptions, loading: languagesLoading } = useLanguages();

useNestedValidation();

function getItemWithLang<T extends Record<string, unknown>>(items: T[], lang: string | undefined) {
	const langField = relationInfo.value?.junctionField.field;
	const relatedPKField = relationInfo.value?.relatedPrimaryKeyField.field;
	if (!langField || !relatedPKField || !lang) return;

	return items.find((item) => {
		const junction = item?.[langField] as Record<string, unknown> | undefined;
		return junction?.[relatedPKField] === lang;
	}) as DisplayItem | undefined;
}

function updateValue(item: DisplayItem | undefined, lang: string | undefined) {
	const info = relationInfo.value;
	if (!info) return;

	const itemInfo = getItemWithLang(displayItems.value, lang);

	if (itemInfo) {
		const itemUpdates: DisplayItem = {
			...item,
			[info.junctionField.field]: {
				[info.relatedPrimaryKeyField.field]: lang,
			},
			$type: itemInfo?.$type,
			$index: itemInfo?.$index,
			$edits: itemInfo?.$edits,
		};

		if (itemInfo[info.junctionPrimaryKeyField.field] !== undefined) {
			itemUpdates[info.junctionPrimaryKeyField.field] = itemInfo[info.junctionPrimaryKeyField.field];
		} else if (primaryKey.value !== '+') {
			itemUpdates[info.reverseJunctionField.field] = primaryKey.value;
		}

		update(itemUpdates);
	} else {
		create({
			...item,
			[info.junctionField.field]: {
				[info.relatedPrimaryKeyField.field]: lang,
			},
		});
	}
}

const translationProps = computed(() => ({
	disabled: props.disabled,
	nonEditable: props.nonEditable,
	autofocus: props.autofocus,
	relationInfo: relationInfo.value,
	getItemWithLang,
	loading: languagesLoading.value || itemsLoading.value,
	displayItems: displayItems.value,
	fetchedItems: fetchedItems.value,
	getItemEdits,
	isLocalItem,
	updateValue,
	remove,
}));

function useLanguages() {
	const languages = ref<Record<string, unknown>[]>([]);
	const loading = ref(false);

	const languageOptions = computed(() => {
		const langField = relationInfo.value?.junctionField.field;
		if (!langField) return [];

		const writableFields = fields.value.filter(
			(f) => f.type !== 'alias' && f.meta?.hidden === false && f.meta?.readonly === false,
		);

		const totalFields = writableFields.length;

		return languages.value.map((language) => {
			const info = relationInfo.value;
			if (!info) return null;

			const langCode = language[info.relatedPrimaryKeyField.field] as string;

			const edits = getItemWithLang(displayItems.value, langCode);

			const filledFields = writableFields.filter((f) => !isNil((edits ?? {})[f.field])).length;

			return {
				text: String(language[props.languageField ?? info.relatedPrimaryKeyField.field] ?? langCode),
				direction: props.languageDirectionField
					? (language[props.languageDirectionField] as string | undefined)
					: undefined,
				value: langCode,
				edited: edits?.$type !== undefined,
				progress: totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0,
			};
		}).filter((opt): opt is NonNullable<typeof opt> => opt !== null);
	});

	const fieldsToFetch = computed(() => {
		const result: string[] = [];
		if (!relationInfo.value) return result;

		const langCollection = relationInfo.value.relatedCollection.collection;

		if (props.languageField !== null && fieldsStore.getField(langCollection, props.languageField)) {
			result.push(props.languageField);
		}

		if (
			props.languageDirectionField !== null &&
			fieldsStore.getField(langCollection, props.languageDirectionField)
		) {
			result.push(props.languageDirectionField);
		}

		result.push(relationInfo.value.relatedPrimaryKeyField.field);

		return result;
	});

	watch(fieldsToFetch, fetchLanguages, { immediate: true });

	return { languageOptions, loading };

	async function fetchLanguages() {
		if (!relationInfo.value || !fieldsToFetch.value.length) return;

		loading.value = true;

		try {
			languages.value = await fetchAll<Record<string, unknown>>(
				api,
				getEndpoint(relationInfo.value.relatedCollection.collection),
				{
					params: {
						fields: fieldsToFetch.value,
						sort:
							relationInfo.value.relatedCollection.meta?.sort_field ??
							props.languageField ??
							relationInfo.value.relatedPrimaryKeyField.field,
					},
				},
			);
		} catch (error) {
			unexpectedError(error);
		} finally {
			loading.value = false;
		}
	}
}

function useNestedValidation() {
	const { updateNestedValidationErrors } = useInjectNestedValidation();

	watch(
		() => displayItems.value,
		(updatedDisplayItems) => {
			const errorsMap = getErrorsPerLanguage(updatedDisplayItems);

			const validationErrors = Object.entries(errorsMap).flatMap(([lang, items]) =>
				items.map((item) => updateFieldName(item, lang)),
			);

			updateNestedValidationErrors(props.field, validationErrors);
		},
	);

	function getErrorsPerLanguage(updatedDisplayItems: DisplayItem[]) {
		const errorsMap: Record<string, ReturnType<typeof validateItem>> = {};

		updatedDisplayItems?.forEach((item) => {
			const langField = relationInfo.value?.junctionField.field;
			const relatedPKField = relationInfo.value?.relatedPrimaryKeyField.field;
			if (!langField || !relatedPKField) return;

			const junction = item?.[langField] as Record<string, unknown> | undefined;
			const lang = junction?.[relatedPKField] as string | undefined;
			if (!lang) return;

			const errorsPerLanguage = validateItem(item, fields.value, item.$type === 'created');

			if (!errorsPerLanguage?.length) return;

			errorsMap[lang] = errorsPerLanguage.map((error) => addNestedProperties(error, lang));
		});

		return errorsMap;
	}

	function addNestedProperties(error: { field: string; [key: string]: unknown }, lang: string) {
		const fieldMeta = fields.value?.find((f) => f.field === error.field);

		return {
			...error,
			nestedNames: {
				[lang]: languageOptions.value.find((opt) => opt.value === lang)?.text ?? lang,
				[error.field]: fieldMeta?.name ?? error.field,
			},
			validation_message: fieldMeta?.meta?.validation_message,
		};
	}

	function updateFieldName(item: { field: string; [key: string]: unknown }, lang: string) {
		return { ...item, field: `${props.field}.${lang}.${item.field}` };
	}
}
</script>

<template>
	<div
		class="gobo-translations-grid"
		:style="{ '--column-min-width': columnMinWidthPx }"
	>
		<TranslationForm
			v-for="language in languageOptions"
			:key="language.value"
			v-bind="translationProps"
			:lang="language.value"
			:language="language"
		/>
	</div>
</template>

<style scoped>
.gobo-translations-grid {
	display: flex;
	gap: var(--theme--form--column-gap, 1.5rem);
	align-items: flex-start;
	overflow-x: auto;
	padding-block-end: 0.5rem;
}

.gobo-translations-grid :deep(.translation-column) {
	flex: 0 0 min(100%, var(--column-min-width, 320px));
	min-inline-size: var(--column-min-width, 320px);
}
</style>
