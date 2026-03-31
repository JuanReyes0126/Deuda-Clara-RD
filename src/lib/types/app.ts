export type DebtItemDto = {
  id: string;
  name: string;
  creditorName: string;
  type: string;
  status: string;
  currency: "DOP" | "USD";
  currentBalance: number;
  creditLimit: number | null;
  effectiveBalance: number;
  interestRate: number;
  interestRateType: string;
  monthlyInterestEstimate: number;
  minimumPayment: number;
  statementDay: number | null;
  dueDay: number | null;
  nextDueDate: string | null;
  lateFeeAmount: number;
  extraChargesAmount: number;
  utilizationPct: number | null;
  notes: string | null;
  startedAt: string | null;
  estimatedEndAt: string | null;
  paidOffAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  paymentCount: number;
  totalPaid: number;
  lastPaymentAt: string | null;
  lastPaymentAmount: number | null;
};

export type PaymentItemDto = {
  id: string;
  debtId: string;
  debtName: string;
  amount: number;
  principalAmount: number | null;
  interestAmount: number | null;
  lateFeeAmount: number | null;
  extraChargesAmount: number | null;
  remainingBalanceAfter: number | null;
  source: string;
  notes: string | null;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
};

export type NotificationItemDto = {
  id: string;
  debtId: string | null;
  type: string;
  channel: string;
  severity: string;
  title: string;
  message: string;
  actionLabel: string | null;
  actionHref: string | null;
  dueAt: string | null;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type DebtSummaryDto = {
  activeDebtCount: number;
  archivedDebtCount: number;
  totalBalance: number;
  totalMinimumPayment: number;
  totalMonthlyInterest: number;
  overdueCount: number;
};

export type DashboardSummaryDto = {
  totalDebt: number;
  totalMinimumPayment: number;
  currentMonthlyBudget: number;
  estimatedMonthlyInterest: number;
  paidVsPendingPercentage: number;
  projectedDebtFreeDate: string | null;
  recommendedDebtName: string | null;
  recommendedDebtId: string | null;
  monthsToDebtFree: number | null;
  interestSavings: number | null;
};

export type MembershipInfoDto = {
  tier: "FREE" | "NORMAL" | "PRO";
  billingStatus: "FREE" | "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INACTIVE";
  label: string;
  guidanceLabel: string;
  durationMonths: number;
  monthlyPriceUsd: number;
  recommendationUnlocked: boolean;
  description: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  billingConfigured: boolean;
};

export type MembershipConversionSnapshotDto = {
  hasDebts: boolean;
  totalDebt: number;
  estimatedMonthlyInterest: number;
  currentMonthlyBudget: number;
  suggestedMonthlyBudget: number;
  inferredExtraPayment: number;
  currentMonthsToDebtFree: number | null;
  optimizedMonthsToDebtFree: number | null;
  currentDebtFreeDate: string | null;
  optimizedDebtFreeDate: string | null;
  interestSavings: number | null;
  monthsSaved: number | null;
  recommendedStrategyLabel: string;
  immediateAction: string;
  urgentDebtName: string | null;
  dueSoonCount: number;
  riskAlertCount: number;
};

export type DashboardPlanSnapshotDto = {
  label: string;
  strategy: "CURRENT" | "AVALANCHE" | "SNOWBALL" | "HYBRID";
  strategyLabel: string;
  monthlyBudget: number;
  monthsToDebtFree: number | null;
  projectedDebtFreeDate: string | null;
  totalInterest: number;
  totalPaid: number;
  remainingBalance: number;
  feasible: boolean;
  reason: string | null;
};

export type DashboardPlanComparisonDto = {
  headline: string;
  description: string;
  recommendedStrategy: "AVALANCHE" | "SNOWBALL" | "HYBRID";
  interestSavings: number | null;
  monthsSaved: number | null;
  suggestedMonthlyBudget: number;
  inferredExtraPayment: number;
  assumption: string | null;
  immediateAction: string;
  currentPlan: DashboardPlanSnapshotDto;
  optimizedPlan: DashboardPlanSnapshotDto;
};

export type DashboardDto = {
  summary: DashboardSummaryDto;
  membership: MembershipInfoDto;
  planComparison: DashboardPlanComparisonDto | null;
  debtBreakdown: Array<{ label: string; value: number }>;
  balanceHistory: Array<{ label: string; totalBalance: number }>;
  recentPayments: PaymentItemDto[];
  dueSoonDebts: DebtItemDto[];
  urgentDebt: DebtItemDto | null;
  recommendedOrder: Array<{
    id: string;
    name: string;
    priorityRank: number;
    score: number;
    balance: number;
    monthlyRatePct: number;
    explanation: string;
  }>;
  strategyExplanation: string;
  riskAlerts: Array<{ title: string; description: string }>;
};

export type ReportSummaryDto = {
  from: string;
  to: string;
  totalPaid: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  totalFeesPaid: number;
  paymentCount: number;
  principalSharePct: number;
  interestAndFeesSharePct: number;
  progressSignal: "STRONG" | "WATCH" | "STARTING";
  coachingHeadline: string;
  coachingSummary: string;
  recommendedNextStep: string;
  comparison: {
    signal: "IMPROVING" | "STABLE" | "REGRESSION" | "NO_BASELINE";
    headline: string;
    summary: string;
    previousFrom: string | null;
    previousTo: string | null;
    previousPaymentCount: number;
    previousPrincipalSharePct: number | null;
    previousTotalPaid: number;
  };
  debtSummary: Array<{ debtId: string; debtName: string; totalPaid: number }>;
  categorySummary: Array<{ type: string; totalPaid: number }>;
};

export type AdminOverviewDto = {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  totalDebts: number;
  overdueDebts: number;
  paymentCountLast30Days: number;
  membershipSummary: {
    freeUsers: number;
    premiumUsers: number;
    proUsers: number;
    activeBilling: number;
    pendingBilling: number;
    attentionBilling: number;
  };
  reminderSummary: {
    emailReminderUsers: number;
    monthlyReportUsers: number;
  };
  emailTemplateSummary: {
    totalTemplates: number;
    activeTemplates: number;
    inactiveTemplates: number;
  };
  users: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
    membershipTier: string;
    membershipBillingStatus: string;
    createdAt: string;
    lastLoginAt: string | null;
    debtCount: number;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    createdAt: string;
    userEmail: string | null;
    metadata: string | null;
  }>;
  emailTemplates: Array<{
    id: string;
    key: string;
    name: string;
    subject: string;
    htmlContent: string;
    textContent: string;
    isActive: boolean;
    updatedAt: string;
  }>;
  recentDebts: Array<{
    id: string;
    name: string;
    creditorName: string;
    userEmail: string;
    status: string;
    effectiveBalance: number;
    nextDueDate: string | null;
    createdAt: string;
  }>;
  recentPayments: Array<{
    id: string;
    debtName: string;
    userEmail: string;
    amount: number;
    source: string;
    paidAt: string;
    createdAt: string;
  }>;
  recentNotifications: Array<{
    id: string;
    title: string;
    type: string;
    severity: string;
    userEmail: string | null;
    createdAt: string;
    sentAt: string | null;
    readAt: string | null;
  }>;
};

export type SimulatorResultDto = {
  basePlan: {
    monthsToPayoff: number | null;
    totalInterest: number;
    totalPaid: number;
    remainingBalance: number;
  };
  extraPaymentPlan: {
    monthsToPayoff: number | null;
    totalInterest: number;
    savings: number | null;
  };
  focusedDebtPlan: {
    focusedDebtId: string | null;
    monthsToPayoff: number | null;
    totalInterest: number;
    savings: number | null;
  };
  freezeCardPlan: {
    cardId: string | null;
    monthlySpendStopped: number;
    monthsToPayoff: number | null;
    totalInterest: number;
    savings: number | null;
  };
  refinancePlan: {
    debtId: string | null;
    newRate: number | null;
    monthsToPayoff: number | null;
    totalInterest: number;
    savings: number | null;
  };
  selectedStrategyExplanation: string;
  monthlyProjection: Array<{ month: number; totalBalance: number }>;
};
