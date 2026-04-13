import { NextRequest, NextResponse } from "next/server";

import { createUserSession } from "@/lib/auth/session";
import { authenticateDemoUser, getDemoAuthHint } from "@/lib/demo/auth";
import { createDemoSession, isDemoModeEnabled } from "@/lib/demo/session";
import { readRequestBody } from "@/lib/http/read-request-body";
import { buildRedirectUrl } from "@/lib/http/request-origin";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { loginSchema } from "@/lib/validations/auth";
import { apiBadRequest, apiRateLimited } from "@/server/api/api-response";
import { authenticateUser } from "@/server/auth/auth-service";
import { isDatabaseReachable, markDatabaseUnavailable } from "@/server/services/database-availability";
import { isInfrastructureUnavailableError } from "@/server/services/infrastructure-error";
import { generateOpaqueToken } from "@/server/auth/tokens";
import { isServiceError } from "@/server/services/service-error";
import { logSecurityEvent, logServerError } from "@/server/observability/logger";

function redirectWithError(request: NextRequest, message: string) {
  const url = buildRedirectUrl(request, "/login");
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}

function redirectWithSuccess(request: NextRequest, pathname: string) {
  return NextResponse.redirect(buildRedirectUrl(request, pathname), 303);
}

function jsonAuthResponse(body: Record<string, unknown>, status: number) {
  const headers = new Headers();

  if (status >= 400 || status === 401 || status === 403) {
    headers.set("cache-control", "no-store, max-age=0");
  }

  return NextResponse.json(body, { status, headers });
}

export async function POST(request: NextRequest) {
  let parsedInput: { email: string; password: string } | null = null;
  const wantsRedirect = !(request.headers.get("content-type") ?? "").includes(
    "application/json",
  );

  try {
    const body = await readRequestBody(request);
    assertSameOrigin(request, { fallbackCsrfToken: body.csrfToken });
    const requestMeta = getRequestMeta(request);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      if (wantsRedirect) {
        return redirectWithError(
          request,
          parsed.error.issues[0]?.message ?? "Datos inválidos.",
        );
      }

      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }
    parsedInput = parsed.data;

    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "login", parsed.data.email),
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.success) {
      logSecurityEvent("rate_limit_login", {
        email: parsed.data.email,
        ipAddress: requestMeta.ipAddress,
      });

      if (wantsRedirect) {
        return redirectWithError(
          request,
          "Demasiados intentos. Intenta más tarde.",
        );
      }

      return apiRateLimited("Demasiados intentos. Intenta más tarde.", rateLimit.resetAt);
    }

    if (isDemoModeEnabled() && !(await isDatabaseReachable())) {
      const demoProfile = await authenticateDemoUser(parsed.data);

      if (!demoProfile) {
        const message = getDemoAuthHint();

        if (wantsRedirect) {
          return redirectWithError(request, message);
        }

        return jsonAuthResponse({ error: message }, 401);
      }

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

    const user = await authenticateUser(parsed.data, requestMeta);
    const rawToken = generateOpaqueToken();
    await createUserSession(user.id, rawToken);

    if (wantsRedirect) {
      return redirectWithSuccess(
        request,
        user.onboardingCompleted ? "/dashboard" : "/onboarding",
      );
    }

    return NextResponse.json({
      ok: true,
      redirectTo: user.onboardingCompleted ? "/dashboard" : "/onboarding",
    });
  } catch (error) {
    if (isServiceError(error)) {
      const payload = {
        error: error.message,
        ...(error.code === "MFA_REQUIRED" || error.code === "MFA_INVALID"
          ? { mfaRequired: true }
          : {}),
      };

      if (wantsRedirect) {
        return redirectWithError(request, error.message);
      }

      return jsonAuthResponse(payload, error.status);
    }

    if (isInfrastructureUnavailableError(error)) {
      markDatabaseUnavailable();

      if (isDemoModeEnabled()) {
        const demoProfile = parsedInput ? await authenticateDemoUser(parsedInput) : null;

        if (demoProfile) {
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

        const message = getDemoAuthHint();

        if (wantsRedirect) {
          return redirectWithError(request, message);
        }

        return jsonAuthResponse({ error: message }, 401);
      }

      if (wantsRedirect) {
        return redirectWithError(
          request,
          "El acceso no está disponible ahora mismo. Intenta de nuevo en unos minutos.",
        );
      }

      return jsonAuthResponse(
        { error: "El acceso no está disponible ahora mismo. Intenta de nuevo en unos minutos." },
        503,
      );
    }

    logServerError("Login route failed", { error });

    if (wantsRedirect) {
      return redirectWithError(request, "No se pudo iniciar sesión.");
    }

    return jsonAuthResponse({ error: "No se pudo iniciar sesión." }, 500);
  }
}
