import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "@/lib/validations/auth";

describe("auth email normalization", () => {
  it("normaliza el correo en registro", () => {
    const parsed = registerSchema.parse({
      firstName: "Carla",
      lastName: "Perez",
      email: "  Carla.Perez@Example.COM ",
      password: "DeudaClara123",
      confirmPassword: "DeudaClara123",
      acceptLegal: true,
    });

    expect(parsed.email).toBe("carla.perez@example.com");
  });

  it("normaliza el correo en login", () => {
    const parsed = loginSchema.parse({
      email: "  DEMO@DeudaClaraRD.com ",
      password: "DeudaClara123",
    });

    expect(parsed.email).toBe("demo@deudaclarard.com");
  });

  it("rechaza registro si falta la aceptación legal", () => {
    expect(() =>
      registerSchema.parse({
        firstName: "Carla",
        lastName: "Perez",
        email: "carla@example.com",
        password: "DeudaClara123",
        confirmPassword: "DeudaClara123",
        acceptLegal: false,
      }),
    ).toThrow("Debes aceptar los Términos y Condiciones y la Política de Privacidad.");
  });
});
