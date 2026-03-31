import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.setTimeout(120000);

test("registro demo y navegación principal", async ({ page }) => {
  const uniqueEmail = `qa-review-${Date.now()}@example.com`;

  await page.goto("/");
  await expect(
    page.getByText("Entiende cuanto debes de verdad y sal con un plan inteligente."),
  ).toBeVisible();

  // solo verifica que la página cargó
await expect(page).toHaveURL(/\/$/);

// registro
await page.goto("/registro");

await page.getByPlaceholder("Nombre").fill("Clara");
await page.getByPlaceholder("Apellido").fill("Revision");
await page.getByPlaceholder("Correo electrónico").fill(uniqueEmail);
await page.getByPlaceholder("Contraseña").fill("DeudaClara123!");
await page.getByPlaceholder("Confirmar contraseña").fill("DeudaClara123!");

await page.locator('button[type="submit"]').click();
 

await page.waitForURL(/dashboard/, { timeout: 30000 });
await expect(page.locator("body")).toBeVisible();

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
