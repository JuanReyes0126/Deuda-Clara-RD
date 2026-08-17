import { expect, test, type Page } from "@playwright/test";

test.setTimeout(90_000);

async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("DeudaClara123!");
  await page.getByRole("button", { name: "Entrar a mi panel" }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 30_000 });
}

test("recalcula el simulador de cartera (demo Premium)", async ({ page }) => {
  await loginAs(page, "demo@deudaclarard.com");

  await page.goto("/simulador");
  await page.getByLabel("Extra mensual (opcional)").fill("4000");
  await page.getByRole("button", { name: "Actualizar proyección" }).click();
  await expect(page.getByRole("heading", { name: "Resumen del plan base" })).toBeVisible();
});

test("exporta reporte CSV (admin Pro)", async ({ page }) => {
  await loginAs(page, "admin@deudaclarard.com");

  await page.goto("/reportes");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar CSV" }).click(),
  ]);

  expect(download.suggestedFilename()).toContain("reporte-deuda-clara");
});
