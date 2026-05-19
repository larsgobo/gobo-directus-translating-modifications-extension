/**
 * Adapted from Directus core (MIT): app/src/composables/use-nested-validation.ts
 */
import { isEmpty } from 'lodash-es';
import { computed, inject, provide, ref } from 'vue';

const nestedValidationSymbol = Symbol('goboNestedValidation');

export function useNestedValidation() {
	const nestedValidationErrorsPerField = ref<Record<string, unknown[]>>({});
	const nestedValidationErrors = computed(getNestedValidationErrors);

	provide(nestedValidationSymbol, { updateNestedValidationErrors });

	return { nestedValidationErrors, resetNestedValidationErrors };

	function updateNestedValidationErrors(fieldKey: string, errors: unknown[]) {
		nestedValidationErrorsPerField.value[fieldKey] = errors;
	}

	function getNestedValidationErrors() {
		return Object.entries(nestedValidationErrorsPerField.value).flatMap(([, errors]) =>
			!isEmpty(errors) ? errors : [],
		);
	}

	function resetNestedValidationErrors() {
		nestedValidationErrorsPerField.value = {};
	}
}

export function useInjectNestedValidation() {
	return inject(nestedValidationSymbol, {
		updateNestedValidationErrors: (_field: string, _validationErrors: unknown[]) => {},
	}) as { updateNestedValidationErrors: (fieldKey: string, errors: unknown[]) => void };
}
