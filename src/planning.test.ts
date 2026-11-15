import { describe, it, expect } from "vitest";
import { newRow, defaults, remapLinks } from "./model";
import {
  colombiaDate,
  chapterFor,
  chapterDays,
  tripIsToday,
  todaySchedule,
  linkedStays,
} from "./planning";
describe("chapter organization", () => {
  it("remaps chapter, ticket, travel and stay links when importing a backup", () => {
    const map = new Map([
      ["chapter-a", "new-a"],
      ["chapter-b", "new-b"],
      ["plan", "new-plan"],
      ["stay", "new-stay"],
    ]);
    expect(
      remapLinks(
        {
          title: "Linked item",
          chapterId: "chapter-a",
          fromChapterId: "chapter-a",
          toChapterId: "chapter-b",
          activityId: "plan",
          stayIds: ["stay", "missing"],
        },
        map,
      ),
    ).toEqual({
      chapterId: "new-a",
      fromChapterId: "new-a",
      toChapterId: "new-b",
      activityId: "new-plan",
      stayIds: ["new-stay"],
    });
  });
  it("shows every chapter day, even empty days, plus activities outside its dates", () => {
    const chapter = newRow(
      "destination",
      { title: "Bogotá", date: "2027-02-10", endDate: "2027-02-12" },
      "konrad",
    );
    const activity = newRow(
      "activity",
      { title: "Museum", date: "2027-02-14" },
      "gaba",
    );
    expect(chapterDays(chapter, [activity])).toEqual([
      "2027-02-10",
      "2027-02-11",
      "2027-02-12",
      "2027-02-14",
    ]);
  });
  it("assigns legacy city-only activities to the correct dated repeat visit", () => {
    const first = newRow(
        "destination",
        { title: "Bogotá", date: "2027-02-10", endDate: "2027-02-12" },
        "konrad",
      ),
      second = newRow(
        "destination",
        { title: "Bogotá", date: "2027-02-19", endDate: "2027-02-20" },
        "konrad",
      );
    const row = newRow(
      "activity",
      { title: "A last coffee", city: "Bogotá", date: "2027-02-20" },
      "julia",
    );
    expect(chapterFor(row, [first, second])?.id).toBe(second.id);
    row.data.chapterId = first.id;
    expect(chapterFor(row, [first, second])?.id).toBe(first.id);
  });
  it("does not silently reassign an activity whose explicit chapter was removed", () => {
    const chapter = newRow("destination", { title: "Cartagena" }, "konrad");
    const row = newRow(
      "activity",
      { title: "A stroll", city: "Cartagena", chapterId: "removed" },
      "gaba",
    );
    expect(chapterFor(row, [chapter])).toBeUndefined();
  });
  it("links multiple stays to an item and ignores removed stays", () => {
    const one = newRow("stay", { title: "Stay one" }, "gaba"),
      two = newRow("stay", { title: "Stay two" }, "janek");
    const item = newRow(
      "activity",
      { title: "Check-in", stayIds: [one.id, two.id] },
      "konrad",
    );
    expect(linkedStays(item, [one, two])).toHaveLength(2);
    expect(linkedStays(item, [one, { ...two, deleted: true }])).toHaveLength(1);
  });
});
describe("today, in Colombia", () => {
  it("keeps the today card during a free day between dated chapters", () => {
    const a = newRow(
      "destination",
      { title: "Bogotá", date: "2027-02-10", endDate: "2027-02-12" },
      "konrad",
    );
    const b = newRow(
      "destination",
      { title: "Cartagena", date: "2027-02-14", endDate: "2027-02-17" },
      "konrad",
    );
    expect(tripIsToday([a, b], defaults, "2027-02-13")).toBe(true);
    expect(tripIsToday([a, b], defaults, "2027-02-18")).toBe(false);
  });
  it("uses Colombia midnight rather than a European device timezone", () => {
    expect(colombiaDate(new Date("2027-02-12T03:30:00Z"))).toBe("2027-02-11");
    expect(colombiaDate(new Date("2027-02-12T05:00:00Z"))).toBe("2027-02-12");
  });
  it("recognizes a trip day from chapter dates even when nothing is scheduled", () => {
    const chapter = newRow(
      "destination",
      { title: "Bogotá", date: "2027-02-10", endDate: "2027-02-12" },
      "konrad",
    );
    expect(tripIsToday([chapter], defaults, "2027-02-11")).toBe(true);
    expect(tripIsToday([chapter], defaults, "2027-02-13")).toBe(false);
  });
  it("includes overnight arrivals on the right day and sorts by arrival time", () => {
    const travel = newRow(
      "travel",
      {
        title: "Night bus",
        date: "2027-02-11",
        time: "23:00",
        arrivalDate: "2027-02-12",
        arrivalTime: "06:00",
      },
      "janek",
    );
    const coffee = newRow(
      "activity",
      { title: "Coffee", date: "2027-02-12", time: "09:00" },
      "gaba",
    );
    expect(
      todaySchedule([coffee, travel], "2027-02-12").map((r) => r.data.title),
    ).toEqual(["Night bus", "Coffee"]);
    expect(todaySchedule([coffee, travel], "2027-02-11")).toEqual([travel]);
  });
});
