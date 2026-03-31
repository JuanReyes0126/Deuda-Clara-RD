import { expect, test } from "@playwright/test";

test("registro y onboarding inicial", async ({ page }) => {
  const uniqueEmail = `qa-${Date.now()}@example.com`;

  await page.goto("/registro");
  await page.getByLabel("Nombre").fill("QA");
  await page.getByLabel("Apellido").fill("Tester");
  await page.getByLabel("Correo electrónico").fill(uniqueEmail);
  await page.getByLabel("Contraseña").fill("DeudaClara123!");
  await page.getByLabel("Confirmar contraseña").fill("DeudaClara123!");
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page).toHaveURL(/onboarding/);
  await page.getByLabel("Presupuesto mensual para deudas \\(RD\\$\\)").fill("15000");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(page).toHaveURL(/dashboard/);
});

test("login con usuario demo", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("demo@deudaclarard.com");
  await page.getByLabel("Contraseña").fill("DeudaClara123!");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page).toHaveURL(/dashboard/);
});

test("recuperacion de contrasena muestra confirmacion segura", async ({ page }) => {
  await page.goto("/recuperar-contrasena");
  await page.getByLabel("Correo electrónico").fill("demo@deudaclarard.com");
  await page.getByRole("button", { name: "Enviar enlace seguro" }).click();

  await expect(page.getByText("Si el correo existe en el sistema")).toBeVisible();
});
