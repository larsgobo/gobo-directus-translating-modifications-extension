/**
 * Simplified validation for nested translation fields.
 * Full port of Directus validate-item would pull in apply-conditions and parse-filter.
 */
import type { Field } from '@directus/types';
import { validatePayload } from '@directus/utils';
import { isNil } from 'lodash-es';

export type ValidationError = {
	field: string;
	type: string;
	[key: string]: unknown;
};

export function validateItem(
	item: Record<string, unknown>,
	fields: Field[],
	isNew: boolean,
): ValidationError[] {
	const validationRules: { _and: Record<string, unknown>[] } = { _and: [] };
	const errors: ValidationError[] = [];

	for (const field of fields) {
		if (field.meta?.required !== true) continue;
		if (field.meta?.hidden === true || field.meta?.readonly === true) continue;

		const value = item[field.field];

		if (isNil(value) || value === '') {
			errors.push({
				field: field.field,
				type: 'required',
				hidden: field.meta?.hidden,
				group: field.meta?.group,
			});
		}
	}

	if (validationRules._and.length > 0) {
		const payloadErrors = validatePayload(validationRules, item);

		for (const err of payloadErrors) {
			for (const detail of err.details ?? []) {
				errors.push({
					field: String(detail.context?.key ?? 'unknown'),
					type: detail.type ?? 'validation',
				});
			}
		}
	}

	void isNew;
	return errors;
}
