import type {
  SeatlineChairKey,
  SeatlineScreenKey,
  SeatlineShellKey,
} from "./seatlineMintAssets";

export type SeatStatus = "available" | "occupied" | "accessible" | "companion";

export type Seat = {
  id: string;
  row: string;
  number: number;
  rowIndex: number;
  columnIndex: number;
  status: SeatStatus;
  x: number;
  y: number;
  z: number;
};

export type Showtime = {
  id: string;
  time: string;
  period: string;
  label: string;
  price: number;
  remaining: number;
};

export type Theater = {
  id: string;
  name: string;
  shortName: string;
  neighborhood: string;
  address: string;
  auditorium: string;
  format: string;
  formatNote: string;
  distance: string;
  sourceUrl: string;
  shell: SeatlineShellKey;
  screen: SeatlineScreenKey;
  chair: SeatlineChairKey;
  rows: number;
  columns: number;
  aislesAfter: number[];
  roomWidth: number;
  roomDepth: number;
  roomHeight: number;
  screenWidth: number;
  screenAspect: number;
  screenBaseY: number;
  screenWallOffset: number;
  screenDepthScale: number;
  screenBottomCrop: number;
  screenDepthFromFirstRow: number;
  screenZ: number;
  baseZ: number;
  seatBaseY: number;
  rowSpacing: number;
  rowRise: number;
  seatSpacing: number;
  chairWidth: number;
  seed: number;
  defaultSeat: string;
  showtimes: Showtime[];
};

export const DATES = [
  { id: "2026-07-22", day: "WED", date: "22" },
  { id: "2026-07-23", day: "THU", date: "23" },
  { id: "2026-07-24", day: "FRI", date: "24" },
] as const;

export const THEATERS: Theater[] = [
  {
    id: "lincoln-square",
    name: "AMC Lincoln Square 13",
    shortName: "Lincoln Square",
    neighborhood: "Upper West Side",
    address: "1998 Broadway, New York, NY 10023",
    auditorium: "Auditorium 1",
    format: "IMAX 70MM",
    formatNote: "Tall 1.43:1 presentation · Reserved seating",
    distance: "1.8 mi",
    sourceUrl:
      "https://www.amctheatres.com/movie-theatres/new-york-city/amc-lincoln-square-13",
    shell: "monument",
    screen: "imax",
    chair: "cinema",
    rows: 11,
    columns: 18,
    aislesAfter: [6, 12],
    roomWidth: 30,
    roomDepth: 27,
    roomHeight: 18,
    screenWidth: 24,
    screenAspect: 1.43,
    screenBaseY: 0.4,
    screenWallOffset: 0.06,
    screenDepthScale: 0.08,
    screenBottomCrop: 0,
    screenDepthFromFirstRow: 9.2,
    screenZ: -12.2,
    baseZ: -3,
    seatBaseY: 0.72,
    rowSpacing: 1.25,
    rowRise: 0.79,
    seatSpacing: 1.02,
    chairWidth: 0.84,
    seed: 4,
    defaultSeat: "F10",
    showtimes: [
      { id: "ls-1500", time: "3:00", period: "PM", label: "IMAX 70MM", price: 31.49, remaining: 38 },
      { id: "ls-1830", time: "6:30", period: "PM", label: "IMAX 70MM", price: 34.49, remaining: 16 },
      { id: "ls-2200", time: "10:00", period: "PM", label: "IMAX 70MM", price: 32.49, remaining: 27 },
    ],
  },
  {
    id: "times-square",
    name: "Regal Times Square",
    shortName: "Times Square",
    neighborhood: "Midtown",
    address: "247 W 42nd St, New York, NY 10036",
    auditorium: "House 6",
    format: "RPX",
    formatNote: "Large format · Recliner seating",
    distance: "0.7 mi",
    sourceUrl: "https://www.regmovies.com/theatres/regal-times-square-1929",
    shell: "midtown",
    screen: "imax",
    chair: "cinema",
    rows: 9,
    columns: 16,
    aislesAfter: [5, 11],
    roomWidth: 27,
    roomDepth: 23,
    roomHeight: 13,
    screenWidth: 19,
    screenAspect: 1.9,
    screenBaseY: 1.1,
    screenWallOffset: 0.12,
    screenDepthScale: 0.06,
    screenBottomCrop: 0.16,
    screenDepthFromFirstRow: 7.4,
    screenZ: -10.2,
    baseZ: -2.8,
    seatBaseY: 0.58,
    rowSpacing: 1.25,
    rowRise: 0.62,
    seatSpacing: 1.06,
    chairWidth: 0.86,
    seed: 7,
    defaultSeat: "E8",
    showtimes: [
      { id: "ts-1140", time: "11:40", period: "AM", label: "RPX", price: 23.99, remaining: 54 },
      { id: "ts-1545", time: "3:45", period: "PM", label: "RPX", price: 27.99, remaining: 42 },
      { id: "ts-1950", time: "7:50", period: "PM", label: "RPX", price: 29.99, remaining: 21 },
    ],
  },
  {
    id: "downtown-brooklyn",
    name: "Alamo Drafthouse Downtown Brooklyn",
    shortName: "Downtown Brooklyn",
    neighborhood: "City Point",
    address: "445 Albee Square W, Brooklyn, NY 11201",
    auditorium: "Theater 8",
    format: "DINE-IN",
    formatNote: "Reserved recliners · In-seat service",
    distance: "3.4 mi",
    sourceUrl:
      "https://drafthouse.com/nyc/theater/downtown-brooklyn",
    shell: "brooklyn",
    screen: "imax",
    chair: "dineIn",
    rows: 7,
    columns: 10,
    aislesAfter: [5],
    roomWidth: 22,
    roomDepth: 18,
    roomHeight: 10,
    screenWidth: 14.5,
    screenAspect: 1.9,
    screenBaseY: 1.15,
    screenWallOffset: 0.1,
    screenDepthScale: 0.06,
    screenBottomCrop: 0.16,
    screenDepthFromFirstRow: 5.7,
    screenZ: -7.7,
    baseZ: -2,
    seatBaseY: 0.48,
    rowSpacing: 1.5,
    rowRise: 0.48,
    seatSpacing: 1.48,
    chairWidth: 0.9,
    seed: 10,
    defaultSeat: "D6",
    showtimes: [
      { id: "db-1215", time: "12:15", period: "PM", label: "DINE-IN", price: 19.5, remaining: 31 },
      { id: "db-1515", time: "3:15", period: "PM", label: "DINE-IN", price: 21.5, remaining: 24 },
      { id: "db-1830", time: "6:30", period: "PM", label: "DINE-IN", price: 23.5, remaining: 12 },
      { id: "db-2145", time: "9:45", period: "PM", label: "DINE-IN", price: 23.5, remaining: 19 },
    ],
  },
];

