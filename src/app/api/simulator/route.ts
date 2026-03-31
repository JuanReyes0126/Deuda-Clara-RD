import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { simulatorSchema } from "@/lib/validations/simulator";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import { runSimulator } from "@/server/simulator/simulator-service";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const parsed = simulatorSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const result = await runSimulator(session.user.id, parsed.data);

    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error, "No se pudo ejecutar el simulador.");
  }
}
