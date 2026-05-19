import type { useApi } from '@directus/extensions-sdk';
import { cloneDeep, set } from 'lodash-es';

export async function fetchAll<T = unknown>(
	api: ReturnType<typeof useApi>,
	url: string,
	config: Record<string, unknown> = {},
	limit = Infinity,
): Promise<T[]> {
	let page = 1;
	let hasMore = true;

	const configWithLimit = cloneDeep(config);
	set(configWithLimit, 'params.limit', -1);

	try {
		const { data } = await api.get<{ data: T[] }>(url, configWithLimit);
		const items = data.data ?? [];

		if (Number.isFinite(limit)) {
			return items.slice(0, limit);
		}

		return items;
	} catch {
		// Fall back to paginated requests if limit -1 is not supported
		const pageSize = 100;
		const result: T[] = [];

		while (result.length < limit && hasMore) {
			const configWithPagination = cloneDeep(config);
			set(configWithPagination, 'params.page', page);
			set(configWithPagination, 'params.limit', pageSize);

			const { data } = await api.get<{ data: T[] }>(url, configWithPagination);

			if (!data.data?.length) {
				hasMore = false;
			} else {
				result.push(...data.data);
				page++;
			}
		}

		if (Number.isFinite(limit)) {
			return result.slice(0, limit);
		}

		return result;
	}
}
