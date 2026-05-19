/**
 * M2M-only relation staging for translations fields.
 * Based on Directus core use-relation-multiple (MIT), trimmed for this extension.
 */
import type { ContentVersion, Filter } from '@directus/types';
import { getEndpoint } from '@directus/utils';
import type { useApi } from '@directus/extensions-sdk';
import { cloneDeep, isEqual, merge } from 'lodash-es';
import { computed, ref, type Ref, watch } from 'vue';
import type { RelationM2M } from './use-relation-m2m';
import { unexpectedError } from '../utils/unexpected-error';

export type RelationQueryMultiple = {
	page: number;
	limit: number;
	fields: string[];
	search?: string;
	sort?: string[];
	filter?: Filter;
};

export type DisplayItem = {
	[key: string]: unknown;
	$index?: number;
	$type?: 'created' | 'updated' | 'deleted';
	$edits?: number;
};

export type ChangesItem = {
	create: Record<string, unknown>[];
	update: Record<string, unknown>[];
	delete: (string | number)[];
};

export function useRelationMultiple(
	value: Ref<Record<string, unknown> | unknown[] | undefined | null>,
	previewQuery: Ref<RelationQueryMultiple>,
	relation: Ref<RelationM2M | undefined>,
	itemId: Ref<string | number | null>,
	version: Ref<ContentVersion | null>,
	api: ReturnType<typeof useApi>,
) {
	const loading = ref(false);
	const fetchedItems = ref<Record<string, unknown>[]>([]);

	const targetPKField = computed(() => relation.value?.junctionPrimaryKeyField.field ?? 'id');

	const _value = computed<ChangesItem>({
		get() {
			if (!value.value || Array.isArray(value.value)) {
				return { create: [], update: [], delete: [] };
			}

			return value.value as ChangesItem;
		},
		set(newValue) {
			if (newValue.create.length === 0 && newValue.update.length === 0 && newValue.delete.length === 0) {
				if (version.value !== null) {
					value.value = fetchedItems.value.map((item) => item[targetPKField.value]);
					return;
				}

				value.value = undefined;
				return;
			}

			value.value = newValue;
		},
	});

	watch(
		[previewQuery, itemId, relation],
		(newData, oldData) => {
			if (!isEqual(newData, oldData)) {
				void updateFetchedItems();
			}
		},
		{ immediate: true },
	);

	watch(value, (newValue, oldValue) => {
		if (
			Array.isArray(newValue) &&
			oldValue &&
			(('create' in oldValue && Array.isArray(oldValue.create) && oldValue.create.length > 0) ||
				('update' in oldValue && Array.isArray(oldValue.update) && oldValue.update.length > 0) ||
				('delete' in oldValue && Array.isArray(oldValue.delete) && oldValue.delete.length > 0))
		) {
			void updateFetchedItems();
		}
	});

	const createdItems = computed(() => {
		if (!relation.value) return [];

		return _value.value.create.map((item, index) => ({
			...item,
			$type: 'created' as const,
			$index: index,
		}));
	});

	const displayItems = computed(() => {
		if (!relation.value) return [];

		const info = relation.value;
		const pkField = targetPKField.value;

		const items: DisplayItem[] = fetchedItems.value.map((item) => {
			let edits: { index: number; value: Record<string, unknown> } | undefined;

			for (const [index, val] of _value.value.update.entries()) {
				if (typeof val === 'object' && val[pkField] === item[pkField]) {
					edits = { index, value: val };
					break;
				}
			}

			let updatedItem: Record<string, unknown> = cloneDeep(item);

			if (edits) {
				updatedItem = {
					...updatedItem,
					...edits.value,
					[info.junctionField.field]: {
						...cloneDeep(item)[info.junctionField.field] as Record<string, unknown>,
						...(edits.value[info.junctionField.field] as Record<string, unknown>),
					},
					$type: 'updated',
					$index: edits.index,
					$edits: edits.index,
				};
			}

			const deleteIndex = _value.value.delete.findIndex((id) => id === item[pkField]);

			if (deleteIndex !== -1) {
				merge(updatedItem, { $type: 'deleted', $index: deleteIndex });
			}

			return updatedItem;
		});

		items.push(...createdItems.value);

		return items;
	});

	function cleanItem(item: DisplayItem): Record<string, unknown> {
		return Object.entries(item).reduce(
			(acc, [key, val]) => {
				if (!key.startsWith('$')) acc[key] = val;
				return acc;
			},
			{} as Record<string, unknown>,
		);
	}

	function isEmpty(item: DisplayItem): boolean {
		return Object.keys(cleanItem(item)).length <= 1;
	}

	function create(...items: Record<string, unknown>[]) {
		for (const item of items) {
			_value.value.create.push(cleanItem(item as DisplayItem));
		}

		_value.value = cloneDeep(_value.value);
	}

	function update(...items: DisplayItem[]) {
		if (!relation.value) return;

		for (const item of items) {
			if (item.$type === undefined || item.$index === undefined) {
				_value.value.update.push(cleanItem(item));
			} else if (item.$type === 'created') {
				_value.value.create[item.$index] = cleanItem(item);
			} else if (item.$type === 'updated') {
				if (isEmpty(item)) _value.value.update.splice(item.$index, 1);
				else _value.value.update[item.$index] = cleanItem(item);
			} else if (item.$type === 'deleted') {
				if (item.$edits !== undefined) {
					if (isEmpty(item)) _value.value.update.splice(item.$index, 1);
					else _value.value.update[item.$edits] = cleanItem(item);
				} else {
					_value.value.update.push(cleanItem(item));
				}
			}
		}

		_value.value = cloneDeep(_value.value);
	}

	function remove(...items: DisplayItem[]) {
		if (!relation.value) return;

		for (const item of items) {
			if (item.$type === undefined || item.$index === undefined) {
				_value.value.delete.push(item[targetPKField.value] as string | number);
			} else if (item.$type === 'created') {
				_value.value.create.splice(item.$index, 1);
			} else if (item.$type === 'updated') {
				_value.value.delete.push(item[targetPKField.value] as string | number);
			} else if (item.$type === 'deleted') {
				_value.value.delete.splice(item.$index, 1);
			}
		}

		_value.value = cloneDeep(_value.value);
	}

	function isLocalItem(item: DisplayItem) {
		return item.$type !== undefined && (item.$type !== 'updated' || isItemSelected(item));
	}

	function isItemSelected(item: DisplayItem) {
		return relation.value !== undefined && item[relation.value.reverseJunctionField.field] !== undefined;
	}

	function getItemEdits(item: DisplayItem): DisplayItem {
		if ('$type' in item && item.$index !== undefined) {
			if (item.$type === 'created') {
				return { ..._value.value.create[item.$index], $type: 'created', $index: item.$index };
			}

			if (item.$type === 'updated') {
				return { ..._value.value.update[item.$index], $type: 'updated', $index: item.$index };
			}

			if (item.$type === 'deleted' && item.$edits !== undefined) {
				return {
					..._value.value.update[item.$edits],
					$type: 'deleted',
					$index: item.$index,
					$edits: item.$edits,
				};
			}
		}

		return {};
	}

	async function updateFetchedItems() {
		if (!relation.value) return;

		if (itemId.value === undefined || itemId.value === '+') {
			fetchedItems.value = [];
			return;
		}

		const info = relation.value;
		const reverseJunctionField = info.reverseJunctionField.field;
		const fields = new Set(previewQuery.value.fields);

		fields.add(info.junctionPrimaryKeyField.field);
		fields.add(`${info.junctionField.field}.${info.relatedPrimaryKeyField.field}`);

		if (info.sortField) fields.add(info.sortField);

		try {
			loading.value = true;

			const currentItemId = itemId.value;

			const filter: Filter = {
				_and: [{ [reverseJunctionField]: itemId.value === null ? { _null: true } : itemId.value } as Filter],
			};

			if (previewQuery.value.filter) {
				filter._and!.push(previewQuery.value.filter);
			}

			const { data } = await api.get<{ data: Record<string, unknown>[] }>(
				getEndpoint(info.junctionCollection.collection),
				{
					params: {
						search: previewQuery.value.search,
						fields: Array.from(fields),
						filter,
						page: previewQuery.value.page,
						limit: previewQuery.value.limit,
						sort: previewQuery.value.sort,
					},
				},
			);

			if (itemId.value !== currentItemId) return;

			fetchedItems.value = data.data ?? [];
		} catch (error) {
			unexpectedError(error);
		} finally {
			loading.value = false;
		}
	}

	return {
		create,
		update,
		remove,
		isLocalItem,
		displayItems,
		loading,
		fetchedItems,
		getItemEdits,
	};
}
