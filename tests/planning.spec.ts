import { test, expect } from "@playwright/test";
test("chapter days, linked stays, overnight tickets, today and the country guide", async ({
  page,
  context,
}) => {
  await page.clock.install({ time: new Date("2027-02-12T15:00:00Z") });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Konrad/ }).click();
  await dialog.getByRole("button", { name: "Let’s make some plans" }).click();
  await expect(dialog).toHaveCount(0);
  const nav = async (name: string) =>
    page.locator(".sidebar").getByRole("button", { name, exact: true }).click();
  await nav("Itinerary");
  const bogota = page.getByRole("region", {
    name: "Bogotá chapter",
    exact: true,
  });
  await bogota.locator('summary[aria-label="More options for Bogotá"]').click();
  await bogota
    .getByRole("button", { name: "Edit chapter", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("First day here").fill("2027-02-11");
  await dialog.getByLabel("Last day here").fill("2027-02-13");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Open Bogotá chapter" }).click();
  await expect(page.locator(".chapter-day")).toHaveCount(3);
  await expect(
    page.getByRole("region", { name: "Cartagena chapter", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Add a plan in Bogotá on 2027-02-12",
      exact: true,
    })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Which day?")).toHaveValue("2027-02-12");
  await dialog.getByRole("button", { name: "Eat something good" }).click();
  await dialog.getByLabel("What are we doing?").fill("Ajiaco with the crew");
  await dialog.getByLabel("Start time", { exact: true }).fill("12:30");
  await dialog.getByRole("button", { name: "Add to our day" }).click();
  await expect(dialog).toHaveCount(0);
  const activity = page
    .locator(".chapter-activity")
    .filter({ hasText: "Ajiaco with the crew" });
  await activity
    .getByRole("button", { name: "Link a stay", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Add a new stay" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("What’s the place called?").fill("Casa Bogotá");
  await dialog.getByLabel("Check-in", { exact: true }).fill("2027-02-11");
  await dialog.getByLabel("Check-out", { exact: true }).fill("2027-02-13");
  await dialog.getByRole("button", { name: "Booked ✓", exact: true }).click();
  await dialog
    .getByLabel("Booking / Airbnb link")
    .fill("https://example.com/our-stay");
  await dialog.getByRole("button", { name: "Save this stay" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(activity.locator(".plan-linked-stays")).toContainText(
    "Casa Bogotá",
  );
  await page
    .getByRole("button", { name: /How are we getting to Cartagena/ })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Bus", exact: true }).click();
  await dialog.getByLabel("Departure date", { exact: true }).fill("2027-02-12");
  await dialog.getByLabel("Departure time", { exact: true }).fill("23:00");
  await dialog.getByLabel("Arrival date", { exact: true }).fill("2027-02-13");
  await dialog.getByLabel("Arrival time", { exact: true }).fill("08:00");
  await dialog
    .getByLabel("Attach tickets now (optional)")
    .setInputFiles({
      name: "bus-ticket.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nA local test ticket"),
    });
  await dialog.getByRole("button", { name: "Save the journey" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".journey-card")).toContainText("23:00");
  await expect(page.locator(".journey-card")).toContainText("08:00");
  await expect(page.locator(".journey-card .attachment")).toHaveCount(1);
  let event = page.waitForEvent("download");
  await page.locator(".journey-card .attachment").click();
  expect((await event).suggestedFilename()).toBe("bus-ticket.pdf");
  await nav("The crew");
  const today = page.getByRole("region", { name: "Today's plan" });
  await expect(today).toContainText("Ajiaco with the crew");
  await expect(today).toContainText("Casa Bogotá");
  await expect(today).toContainText("23:00");
  await nav("Discover");
  await page
    .getByRole("button", { name: "Colombia, explained", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Colombia, at a glance" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "The largest cities" }),
  ).toBeVisible();
  const before = await page.locator(".curiosity-card h3").innerText();
  await page.getByRole("button", { name: "One more curiosity" }).click();
  expect(await page.locator(".curiosity-card h3").innerText()).not.toBe(before);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".curiosity-card")).toContainText("1810");
  await page.screenshot({
    path: "test-results/colombia-guide.png",
    fullPage: true,
  });
  await nav("Itinerary");
  await page.getByRole("button", { name: "Open Bogotá chapter" }).click();
  await page.screenshot({
    path: "test-results/plan-desktop.png",
    fullPage: true,
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: `test-results/plan-mobile-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("button", { name: "Explore", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Colombia, explained", exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("button", { name: "Plan", exact: true })
      .click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav("The crew");
  await page.screenshot({ path: "test-results/today.png", fullPage: true });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Today's plan" }),
  ).toContainText("Ajiaco with the crew");
  await nav("Itinerary");
  await expect(page.locator(".journey-card .attachment")).toHaveCount(1);
  await nav("Discover");
  await page
    .getByRole("button", { name: "Colombia, explained", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Colombia, at a glance" }),
  ).toBeVisible();
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
