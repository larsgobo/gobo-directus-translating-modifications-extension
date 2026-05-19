/**
 * Adapted from Directus core (MIT): app/src/composables/use-relation-m2m.ts
 */
import type { Field, Relation } from '@directus/types';
import { useStores } from '@directus/extensions-sdk';
import { computed, type Ref } from 'vue';

export type CollectionMeta = {
	collection: string;
	meta?: { sort_field?: string | null };
};

export type RelationM2M = {
	relation: Relation;
	relatedCollection: CollectionMeta;
	relatedPrimaryKeyField: Field;
	junctionCollection: CollectionMeta;
	junctionPrimaryKeyField: Field;
	junctionField: Field;
	reverseJunctionField: Field;
	junction: Relation;
	sortField?: string;
	type: 'm2m';
};

export function useRelationM2M(collection: Ref<string>, field: Ref<string>) {
	const { useRelationsStore, useCollectionsStore, useFieldsStore } = useStores();
	const relationsStore = useRelationsStore();
	const collectionsStore = useCollectionsStore();
	const fieldsStore = useFieldsStore();

	const relationInfo = computed<RelationM2M | undefined>(() => {
		const relations = relationsStore.getRelationsForField(collection.value, field.value);

		const junction = relations.find(
			(relation) =>
				relation.related_collection === collection.value &&
				relation.meta?.one_field === field.value &&
				relation.meta?.junction_field,
		);

		if (!junction) return undefined;

		const relation = relations.find(
			(r) => r.collection === junction.collection && r.field === junction.meta?.junction_field,
		);

		if (!relation) return undefined;

		const relatedCollection = relation.related_collection as string;
		const junctionCollection = junction.collection;

		return {
			relation,
			relatedCollection: collectionsStore.getCollection(relatedCollection) as CollectionMeta,
			relatedPrimaryKeyField: fieldsStore.getPrimaryKeyFieldForCollection(relatedCollection)!,
			sortField: junction.meta?.sort_field ?? undefined,
			junctionCollection: collectionsStore.getCollection(junctionCollection) as CollectionMeta,
			junctionPrimaryKeyField: fieldsStore.getPrimaryKeyFieldForCollection(junctionCollection)!,
			junctionField: fieldsStore.getField(junctionCollection, junction.meta!.junction_field as string)!,
			reverseJunctionField: fieldsStore.getField(junctionCollection, relation.meta!.junction_field as string)!,
			junction,
			type: 'm2m',
		};
	});

	return { relationInfo };
}
