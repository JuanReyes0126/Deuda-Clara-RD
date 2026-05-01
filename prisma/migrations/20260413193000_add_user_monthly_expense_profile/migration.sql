ALTER TABLE "UserSettings"
ADD COLUMN "monthlyHousingCost" DECIMAL(14, 2),
ADD COLUMN "monthlyGroceriesCost" DECIMAL(14, 2),
ADD COLUMN "monthlyUtilitiesCost" DECIMAL(14, 2),
ADD COLUMN "monthlyTransportCost" DECIMAL(14, 2),
ADD COLUMN "monthlyOtherEssentialExpenses" DECIMAL(14, 2);
