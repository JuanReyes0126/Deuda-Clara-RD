import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.setTimeout(120000);

test("registro demo y navegación principal", async ({ page }) => {
  const uniqueEmail = `qa-review-${Date.now()}@example.com`;

  await page.goto("/");
  await expect(
    page.getByText("Entiende cuanto debes de verdad y sal con un plan inteligente."),
  ).toBeVisible();

  await page.goto("/registro");
  await page.getByLabel("Nombre").fill("Clara");
  await page.getByLabel("Apellido").fill("Revisión");
  await page.getByLabel("Correo electrónico").fill(uniqueEmail);
  await page.getByLabel("Contraseña", { exact: true }).fill("DeudaClara123!");
  await page.getByLabel("Confirmar contraseña").fill("DeudaClara123!");
  await page.getByRole("button", { name: /Crear cuenta/ }).click();

  await expect(page).toHaveURL(/dashboard/, { timeout: 30000 });
  await expect(page.getByText("Siguiente mejor acción")).toBeVisible();

  await page.goto("/deudas", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Registrar deuda" }),
  ).toBeVisible();

  await page.goto("/pagos", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Registrar pago" }),
  ).toBeVisible();

  await page.goto("/reportes", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Reporte mensual" }),
  ).toBeVisible();

  await page.goto("/planes", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Desbloquea la capa premium")).toBeVisible();

  await page.goto("/notificaciones", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Centro de notificaciones" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/login/, { timeout: 30000 });
});

test("login demo y dashboard accesible", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("demo@deudaclarard.com");
  await page.getByLabel("Contraseña", { exact: true }).fill("DeudaClara123!");
  await page.getByRole("button", { name: "Entrar a mi panel" }).click();

  await expect(page).toHaveURL(/dashboard/, { timeout: 30000 });
  await expect(page.getByText("Siguiente mejor acción")).toBeVisible();
});
