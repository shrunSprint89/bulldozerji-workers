import { z } from 'zod';

export const StockDetailsSchema = z.object({
	companyName: z.string(),
	industry: z.string(),
	companyProfile: z.object({
		companyDescription: z.string(),
		mgIndustry: z.string(),
		isInId: z.string(),
		officers: z.object({
			officer: z.array(
				z.object({
					rank: z.union([z.number().int(), z.string()]),
					since: z.string(),
					firstName: z.string(),
					mI: z.union([z.string(), z.null()]).nullable().optional(),
					lastName: z.string(),
					age: z.union([z.string(), z.null()]).nullable().optional(),
					title: z.object({
						startYear: z.string(),
						startMonth: z.string(),
						startDay: z.string(),
						iD1: z.string(),
						abbr1: z.string(),
						iD2: z.string(),
						abbr2: z.string(),
						Value: z.string(),
					}),
				})
			),
		}),
		exchangeCodeBse: z.string(),
		exchangeCodeNse: z.string(),
		peerCompanyList: z.array(
			z.object({
				tickerId: z.string(),
				companyName: z.string(),
				priceToBookValueRatio: z.number().nullable().optional(),
				priceToEarningsValueRatio: z.number().nullable().optional(),
				marketCap: z.number(),
				price: z.number(),
				percentChange: z.number().nullable().optional(),
				netChange: z.number().nullable().optional(),
				returnOnAverageEquity5YearAverage: z.number().nullable().optional(),
				returnOnAverageEquityTrailing12Month: z.number().nullable().optional(),
				ltDebtPerEquityMostRecentFiscalYear: z.number().nullable().optional(),
				netProfitMargin5YearAverage: z.number().nullable().optional(),
				netProfitMarginPercentTrailing12Month: z.number().nullable().optional(),
				dividendYieldIndicatedAnnualDividend: z.number().nullable().optional(),
				totalSharesOutstanding: z.number().nullable().optional(),
				languageSupport: z.string().nullable().optional(),
				imageUrl: z.string(),
				overallRating: z.string().nullable().optional(),
				ylow: z.number().nullable().optional(),
				yhigh: z.number().nullable().optional(),
			})
		),
	}),
	currentPrice: z.object({ BSE: z.string(), NSE: z.string() }),
	stockTechnicalData: z.array(
		z.object({
			days: z.number().int().nullable().optional(),
			bsePrice: z.string(),
			nsePrice: z.string(),
		})
	),
	percentChange: z.string(),
	yearHigh: z.string(),
	yearLow: z.string(),
	financials: z.array(
		z.object({
			stockFinancialMap: z.object({
				CAS: z.union([
					z.array(
						z.object({
							displayName: z.string(),
							key: z.string(),
							value: z.string(),
							yqoQComp: z.union([z.string(), z.null()]),
							qoQComp: z.union([z.string(), z.null()]),
						})
					),
					z.null(),
				]),
				BAL: z.union([
					z.array(
						z.object({
							displayName: z.string(),
							key: z.string(),
							value: z.string(),
							yqoQComp: z.union([z.string(), z.null()]),
							qoQComp: z.union([z.string(), z.null()]),
						})
					),
					z.null(),
				]),
				INC: z.union([
					z.array(
						z.object({
							displayName: z.string(),
							key: z.string(),
							value: z.string(),
							yqoQComp: z.union([z.string(), z.null()]),
							qoQComp: z.union([z.string(), z.null()]),
						})
					),
					z.null(),
				]),
			}),
			FiscalYear: z.string(),
			EndDate: z.string(),
			Type: z.string(),
			StatementDate: z.string(),
			fiscalPeriodNumber: z.number().int().nullable().optional(),
		})
	),
	keyMetrics: z.object({
		mgmtEffectiveness: z.array(
			z.object({
				displayName: z.string(),
				key: z.string(),
				value: z.union([z.string(), z.null(), z.number()]),
			})
		),
		margins: z.array(
			z.object({
				displayName: z.string(),
				key: z.string(),
				value: z.union([z.string(), z.null(), z.number()]),
			})
		),
		financialstrength: z.array(
			z.object({
				displayName: z.string(),
				key: z.string(),
				value: z.union([z.string(), z.null(), z.number()]),
			})
		),
	}),
});

export type StockDetailsSchemaType = z.infer<typeof StockDetailsSchema>;
