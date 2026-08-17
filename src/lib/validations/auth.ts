import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(72, "La contraseña no puede exceder 72 caracteres.")
  .regex(/[A-Z]/, "La contraseña debe incluir al menos una mayúscula.")
  .regex(/[a-z]/, "La contraseña debe incluir al menos una minúscula.")
  .regex(/\d/, "La contraseña debe incluir al menos un número.");

const legalAcceptanceSchema = z.preprocess(
  (value) => value === true || value === "true" || value === "on",
  z
    .boolean()
    .refine((value) => value, {
      message:
        "Debes aceptar los Términos y Condiciones y la Política de Privacidad.",
    }),
);

export const registerSchema = z.object({
  firstName: z.string().trim().min(2, "El nombre es obligatorio.").max(60),
  lastName: z.string().trim().min(2, "El apellido es obligatorio.").max(60),
  email: z.string().trim().toLowerCase().email("Correo electrónico inválido."),
  password: passwordSchema,
  confirmPassword: z.string(),
  acceptLegal: legalAcceptanceSchema,
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "Las contraseñas no coinciden.",
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo electrónico inválido."),
  password: z.string().min(1, "La contraseña es obligatoria."),
  totpCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código debe tener 6 dígitos.")
    .optional()
    .or(z.literal("")),
  recoveryCode: z.string().trim().max(20).optional().or(z.literal("")),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo electrónico inválido."),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, "Token inválido."),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "Las contraseñas no coinciden.",
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es obligatoria."),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "Las contraseñas no coinciden.",
});

export const verifyTotpSetupSchema = z.object({
  totpCode: z.string().trim().regex(/^\d{6}$/, "El código debe tener 6 dígitos."),
});

export const disableTotpSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es obligatoria."),
  totpCode: z.string().trim().regex(/^\d{6}$/, "El código debe tener 6 dígitos."),
});

export const regenerateRecoveryCodesSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es obligatoria."),
});

export const reauthenticateSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es obligatoria."),
  totpCode: z.string().trim().regex(/^\d{6}$/, "El código debe tener 6 dígitos.").optional().or(z.literal("")),
  recoveryCode: z.string().trim().max(20).optional().or(z.literal("")),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type VerifyTotpSetupInput = z.infer<typeof verifyTotpSetupSchema>;
export type DisableTotpInput = z.infer<typeof disableTotpSchema>;
export type RegenerateRecoveryCodesInput = z.infer<typeof regenerateRecoveryCodesSchema>;
export type ReauthenticateInput = z.infer<typeof reauthenticateSchema>;
