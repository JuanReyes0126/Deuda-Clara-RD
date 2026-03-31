import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { differenceInCalendarDays, endOfMonth, format, startOfMonth, subDays } from "date-fns";

import { prisma } from "@/lib/db/prisma";
import type { ReportSummaryDto } from "@/lib/types/app";
import { decimal, toMoneyNumber } from "@/lib/utils/decimal";

type ReportInsightsInput = {
  paymentCount: number;
  totalPaid: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  totalFeesPaid: number;
  topDebtName: string | null;
  topCategoryName: string | null;
};

type RawReportSummary = {
  from: Date;
  to: Date;
  totalPaid: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  totalFeesPaid: number;
  paymentCount: number;
  debtSummary: Array<{ debtId: string; debtName: string; totalPaid: number }>;
  categorySummary: Array<{ type: string; totalPaid: number }>;
};

type ReportComparisonInput = {
  current: {
    paymentCount: number;
    totalPaid: number;
    principalSharePct: number;
    interestAndFeesSharePct: number;
  };
  previous: {
    from: Date;
    to: Date;
    paymentCount: number;
    totalPaid: number;
    principalSharePct: number;
    interestAndFeesSharePct: number;
  };
};

export function buildReportInsights(input: ReportInsightsInput) {
  const principalSharePct =
    input.totalPaid > 0 ? Math.round((input.totalPrincipalPaid / input.totalPaid) * 100) : 0;
  const interestAndFeesSharePct =
    input.totalPaid > 0
      ? Math.round(((input.totalInterestPaid + input.totalFeesPaid) / input.totalPaid) * 100)
      : 0;

  if (input.paymentCount === 0) {
    return {
      principalSharePct,
      interestAndFeesSharePct,
      progressSignal: "STARTING" as const,
      coachingHeadline: "Todavía no hay movimiento en este período",
      coachingSummary:
        "Sin pagos registrados todavía no podemos decir si tu flujo está bajando capital o se está diluyendo en intereses.",
      recommendedNextStep:
        "Registra al menos un pago en este rango para empezar a medir avance real y detectar dónde se te está yendo el dinero.",
    };
  }

  if (input.totalInterestPaid + input.totalFeesPaid >= input.totalPrincipalPaid) {
    return {
      principalSharePct,
      interestAndFeesSharePct,
      progressSignal: "WATCH" as const,
      coachingHeadline: "Demasiado flujo se está yendo en intereses y cargos",
      coachingSummary: `En este período solo ${principalSharePct}% de lo pagado redujo capital. ${
        input.topDebtName ? `${input.topDebtName} fue la deuda que más absorbió flujo.` : ""
      }`.trim(),
      recommendedNextStep: input.topDebtName
        ? `Si vas a empujar más dinero este mes, prioriza ${input.topDebtName} y evita repartir excedente entre varias deudas.`
        : "Si vas a empujar más dinero este mes, concéntralo en una sola deuda prioritaria para que el avance se note.",
    };
  }

  if (principalSharePct >= 70) {
    return {
      principalSharePct,
      interestAndFeesSharePct,
      progressSignal: "STRONG" as const,
      coachingHeadline: "La mayor parte de tu flujo sí está reduciendo capital",
      coachingSummary: `En este período ${principalSharePct}% de lo pagado fue a principal${
        input.topCategoryName ? ` y la categoría con más flujo fue ${input.topCategoryName}.` : "."
      }`,
      recommendedNextStep: input.topDebtName
        ? `Sostén el ritmo y mantén a ${input.topDebtName} como foco principal para capturar más ahorro.`
        : "Sostén el ritmo actual y revisa tu prioridad principal para consolidar el ahorro en intereses.",
    };
  }

  return {
    principalSharePct,
    interestAndFeesSharePct,
    progressSignal: "WATCH" as const,
    coachingHeadline: "Tu avance existe, pero todavía se diluye más de lo ideal",
    coachingSummary: `Ya estás empujando capital, pero ${interestAndFeesSharePct}% de tu flujo sigue yéndose a intereses y cargos.`,
    recommendedNextStep: input.topDebtName
      ? `Conviene concentrar más flujo en ${input.topDebtName} para que el próximo período deje una mejor proporción a principal.`
      : "Conviene concentrar más flujo en una deuda principal para que el próximo período deje mejor proporción a capital.",
  };
}

