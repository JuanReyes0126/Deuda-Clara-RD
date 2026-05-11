import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

test("registro y onboarding inicial", async ({ page }) => {
  const uniqueEmail = `qa-${Date.now()}@example.com`;

  await page.goto("/registro");
  await page.getByLabel("Nombre").fill("QA");
  await page.getByLabel("Apellido").fill("Tester");
  await page.getByLabel("Correo electrónico").fill(uniqueEmail);
  await page.locator("#password").fill("DeudaClara123!");
  await page.locator("#confirmPassword").fill("DeudaClara123!");
  await page.locator("#acceptLegal").check();
  await page.getByRole("button", { name: "Crear cuenta y continuar" }).click();

  await expect(page).toHaveURL(/onboarding/, { timeout: 30_000 });
  await page.getByLabel("Ingreso mensual (RD$)").fill("42000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Tarjeta" }).click();
  await page.getByLabel("Nombre").fill("Tarjeta Gold");
  await page.getByLabel("Balance (RD$)").fill("95000");
  await page.getByLabel("Pago mínimo (RD$)").fill("6500");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Monto mensual disponible (RD$)").fill("18000");
  await page.getByRole("button", { name: "Ver mi plan inicial" }).click();
  await page.getByRole("button", { name: "Abrir mi panel" }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 30_000 });
});

test("login con usuario demo", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("demo@deudaclarard.com");
  await page.getByLabel("Contraseña", { exact: true }).fill("DeudaClara123!");
  await page.getByRole("button", { name: "Entrar a mi panel" }).click();

  await expect(page).toHaveURL(/dashboard/, { timeout: 30_000 });
});

test("recuperacion de contrasena muestra confirmacion segura", async ({ page }) => {
  await page.goto("/recuperar-contrasena");
  await page.getByLabel("Correo electrónico").fill("demo@deudaclarard.com");
  await page.getByRole("button", { name: "Enviar enlace seguro" }).click();

  await expect(page.getByText("Si el correo existe en el sistema")).toBeVisible();
});
