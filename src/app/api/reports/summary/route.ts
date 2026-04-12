import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { isReportRangeAllowed } from "@/lib/feature-access";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import { getUserFeatureAccess } from "@/server/membership/membership-access-service";
import { parseReportRange } from "@/server/reports/report-range";
import { getReportSummary } from "@/server/reports/report-service";
import { ServiceError } from "@/server/services/service-error";

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const { from, to } = parseReportRange(searchParams);
    const access = await getUserFeatureAccess(session.user.id);

    if (!isReportRangeAllowed(access, from, to)) {
      throw new ServiceError(
        "REPORT_RANGE_LOCKED",
        403,
        `Tu plan ${access.isBase ? "Base" : access.isPremium ? "Premium" : "Pro"} permite reportes de hasta ${access.maxReportRangeDays} días.`,
      );
    }

    const summary = await getReportSummary(session.user.id, from, to);

    return NextResponse.json({ summary });
  } catch (error) {
    return handleApiError(error, "No se pudo construir el reporte.");
  }
}
