import { requireCloud } from "../cloud/config";
import { parseGallery, type ExploreSort } from "./model";
export async function searchGallery(
  query: string,
  category: string,
  sort: ExploreSort,
  offset: number,
  seed: string,
  signal: AbortSignal,
) {
  const { data, error } = await requireCloud()
    .rpc("search_explore", {
      search_text: query.trim(),
      category_filter: category,
      sort_order: sort,
      page_offset: offset,
      page_size: 12,
      random_seed: seed,
    })
    .abortSignal(signal);
  if (error) throw error;
  return parseGallery(data);
}
