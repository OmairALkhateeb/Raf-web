/**
 * Laravel `Resource::collection($paginator)` JSON shape (LengthAwarePaginator).
 * `from`/`to` are null when the page has no rows. `prev`/`next` and each
 * `meta.links[].url` are null at the ends of the range.
 */
export interface LaravelPaginationLink {
  url: string | null;
  label: string;
  active: boolean;
}

export interface LaravelPaginated<T> {
  data: T[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    links?: LaravelPaginationLink[];
    path: string;
    per_page: number;
    to: number | null;
    total: number;
  };
}

export interface LaravelCollection<T> {
  data: T[];
}
