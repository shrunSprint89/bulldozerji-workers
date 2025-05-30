// schemas/dashboard.ts
import { z } from "zod";

const FinancialRatio = z.enum(["PE_RATIO", "ROE", "DEBT_EQUITY"]);
const FinancialData = z.enum(["CLOSE_PRICE", "VOLUME", "OPEN_PRICE"]);
const Filters = z.enum(["gte", "lte", "eq", "neq", "gt", "lt"]);
const ChartType = z.enum(["line-chart", "bar-chart", "scatter-chart"]);

export const TableSchema = z.object({
  id: z.string().uuid(),
  columns: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      format: z.enum(["currency", "percentage", "number", "text"]).optional(),
      information: FinancialRatio.or(FinancialData),
      filter: z.object({
        type: Filters,
        value: z.union([z.number(), z.string(), z.date()]),
      }),
    })
  ),
});

export const ChartSchema = z.object({
  id: z.string().uuid(),
  chartType: ChartType,
  xData: z.array(z.union([z.number(), z.string(), z.date()])).optional(),
  yData: z.array(z.union([z.number(), z.string(), z.date()])).optional(),
  xLabel: z.string(),
  yLabel: z.string(),
});

export const AIDashboardResponseSchema = z.object({
  //charts: z.array(ChartSchema).optional(),
  tables: z.array(TableSchema).optional(),
  response: z.string(),
});

export type AIDashboardResponseType = z.infer<typeof AIDashboardResponseSchema>;
