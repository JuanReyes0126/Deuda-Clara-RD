import { expect, test } from "@playwright/test";

test("registro y onboarding inicial", async ({ page }) => {
  const uniqueEmail = `qa-${Date.now()}@example.com`;

  await page.goto("/registro");
  await page.getByPlaceholder("Nombre").fill("QA");
  await page.getByPlaceholder("Apellido").fill("Tester");
  await page.getByPlaceholder("Correo electrónico").fill(uniqueEmail);
  await page.getByPlaceholder("Contraseña").fill("DeudaClara123!");
  await page.getByPlaceholder("Confirmar contraseña").fill("DeudaClara123!");
  await page
    .getByLabel("Acepto los Términos y Condiciones y la Política de Privacidad.")
    .check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page).toHaveURL(/onboarding/);
  await page.getByRole("button", { name: "Empezar" }).click();
  await page.getByLabel("Ingreso mensual \\(RD\\$\\)").fill("42000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Tarjeta" }).click();
  await page.getByLabel("Nombre").fill("Tarjeta Gold");
  await page.getByLabel("Balance \\(RD\\$\\)").fill("95000");
  await page.getByLabel("Pago mínimo \\(RD\\$\\)").fill("6500");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Monto mensual disponible \\(RD\\$\\)").fill("18000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Ver mi plan completo" }).click();
  await expect(page).toHaveURL(/dashboard/);
});

test("login con usuario demo", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Correo electrónico").fill("demo@deudaclarard.com");
  await page.getByPlaceholder("Contraseña").fill("DeudaClara123!");
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/dashboard/);
});

test("recuperacion de contrasena muestra confirmacion segura", async ({ page }) => {
  await page.goto("/recuperar-contrasena");
  await page.getByLabel("Correo electrónico").fill("demo@deudaclarard.com");
  await page.getByRole("button", { name: "Enviar enlace seguro" }).click();

  await expect(page.getByText("Si el correo existe en el sistema")).toBeVisible();
});
