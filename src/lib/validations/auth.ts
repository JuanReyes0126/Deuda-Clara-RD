import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(72, "La contraseña no puede exceder 72 caracteres.")
  .regex(/[A-Z]/, "La contraseña debe incluir al menos una mayúscula.")
  .regex(/[a-z]/, "La contraseña debe incluir al menos una minúscula.")
  .regex(/\d/, "La contraseña debe incluir al menos un número.");

export const registerSchema = z.object({
  firstName: z.string().trim().min(2, "El nombre es obligatorio.").max(60),
  lastName: z.string().trim().min(2, "El apellido es obligatorio.").max(60),
  email: z.string().trim().toLowerCase().email("Correo electrónico inválido."),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "Las contraseñas no coinciden.",
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo electrónico inválido."),
  password: z.string().min(1, "La contraseña es obligatoria."),
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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
