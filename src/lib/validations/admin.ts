import { UserStatus } from "@prisma/client";
import { z } from "zod";

import {
  longTextSchema,
  normalizedTextSchema,
} from "@/lib/validations/common";

export const userStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

export const emailTemplateSchema = z.object({
  name: normalizedTextSchema(120),
  subject: normalizedTextSchema(160),
  htmlContent: longTextSchema(),
  textContent: longTextSchema(),
  isActive: z.boolean(),
});
