import assert from "node:assert/strict";
import test from "node:test";
import { buildSeats, getSightline, THEATERS } from "../app/seatlineData.ts";

test("buildSeats creates the complete auditorium map", () => {
  for (const theater of THEATERS) {
    const seats = buildSeats(theater);
    assert.equal(seats.length, theater.rows * theater.columns);
    assert.equal(seats.find((seat) => seat.id === theater.defaultSeat)?.status, "available");
    assert.ok(seats.some((seat) => seat.status === "accessible"));
    assert.ok(seats.some((seat) => seat.status === "companion"));
  }
});

test("getSightline returns bounded, usable preview metrics", () => {
  for (const theater of THEATERS) {
    const seat = buildSeats(theater).find((candidate) => candidate.id === theater.defaultSeat);
    assert.ok(seat);
    const sightline = getSightline(theater, seat);
    assert.ok(sightline.centering >= 65 && sightline.centering <= 100);
    assert.ok(sightline.screenFill >= 58 && sightline.screenFill <= 96);
    assert.ok(sightline.distance > 0);
    assert.match(sightline.rating, /^(Exceptional|Great|Good)$/);
  }
});
