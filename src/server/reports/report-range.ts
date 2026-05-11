import { getDefaultReportRange } from "@/server/reports/report-service";
import { ServiceError } from "@/server/services/service-error";

function parseRequestedDate(rawValue: string | null, fallback: Date) {
  if (!rawValue) {
    return fallback;
  }

  const parsed = new Date(rawValue);

  if (Number.isNaN(parsed.getTime())) {
    throw new ServiceError("REPORT_RANGE_INVALID", 400, "Rango de fechas inválido.");
  }

  return parsed;
}

export function parseReportRange(searchParams: URLSearchParams) {
  const defaultRange = getDefaultReportRange();
  const from = parseRequestedDate(searchParams.get("from"), defaultRange.from);
  const to = parseRequestedDate(searchParams.get("to"), defaultRange.to);

  if (from > to) {
    throw new ServiceError(
      "REPORT_RANGE_INVALID",
      400,
      "La fecha inicial no puede ser mayor que la final.",
    );
  }

  return { from, to };
}
