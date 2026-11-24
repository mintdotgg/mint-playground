import { catalog } from "./catalog";

const shelfPath = "/complete-shelf";
type BookLocation = Pick<Location, "pathname" | "search">;

export function completeShelfBookHref(id: string) {
  return `${shelfPath}?${new URLSearchParams({ book: id })}`;
}

function indexFromSearch(search: string) {
  const id = new URLSearchParams(search).get("book");
  return catalog.findIndex((book) => book.id === id);
}

export function getInitialShelfBookIndex({ location, parent }: {
  location: BookLocation;
  parent: { location: BookLocation };
}): number | null {
  const directIndex = indexFromSearch(location.search);
  if (directIndex >= 0) return directIndex;

  try {
    // The published shelf runs in a same-origin iframe. Third-party embeds
    // cannot read the parent location and may use their own query parameter.
    const parentLocation = parent.location;
    if (parentLocation.pathname === shelfPath) {
      const parentIndex = indexFromSearch(parentLocation.search);
      if (parentIndex >= 0) return parentIndex;
    }
  } catch {
    return null;
  }
  return null;
}
