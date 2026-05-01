import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("demo@deudaclarard.com");
  await page.getByLabel("Contraseña", { exact: true }).fill("DeudaClara123!");
  await page.getByRole("button", { name: "Entrar a mi panel" }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 30_000 });
});

test("crear deuda y registrar pago", async ({ page }) => {
  const debtName = `Prestamo QA ${Date.now()}`;

  await page.goto("/deudas");
  await page.getByLabel("Nombre").fill(debtName);
  await page.locator("#creditorName").selectOption("__OTHER_CREDITOR__");
  await expect(page.locator("#creditorNameCustom")).toBeVisible();
  await page.locator("#creditorNameCustom").fill("Banco de Pruebas");
  await page.getByLabel("Saldo actual").fill("25000");
  await page.getByLabel("Tasa").fill("24");
  await page.getByLabel("Pago mínimo").fill("2500");
  await page.getByRole("button", { name: "Crear deuda" }).click();

  await expect(page.getByText(debtName)).toBeVisible();

  await page.goto("/pagos");
  const debtOptionValue = await page
    .locator("select#debtId option", { hasText: debtName })
    .first()
    .getAttribute("value");
  await page.getByLabel("Deuda").selectOption(debtOptionValue ?? "");
  await page.getByLabel("Monto del pago").fill("5000");
  await page.getByRole("button", { name: "Registrar pago" }).click();

  await expect(page.getByText(debtName)).toBeVisible();
  await expect(page.getByText("Saldo luego del pago")).toBeVisible();
});
