import { NextRequest, NextResponse } from "next/server";

import { createUserSession } from "@/lib/auth/session";
import { registerDemoUser } from "@/lib/demo/auth";
import { createDemoSession, isDemoModeEnabled } from "@/lib/demo/session";
import { readRequestBody } from "@/lib/http/read-request-body";
import { buildRedirectUrl } from "@/lib/http/request-origin";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { registerSchema } from "@/lib/validations/auth";
import { registerUser } from "@/server/auth/auth-service";
import { isDatabaseReachable, markDatabaseUnavailable } from "@/server/services/database-availability";
import { isInfrastructureUnavailableError } from "@/server/services/infrastructure-error";
import { generateOpaqueToken } from "@/server/auth/tokens";
import { isServiceError } from "@/server/services/service-error";
import { logSecurityEvent, logServerError } from "@/server/observability/logger";

function redirectWithError(request: NextRequest, message: string) {
  const url = buildRedirectUrl(request, "/registro");
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}

function redirectWithSuccess(request: NextRequest, pathname: string) {
  return NextResponse.redirect(buildRedirectUrl(request, pathname), 303);
}

export async function POST(request: NextRequest) {
  let parsedInput:
    | {
        firstName: string;
        lastName: string;
        email: string;
        password: string;
        confirmPassword: string;
        acceptLegal: boolean;
      }
    | null = null;
  const wantsRedirect = !(request.headers.get("content-type") ?? "").includes(
    "application/json",
  );

  try {
    const requestBody = await readRequestBody(request);
    assertSameOrigin(request, { fallbackCsrfToken: requestBody.csrfToken });
    const requestMeta = getRequestMeta(request);

    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "register"),
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.success) {
      logSecurityEvent("rate_limit_register", {
        ipAddress: requestMeta.ipAddress,
      });
      if (wantsRedirect) {
        return redirectWithError(
          request,
          "Demasiados intentos. Intenta de nuevo más tarde.",
        );
      }

      return NextResponse.json(
        { error: "Demasiados intentos. Intenta de nuevo más tarde." },
        { status: 429 },
      );
    }

    const parsed = registerSchema.safeParse(requestBody);

    if (!parsed.success) {
      if (wantsRedirect) {
        return redirectWithError(
          request,
          parsed.error.issues[0]?.message ?? "Datos inválidos.",
        );
      }

      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
        { status: 400 },
      );
    }
    parsedInput = parsed.data;

    if (isDemoModeEnabled() && !(await isDatabaseReachable())) {
      const demoProfile = await registerDemoUser(parsed.data);
      await createDemoSession(demoProfile);

      if (wantsRedirect) {
        return redirectWithSuccess(request, "/dashboard");
      }

      return NextResponse.json({
        ok: true,
        redirectTo: "/dashboard",
        demoMode: true,
      });
    }

    const user = await registerUser(parsed.data, requestMeta);
    const rawToken = generateOpaqueToken();
    await createUserSession(user.id, rawToken);

    if (wantsRedirect) {
      return redirectWithSuccess(request, "/onboarding");
    }

    return NextResponse.json({
      ok: true,
      redirectTo: "/onboarding",
    });
  } catch (error) {
    if (isServiceError(error)) {
      if (wantsRedirect) {
        return redirectWithError(request, error.message);
      }

      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isInfrastructureUnavailableError(error)) {
      markDatabaseUnavailable();

      if (isDemoModeEnabled() && parsedInput) {
        try {
          const demoProfile = await registerDemoUser(parsedInput);
          await createDemoSession(demoProfile);

          if (wantsRedirect) {
            return redirectWithSuccess(request, "/dashboard");
          }

          return NextResponse.json({
            ok: true,
            redirectTo: "/dashboard",
            demoMode: true,
          });
        } catch (demoError) {
          if (isServiceError(demoError)) {
            if (wantsRedirect) {
              return redirectWithError(request, demoError.message);
            }

            return NextResponse.json(
              { error: demoError.message },
              { status: demoError.status },
            );
          }

          throw demoError;
        }
      }

      if (wantsRedirect) {
        return redirectWithError(
          request,
          "El registro no está disponible ahora mismo. Intenta de nuevo en unos minutos.",
        );
      }

      return NextResponse.json(
        { error: "El registro no está disponible ahora mismo. Intenta de nuevo en unos minutos." },
        { status: 503 },
      );
    }

    logServerError("Register route failed", { error });

    if (wantsRedirect) {
      return redirectWithError(request, "No fue posible completar el registro.");
    }

    return NextResponse.json(
      { error: "No fue posible completar el registro." },
      { status: 500 },
    );
  }
}
