import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
async function onboard(page: any) {
  await page.goto("/");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Konrad/ }).click();
  await dialog.getByRole("button", { name: "Let’s make some plans" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function nav(page: any, label: string) {
  await page
    .locator(".sidebar")
    .getByRole("button", { name: label, exact: true })
    .click();
}
test("plans, stays, votes, expenses, documents, backups, and mobile layouts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await onboard(page);
  await expect(page.getByRole("heading", { name: /¡Vamos/ })).toBeVisible();
  await page.getByRole("button", { name: /Make a plan/ }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Sunset in Getsemaní");
  await dialog.getByLabel("Destination", { exact: true }).fill("Cartagena");
  await dialog.getByLabel("Date", { exact: true }).fill("2027-02-12");
  await dialog.getByLabel("Time", { exact: true }).fill("17:00");
  await dialog.getByLabel("Notes (optional)").fill("Meet in the plaza.");
  await dialog.getByRole("button", { name: "Add to the trip" }).click();
  await nav(page, "Itinerary");
  await expect(page.locator(".plan-item")).toContainText("Sunset in Getsemaní");
  await page.getByRole("button", { name: "Edit Sunset in Getsemaní" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Sunset with the crew");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await page.reload();
  await nav(page, "Itinerary");
  await expect(page.locator(".plan-item")).toContainText(
    "Sunset with the crew",
  );
  await nav(page, "Stays");
  await page
    .getByRole("button", { name: "Save a stay", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("Our Cartagena courtyard");
  await dialog.getByLabel("Destination", { exact: true }).fill("Cartagena");
  await dialog
    .getByLabel("Booking / Airbnb link")
    .fill("https://www.airbnb.com/rooms/123");
  await dialog.getByLabel("Total stay price (optional)").fill("300");
  await dialog.getByRole("button", { name: "Add to the trip" }).click();
  await page.getByRole("button", { name: "Vote for this" }).click();
  await expect(page.getByRole("button", { name: "Your pick" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await nav(page, "Expenses");
  await page
    .getByRole("button", { name: "Add an expense", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("What was it for?").fill("Airport taxi");
  await dialog.getByLabel("Amount", { exact: true }).fill("45000");
  await dialog.getByRole("button", { name: "Add to the trip" }).click();
  await expect(page.locator(".spend-total")).toHaveText("€10.00");
  await expect(page.locator(".balance-people")).toContainText("€7.50");
  await page
    .getByRole("button", { name: "Add an expense", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("What was it for?").fill("Different dinners");
  await dialog.getByLabel("Currency", { exact: true }).selectOption("EUR");
  await dialog.getByLabel("Amount", { exact: true }).fill("30");
  await dialog.getByLabel("Use custom amounts").check();
  await dialog.getByLabel("Gaba · EUR").fill("10");
  await dialog.getByLabel("Janek · EUR").fill("5");
  await dialog.getByLabel("Konrad · EUR").fill("5");
  await dialog.getByLabel("Julia · EUR").fill("10");
  await dialog.getByRole("button", { name: "Add to the trip" }).click();
  await expect(page.locator(".spend-total")).toHaveText("€40.00");
  await page
    .locator(".converter-card")
    .getByLabel("Amount", { exact: true })
    .fill("90000");
  await expect(page.locator(".converter-card output")).toHaveText("€20.00");
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Yes, paid" })
    .click();
  await expect(page.locator(".payment-history")).toBeVisible();
  await nav(page, "Documents");
  await page
    .getByRole("button", { name: "Add a document", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Document name").fill("Flight confirmation");
  await dialog
    .locator("input[type=file]")
    .setInputFiles({
      name: "flight.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("A test confirmation for the crew."),
    });
  await dialog.getByRole("button", { name: "Save document" }).click();
  await expect(page.locator(".document-row")).toContainText(
    "Flight confirmation",
  );
  let downloadEvent = page.waitForEvent("download");
  await page
    .locator(".document-row")
    .getByRole("button", { name: "Download", exact: true })
    .click();
  const doc = await downloadEvent;
  expect(doc.suggestedFilename()).toBe("flight.txt");
  await nav(page, "Trip settings");
  downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export a trip backup" }).click();
  const backup = await downloadEvent;
  const backupPath = await backup.path();
  expect(backupPath).toBeTruthy();
  await page
    .locator(".upload-backup input")
    .setInputFiles({
      name: "trip.zip",
      mimeType: "application/zip",
      buffer: await fs.readFile(backupPath!),
    });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Import backup", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "Itinerary");
  await expect(page.locator(".plan-item")).toHaveCount(2);
  await nav(page, "Discover");
  await page
    .getByRole("button", { name: "Save idea", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }).first(),
  ).toBeDisabled();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    for (const label of [
      "The crew",
      "Itinerary",
      "Stays",
      "Discover",
      "Documents",
      "Expenses",
      "Trip settings",
    ]) {
      if (width > 760) await nav(page, label);
      else if (
        label === "Stays" ||
        label === "Documents" ||
        label === "Trip settings"
      ) {
        await page
          .getByRole("navigation", { name: "Mobile navigation" })
          .getByRole("button", { name: "More", exact: true })
          .click();
        await page
          .locator(".mobile-more")
          .getByRole("button", { name: label, exact: true })
          .click();
      } else {
        const mobileLabel = (
          {
            "The crew": "Crew",
            Itinerary: "Plan",
            Discover: "Explore",
            Expenses: "Money",
          } as Record<string, string>
        )[label];
        await page
          .getByRole("navigation", { name: "Mobile navigation" })
          .getByRole("button", { name: mobileLabel, exact: true })
          .click();
      }
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflow, `${label} at ${width}px`).toBe(false);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav(page, "The crew");
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("installed app shell, avatar, and saved plan survive an offline reload", async ({
  page,
  context,
}) => {
  await onboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: /¡Vamos/ })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: /¡Vamos/ })).toBeVisible();
  await expect(page.locator(".connection-banner")).toContainText("offline");
  const loaded = await page
    .locator(".people-grid img")
    .evaluateAll((imgs: any[]) =>
      imgs.every((i) => i.complete && i.naturalWidth > 0),
    );
  expect(loaded).toBe(true);
  await page.getByRole("button", { name: /Make a plan/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Offline coffee stop");
  await dialog.getByLabel("Destination", { exact: true }).fill("Bogotá");
  await dialog.getByRole("button", { name: "Add to the trip" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await nav(page, "Itinerary");
  await expect(page.locator(".plan-item")).toContainText("Offline coffee stop");
  await context.setOffline(false);
});