export function buildReportComparison(input: ReportComparisonInput) {
  const previousRangeLabel = `${format(input.previous.from, "dd/MM")} - ${format(input.previous.to, "dd/MM")}`;

  if (input.previous.paymentCount === 0 && input.current.paymentCount === 0) {
    return {
      signal: "NO_BASELINE" as const,
      headline: "Todavía no hay suficiente historial para comparar",
      summary:
        "Cuando registres pagos en períodos consecutivos, aquí verás si el flujo está mejorando o perdiendo calidad con el tiempo.",
      previousFrom: input.previous.from.toISOString(),
      previousTo: input.previous.to.toISOString(),
      previousPaymentCount: 0,
      previousPrincipalSharePct: null,
      previousTotalPaid: 0,
    };
  }

  if (input.previous.paymentCount === 0 && input.current.paymentCount > 0) {
    return {
      signal: "IMPROVING" as const,
      headline: "Este período ya empezó a moverse",
      summary: `No había pagos en el período anterior (${previousRangeLabel}) y ahora sí tienes actividad registrada. Eso ya nos permite empezar a medir avance real.`,
      previousFrom: input.previous.from.toISOString(),
      previousTo: input.previous.to.toISOString(),
      previousPaymentCount: 0,
      previousPrincipalSharePct: null,
      previousTotalPaid: 0,
    };
  }

  if (input.current.paymentCount === 0 && input.previous.paymentCount > 0) {
    return {
      signal: "REGRESSION" as const,
      headline: "Este período quedó más quieto que el anterior",
      summary: `En ${previousRangeLabel} sí registraste ${input.previous.paymentCount} pagos, pero en el período actual no hay movimiento. Conviene retomar el ritmo antes de perder tracción.`,
      previousFrom: input.previous.from.toISOString(),
      previousTo: input.previous.to.toISOString(),
      previousPaymentCount: input.previous.paymentCount,
      previousPrincipalSharePct: input.previous.principalSharePct,
      previousTotalPaid: input.previous.totalPaid,
    };
  }

  const principalDelta = input.current.principalSharePct - input.previous.principalSharePct;
  const interestDelta =
    input.current.interestAndFeesSharePct - input.previous.interestAndFeesSharePct;
  const paidDeltaPct =
    input.previous.totalPaid > 0
      ? Math.round(((input.current.totalPaid - input.previous.totalPaid) / input.previous.totalPaid) * 100)
      : 0;

  if (principalDelta >= 8 || (principalDelta >= 4 && paidDeltaPct >= 10)) {
    return {
      signal: "IMPROVING" as const,
      headline: "Tu flujo va mejor que en el período anterior",
      summary: `El porcentaje enviado a principal subió de ${input.previous.principalSharePct}% a ${input.current.principalSharePct}% y el dinero absorbido por intereses/cargos bajó ${Math.max(interestDelta * -1, 0)} puntos.`,
      previousFrom: input.previous.from.toISOString(),
      previousTo: input.previous.to.toISOString(),
      previousPaymentCount: input.previous.paymentCount,
      previousPrincipalSharePct: input.previous.principalSharePct,
      previousTotalPaid: input.previous.totalPaid,
    };
  }

  if (principalDelta <= -8 || interestDelta >= 8 || paidDeltaPct <= -20) {
    return {
      signal: "REGRESSION" as const,
      headline: "Este período perdió eficiencia frente al anterior",
      summary: `Antes ${input.previous.principalSharePct}% de tu flujo iba a principal y ahora está en ${input.current.principalSharePct}%. Conviene corregir la prioridad o el presupuesto para no retroceder.`,
      previousFrom: input.previous.from.toISOString(),
      previousTo: input.previous.to.toISOString(),
      previousPaymentCount: input.previous.paymentCount,
      previousPrincipalSharePct: input.previous.principalSharePct,
      previousTotalPaid: input.previous.totalPaid,
    };
  }

  return {
    signal: "STABLE" as const,
    headline: "Tu comportamiento está bastante estable frente al período anterior",
    summary: `La calidad del flujo se mantuvo cerca del período ${previousRangeLabel}. No es una caída, pero tampoco un salto material todavía.`,
    previousFrom: input.previous.from.toISOString(),
    previousTo: input.previous.to.toISOString(),
    previousPaymentCount: input.previous.paymentCount,
    previousPrincipalSharePct: input.previous.principalSharePct,
    previousTotalPaid: input.previous.totalPaid,
  };
}

