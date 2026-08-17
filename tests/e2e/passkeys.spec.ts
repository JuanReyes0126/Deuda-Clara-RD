import { expect, test } from "@playwright/test";

async function installVirtualAuthenticator(page: import("@playwright/test").Page) {
  const client = await page.context().newCDPSession(page);

  await client.send("WebAuthn.enable");

  const { authenticatorId } = await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  return { client, authenticatorId };
}

async function waitForCsrfCookie(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => document.cookie.includes("dc_csrf="));
}

async function registerUserViaBrowser(
  page: import("@playwright/test").Page,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  },
) {
  return page.evaluate(async (payload) => {
    const csrfCookie = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith("dc_csrf="));
    const csrfToken = csrfCookie?.slice("dc_csrf=".length);

    const response = await fetch("/api/auth/registrar", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "x-csrf-token": decodeURIComponent(csrfToken) } : {}),
      },
      body: JSON.stringify({
        ...payload,
        confirmPassword: payload.password,
        acceptLegal: true,
      }),
    });

    return {
      ok: response.ok,
      status: response.status,
      body: await response.json().catch(() => null),
    };
  }, input);
}

async function completeOnboardingViaBrowser(
  page: import("@playwright/test").Page,
  input: {
    monthlyIncome: number;
    monthlyHousingCost: number;
    monthlyGroceriesCost: number;
    monthlyUtilitiesCost: number;
    monthlyTransportCost: number;
    monthlyOtherEssentialExpenses: number;
    monthlyDebtBudget: number;
    debts: Array<{
      name: string;
      presetType: "CREDIT_CARD" | "PERSONAL_LOAN";
      currentBalance: number;
      minimumPayment: number;
      interestRate?: number;
    }>;
  },
) {
  return page.evaluate(async (payload) => {
    const csrfCookie = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith("dc_csrf="));
    const csrfToken = csrfCookie?.slice("dc_csrf=".length);

    const response = await fetch("/api/auth/onboarding", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "x-csrf-token": decodeURIComponent(csrfToken) } : {}),
      },
      body: JSON.stringify(payload),
    });

    return {
      ok: response.ok,
      status: response.status,
      body: await response.json().catch(() => null),
    };
  }, input);
}

test.describe.configure({ mode: "serial" });
test.setTimeout(120000);

test("registro de passkey y login posterior con WebAuthn", async ({ page }) => {
  const { client, authenticatorId } = await installVirtualAuthenticator(page);
  const uniqueEmail = `qa-passkey-${Date.now()}@example.com`;

  try {
    await page.goto("/registro");
    await waitForCsrfCookie(page);
    const registration = await registerUserViaBrowser(page, {
      firstName: "Clara",
      lastName: "Passkey",
      email: uniqueEmail,
      password: "DeudaClara123!",
    });

    expect(registration.ok).toBe(true);

    await page.goto("/onboarding");
    await waitForCsrfCookie(page);
    const onboarding = await completeOnboardingViaBrowser(page, {
      monthlyIncome: 42_000,
      monthlyHousingCost: 0,
      monthlyGroceriesCost: 0,
      monthlyUtilitiesCost: 0,
      monthlyTransportCost: 0,
      monthlyOtherEssentialExpenses: 0,
      monthlyDebtBudget: 18_000,
      debts: [
        {
          name: "Tarjeta Gold",
          presetType: "CREDIT_CARD",
          currentBalance: 95_000,
          minimumPayment: 6_500,
          interestRate: 54,
        },
      ],
    });

    expect(onboarding.ok).toBe(true);

    await page.goto("/configuracion");
    await expect(
      page.getByRole("heading", { name: "Passkeys" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Registrar este dispositivo" }).click();
    await expect(page.getByText("Passkey agregada.")).toBeVisible();
    await expect(page.getByText("1 dispositivo protegido")).toBeVisible();

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/login/);

    await waitForCsrfCookie(page);
    await page.getByLabel("Correo electrónico").fill(uniqueEmail);
    await page.getByRole("button", { name: "Entrar con passkey" }).click();

    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByText("Tu siguiente mejor paso")).toBeVisible();
  } finally {
    await client
      .send("WebAuthn.removeVirtualAuthenticator", {
        authenticatorId,
      })
      .catch(() => undefined);
    await client.send("WebAuthn.disable").catch(() => undefined);
  }
});
