import { seatById } from "./cabin-layout";

const simulatorPath = "/plane-seat-simulator";
type SeatLocation = Pick<Location, "pathname" | "search">;

export function planeSeatHref(id: string) {
  return `${simulatorPath}?${new URLSearchParams({ seat: id })}`;
}

function seatFromSearch(search: string) {
  const id = new URLSearchParams(search).get("seat");
  return id === null ? undefined : seatById(id.toUpperCase())?.id;
}

export function getInitialPlaneSeat({ location, parent }: {
  location: SeatLocation;
  parent: { location: SeatLocation };
}) {
  const directSeat = seatFromSearch(location.search);
  if (directSeat) return directSeat;

  try {
    // The published simulator runs in a same-origin iframe, while independent
    // copies can still use their own query parameter.
    const parentLocation = parent.location;
    if (parentLocation.pathname === simulatorPath) return seatFromSearch(parentLocation.search);
  } catch {
    return undefined;
  }
  return undefined;
}
