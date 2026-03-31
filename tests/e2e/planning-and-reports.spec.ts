import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("demo@deudaclarard.com");
  await page.getByLabel("Contraseña").fill("DeudaClara123!");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/dashboard/);
});

test("recalcula el simulador y exporta reporte", async ({ page }) => {
  await page.goto("/simulador");
  await page.getByLabel("Pago extra mensual").fill("4000");
  await page.getByRole("button", { name: "Recalcular escenarios" }).click();
  await expect(page.getByText("Plan base")).toBeVisible();

  await page.goto("/reportes");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar CSV" }).click(),
  ]);

  expect(download.suggestedFilename()).toContain("reporte-deuda-clara");
});
