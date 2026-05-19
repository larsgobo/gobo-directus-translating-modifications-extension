import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';

export default defineInterface({
	id: 'gobo-translations-grid',
	name: 'Gobo Translations Grid',
	icon: 'view_column',
	description: 'Show all translation languages side-by-side in a horizontal grid',
	component: InterfaceComponent,
	types: ['alias'],
	localTypes: ['translations'],
	group: 'relational',
	relational: true,
	options: ({ relations }) => {
		const languagesCollection = relations.m2o?.related_collection;
		const choices: { text: string; value: string }[] = [];

		// Field choices are resolved in the Data Studio when configuring the interface
		if (languagesCollection) {
			choices.push(
				{ text: 'Primary Key', value: languagesCollection },
				{ text: 'name', value: 'name' },
				{ text: 'direction', value: 'direction' },
			);
		}

		return [
			{
				field: 'languageField',
				type: 'string',
				name: 'Language indicator field',
				meta: {
					interface: 'select-dropdown',
					width: 'half',
					options: {
						placeholder: 'Primary key',
						choices,
					},
				},
			},
			{
				field: 'languageDirectionField',
				type: 'string',
				name: 'Language direction field',
				schema: {
					default_value: 'direction',
				},
				meta: {
					interface: 'select-dropdown',
					width: 'half',
					options: { choices },
				},
			},
			{
				field: 'userLanguage',
				name: 'Use current user language',
				type: 'boolean',
				schema: { default_value: false },
				meta: {
					interface: 'boolean',
					width: 'half',
					options: { label: 'Enable' },
				},
			},
			{
				field: 'defaultLanguage',
				name: 'Default language',
				type: 'string',
				meta: {
					interface: 'input',
					width: 'half',
					options: { placeholder: 'e.g. en-US' },
				},
			},
			{
				field: 'columnMinWidth',
				name: 'Column min width (px)',
				type: 'integer',
				schema: { default_value: 320 },
				meta: {
					interface: 'input',
					width: 'half',
				},
			},
		];
	},
});