export function getDefaultReportRange() {
  const now = new Date();

  return {
    from: startOfMonth(now),
    to: endOfMonth(now),
  };
}

async function loadRawReportSummary(
  userId: string,
  from: Date,
  to: Date,
): Promise<RawReportSummary> {
  const payments = await prisma.payment.findMany({
    where: {
      userId,
      paidAt: {
        gte: from,
        lte: to,
      },
    },
    include: {
      debt: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
    orderBy: {
      paidAt: "desc",
    },
  });

  const debtSummaryMap = new Map<string, { debtId: string; debtName: string; totalPaid: number }>();
  const categorySummaryMap = new Map<string, number>();
  const totalPaid = payments.reduce((sum, payment) => sum.plus(payment.amount), decimal(0));
  const totalPrincipalPaid = payments.reduce((sum, payment) => sum.plus(payment.principalAmount ?? 0), decimal(0));
  const totalInterestPaid = payments.reduce((sum, payment) => sum.plus(payment.interestAmount ?? 0), decimal(0));
  const totalFeesPaid = payments.reduce(
    (sum, payment) => sum.plus(payment.lateFeeAmount ?? 0).plus(payment.extraChargesAmount ?? 0),
    decimal(0),
  );

  for (const payment of payments) {
    const debtEntry = debtSummaryMap.get(payment.debt.id) ?? {
      debtId: payment.debt.id,
      debtName: payment.debt.name,
      totalPaid: 0,
    };
    const categoryTotal = categorySummaryMap.get(payment.debt.type) ?? 0;

    debtEntry.totalPaid += toMoneyNumber(payment.amount);
    debtSummaryMap.set(payment.debt.id, debtEntry);
    categorySummaryMap.set(payment.debt.type, categoryTotal + toMoneyNumber(payment.amount));
  }

  return {
    from,
    to,
    totalPaid: toMoneyNumber(totalPaid),
    totalPrincipalPaid: toMoneyNumber(totalPrincipalPaid),
    totalInterestPaid: toMoneyNumber(totalInterestPaid),
    totalFeesPaid: toMoneyNumber(totalFeesPaid),
    paymentCount: payments.length,
    debtSummary: Array.from(debtSummaryMap.values()).sort((left, right) => right.totalPaid - left.totalPaid),
    categorySummary: Array.from(categorySummaryMap.entries()).map(([type, totalPaidByType]) => ({
      type,
      totalPaid: totalPaidByType,
    })),
  };
}

export async function getReportSummary(
  userId: string,
  from = getDefaultReportRange().from,
  to = getDefaultReportRange().to,
): Promise<ReportSummaryDto> {
  const rangeDays = Math.max(differenceInCalendarDays(to, from) + 1, 1);
  const previousTo = subDays(from, 1);
  const previousFrom = subDays(previousTo, rangeDays - 1);
  const [currentSummary, previousSummary] = await Promise.all([
    loadRawReportSummary(userId, from, to),
    loadRawReportSummary(userId, previousFrom, previousTo),
  ]);
  const debtSummary = currentSummary.debtSummary;
  const categorySummary = currentSummary.categorySummary;
  const insights = buildReportInsights({
    paymentCount: currentSummary.paymentCount,
    totalPaid: currentSummary.totalPaid,
    totalPrincipalPaid: currentSummary.totalPrincipalPaid,
    totalInterestPaid: currentSummary.totalInterestPaid,
    totalFeesPaid: currentSummary.totalFeesPaid,
    topDebtName: debtSummary[0]?.debtName ?? null,
    topCategoryName:
      [...categorySummary].sort((left, right) => right.totalPaid - left.totalPaid)[0]?.type ?? null,
  });
  const previousInsights = buildReportInsights({
    paymentCount: previousSummary.paymentCount,
    totalPaid: previousSummary.totalPaid,
    totalPrincipalPaid: previousSummary.totalPrincipalPaid,
    totalInterestPaid: previousSummary.totalInterestPaid,
    totalFeesPaid: previousSummary.totalFeesPaid,
    topDebtName: previousSummary.debtSummary[0]?.debtName ?? null,
    topCategoryName:
      [...previousSummary.categorySummary].sort((left, right) => right.totalPaid - left.totalPaid)[0]?.type ?? null,
  });
  const comparison = buildReportComparison({
    current: {
      paymentCount: currentSummary.paymentCount,
      totalPaid: currentSummary.totalPaid,
      principalSharePct: insights.principalSharePct,
      interestAndFeesSharePct: insights.interestAndFeesSharePct,
    },
    previous: {
      from: previousSummary.from,
      to: previousSummary.to,
      paymentCount: previousSummary.paymentCount,
      totalPaid: previousSummary.totalPaid,
      principalSharePct: previousInsights.principalSharePct,
      interestAndFeesSharePct: previousInsights.interestAndFeesSharePct,
    },
  });

  return {
    from: currentSummary.from.toISOString(),
    to: currentSummary.to.toISOString(),
    totalPaid: currentSummary.totalPaid,
    totalPrincipalPaid: currentSummary.totalPrincipalPaid,
    totalInterestPaid: currentSummary.totalInterestPaid,
    totalFeesPaid: currentSummary.totalFeesPaid,
    paymentCount: currentSummary.paymentCount,
    principalSharePct: insights.principalSharePct,
    interestAndFeesSharePct: insights.interestAndFeesSharePct,
    progressSignal: insights.progressSignal,
    coachingHeadline: insights.coachingHeadline,
    coachingSummary: insights.coachingSummary,
    recommendedNextStep: insights.recommendedNextStep,
    comparison,
    debtSummary,
    categorySummary,
  };
}

export function buildReportCsv(summary: ReportSummaryDto) {
  const rows = [
    ["Desde", summary.from],
    ["Hasta", summary.to],
    ["Pagado total", String(summary.totalPaid)],
    ["Principal", String(summary.totalPrincipalPaid)],
    ["Intereses", String(summary.totalInterestPaid)],
    ["Cargos", String(summary.totalFeesPaid)],
    ["Cantidad de pagos", String(summary.paymentCount)],
    ["Lectura", summary.coachingHeadline],
    ["Siguiente paso", summary.recommendedNextStep],
    ["Comparación", summary.comparison.headline],
    ["Comparación detalle", summary.comparison.summary],
    [],
    ["Resumen por deuda"],
    ["Deuda", "Total pagado"],
    ...summary.debtSummary.map((row) => [row.debtName, String(row.totalPaid)]),
    [],
    ["Resumen por tipo"],
    ["Tipo", "Total pagado"],
    ...summary.categorySummary.map((row) => [row.type, String(row.totalPaid)]),
  ];

  return rows.map((row) => row.join(",")).join("\n");
}

export async function buildReportPdf(summary: ReportSummaryDto) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  let cursorY = 780;

  const drawLine = (text: string, options?: { bold?: boolean; size?: number }) => {
    page.drawText(text, {
      x: 48,
      y: cursorY,
      size: options?.size ?? 11,
      font: options?.bold ? boldFont : font,
      color: rgb(0.1, 0.2, 0.17),
    });
    cursorY -= (options?.size ?? 11) + 10;
  };

  drawLine("Deuda Clara RD - Reporte mensual", { bold: true, size: 18 });
  drawLine(`Periodo: ${format(new Date(summary.from), "dd/MM/yyyy")} - ${format(new Date(summary.to), "dd/MM/yyyy")}`);
  drawLine(`Pagado total: RD$${summary.totalPaid.toLocaleString("es-DO")}`);
  drawLine(`Principal: RD$${summary.totalPrincipalPaid.toLocaleString("es-DO")}`);
  drawLine(`Intereses: RD$${summary.totalInterestPaid.toLocaleString("es-DO")}`);
  drawLine(`Cargos: RD$${summary.totalFeesPaid.toLocaleString("es-DO")}`);
  drawLine(`Lectura: ${summary.coachingHeadline}`);
  drawLine(`Siguiente paso: ${summary.recommendedNextStep}`);
  drawLine(`Comparación: ${summary.comparison.headline}`);
  drawLine(summary.comparison.summary);
  cursorY -= 10;
  drawLine("Resumen por deuda", { bold: true, size: 13 });

  for (const row of summary.debtSummary) {
    drawLine(`${row.debtName}: RD$${row.totalPaid.toLocaleString("es-DO")}`);
  }

  cursorY -= 10;
  drawLine("Resumen por tipo", { bold: true, size: 13 });

  for (const row of summary.categorySummary) {
    drawLine(`${row.type}: RD$${row.totalPaid.toLocaleString("es-DO")}`);
  }

  return pdf.save();
}