const rowLabel = (index: number) => String.fromCharCode(65 + index);

export function buildSeats(theater: Theater): Seat[] {
  const seats: Seat[] = [];
  const totalWidth =
    (theater.columns - 1) * theater.seatSpacing +
    theater.aislesAfter.length * 0.95;

  for (let rowIndex = 0; rowIndex < theater.rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < theater.columns; columnIndex += 1) {
      const number = columnIndex + 1;
      const row = rowLabel(rowIndex);
      const seatId = `${row}${number}`;
      const aisleOffset =
        theater.aislesAfter.filter((after) => columnIndex >= after).length * 0.95;
      const accessibleRow = rowIndex === theater.rows - 1;
      const edgeAccessible =
        accessibleRow && (columnIndex < 2 || columnIndex >= theater.columns - 2);
      const companion =
        accessibleRow && (columnIndex === 2 || columnIndex === theater.columns - 3);
      const occupied =
        seatId !== theater.defaultSeat &&
        !edgeAccessible &&
        !companion &&
        ((rowIndex * 7 + columnIndex * 3 + theater.seed) % 13 < 3 ||
          (rowIndex === Math.floor(theater.rows / 2) &&
            Math.abs(columnIndex - theater.columns / 2) > 2 &&
            columnIndex % 3 === 0));

      seats.push({
        id: seatId,
        row,
        number,
        rowIndex,
        columnIndex,
        status: edgeAccessible
          ? "accessible"
          : companion
            ? "companion"
            : occupied
              ? "occupied"
              : "available",
        x: columnIndex * theater.seatSpacing + aisleOffset - totalWidth / 2,
        y: theater.seatBaseY + rowIndex * theater.rowRise,
        z: theater.baseZ + rowIndex * theater.rowSpacing,
      });
    }
  }

  return seats;
}

export function getSightline(theater: Theater, seat: Seat) {
  const horizontal = Math.abs(seat.x) / Math.max(theater.roomWidth * 0.42, 1);
  const preferredRow = theater.rows * 0.58;
  const rowDelta = Math.abs(seat.rowIndex - preferredRow) / theater.rows;
  const centering = Math.max(65, Math.round(100 - horizontal * 31));
  const screenFill = Math.max(
    58,
    Math.min(96, Math.round(91 - rowDelta * 48 + seat.rowIndex * 0.45)),
  );
  const distance = Math.round(
    Math.hypot(seat.x, seat.z - theater.screenZ) * 3.15,
  );
  const rating =
    centering > 91 && screenFill > 80
      ? "Exceptional"
      : centering > 82 && screenFill > 70
        ? "Great"
        : "Good";

  return { centering, screenFill, distance, rating };
}
