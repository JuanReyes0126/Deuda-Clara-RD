import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.setTimeout(120000);

test("registro demo y navegación principal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Deja de adivinar qué pagar primero." })).toBeVisible();

  // solo verifica que la página cargó
  await expect(page).toHaveURL(/\/$/);

  // registro
  await page.goto("/registro");
  await expect(page.getByRole("heading", { name: "Crear cuenta" })).toBeVisible();
  await expect(page.getByLabel("Nombre")).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear cuenta y continuar" })).toBeVisible();
});

test("login demo y dashboard accesible", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("demo@deudaclarard.com");
  await page.getByLabel("Contraseña", { exact: true }).fill("DeudaClara123!");
  await page.getByRole("button", { name: "Entrar a mi panel" }).click();

  await expect(page).toHaveURL(/dashboard/, { timeout: 30000 });
  await expect(page.getByText("Deuda total real")).toBeVisible();
});
