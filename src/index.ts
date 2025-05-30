import { ZodError, z } from 'zod/v4';
import { StockDetailsSchema, StockDetailsSchemaType } from './schemas/stockDetailsSchema';
import { INDIAN_API_BASE_URL, INDIAN_API_STOCK_ENDPOINT, MAJOR_TICKERS, TICKER_LIST_URL } from './tickers.constant';
import { snakeCase } from 'lodash';
import { DurableObject, env } from 'cloudflare:workers';
import { TickerSymbol } from './types/symbols';

enum SymbolProcessorState {
	INITIALIZED = 'initialized',
	COUNT = 'count',
	TO_FETCH_SYMBOLS = 'toFetchSymbols',
	FETCHED_SYMBOLS = 'fetchedSymbols',
	FAILED_SYMBOLS = 'failedSymbols',
	TICKER_LIST_URL = 'tickerListUrl',
}

export class SymbolProcessor extends DurableObject {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.ctx.storage.get<number>(SymbolProcessorState.COUNT).then((count) => {
			if (count === undefined) {
				this.ctx.storage.put(SymbolProcessorState.COUNT, 0);
			}
		});
	}

	async initializeSymbols() {
		let tickerList = [];
		const initialized = await this.ctx.storage.get<boolean>(SymbolProcessorState.INITIALIZED);
		if (!initialized) {
			try {
				tickerList = await this.fetchTickerList();
				await this.ctx.storage.put(
					SymbolProcessorState.TO_FETCH_SYMBOLS,
					tickerList.map((t) => t.Symbol).sort((a, b) => a.localeCompare(b))
				);
				await this.ctx.storage.put(SymbolProcessorState.FETCHED_SYMBOLS, []);
				await this.ctx.storage.put(SymbolProcessorState.FAILED_SYMBOLS, []);
				await this.ctx.storage.put(SymbolProcessorState.INITIALIZED, true);
				console.log(`Initialized symbols in key ${SymbolProcessorState.FETCHED_SYMBOLS}`);
			} catch (error) {
				console.error('❌ Error initializing symbols\n', error);
			}
		}
	}

	async setStateForReinitialization() {
		await this.ctx.storage.put(SymbolProcessorState.INITIALIZED, false);
	}

	async upsertIntoCompanies(db: D1Database, ticker: string, data: StockDetailsSchemaType) {
		await db
			.prepare(
				`
					INSERT OR REPLACE INTO companies (
					company_id, company_name, industry, exchange_code_bse, exchange_code_nse, percent_change, year_high, year_low, current_price_bse, current_price_nse, company_description, mg_industry, is_in_id
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				`
			)
			.bind(
				data.companyProfile.isInId,
				data.companyName,
				data.industry,
				data.companyProfile.exchangeCodeBse,
				data.companyProfile.exchangeCodeNse,
				data.percentChange,
				data.yearHigh,
				data.yearLow,
				data.currentPrice.BSE,
				data.currentPrice.NSE,
				data.companyProfile.companyDescription,
				data.companyProfile.mgIndustry,
				data.companyProfile.isInId
			)
			.run()
			.catch((err) => {
				console.error(`Failed to upsert ${ticker}:`, err);
			});
		console.log(`Upserted ${ticker} into companies table`);
	}

	async upsertIntoPeerCompanies(db: D1Database, ticker: string, data: StockDetailsSchemaType) {
		for (let peerCompany of data.companyProfile.peerCompanyList) {
			await db
				.prepare(
					`
						INSERT OR REPLACE INTO peer_companies (
						company_id, ticker_id, company_name, price_to_book_value_ratio, price_to_earnings_value_ratio, market_cap, price, percent_change, net_change, return_on_avg_equity_5yr, return_on_avg_equity_ttm, lt_debt_per_equity_fy, net_profit_margin_5yr, net_profit_margin_ttm, dividend_yield, shares_outstanding, language_support, image_url, overall_rating, ylow, yhigh
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					`
				)
				.bind(
					data.companyProfile.isInId,
					peerCompany.tickerId,
					peerCompany.companyName,
					peerCompany.priceToBookValueRatio,
					peerCompany.priceToEarningsValueRatio,
					peerCompany.marketCap,
					peerCompany.price,
					peerCompany.percentChange,
					peerCompany.netChange,
					peerCompany.returnOnAverageEquity5YearAverage,
					peerCompany.returnOnAverageEquityTrailing12Month,
					peerCompany.ltDebtPerEquityMostRecentFiscalYear,
					peerCompany.netProfitMargin5YearAverage,
					peerCompany.netProfitMarginPercentTrailing12Month,
					peerCompany.dividendYieldIndicatedAnnualDividend,
					peerCompany.totalSharesOutstanding,
					peerCompany.languageSupport,
					peerCompany.imageUrl,
					peerCompany.overallRating,
					peerCompany.ylow,
					peerCompany.yhigh
				)
				.run()
				.catch((err) => {
					console.error(`Failed to upsert ${ticker}:`, err);
				});
		}
		console.log(`Upserted ${ticker} into peer_companies table`);
	}

	async upsertIntoFinancialData(db: D1Database, ticker: string, data: StockDetailsSchemaType) {
		for (let financial of data.financials) {
			for (let [financialCategory, financialDataList] of Object.entries(financial.stockFinancialMap)) {
				if (!financialDataList) continue;
				for (let financialItem of financialDataList) {
					await db
						.prepare(
							`INSERT OR REPLACE INTO financial_data (
								company_id,
								financial_type,
								fiscal_year,
								end_date,
								statement_date,
								fiscal_period_number,
								display_name,
								financial_key,
								value,
								yqoq_comp,
								qoq_comp
							) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
						)
						.bind(
							data.companyProfile.isInId,
							financialCategory,
							financial.FiscalYear,
							financial.EndDate,
							financial.StatementDate,
							financial.fiscalPeriodNumber,
							financialItem.displayName,
							financialItem.key,
							financialItem.value,
							financialItem.yqoQComp,
							financialItem.qoQComp
						)
						.run()
						.catch((err) => {
							console.error(`Failed to upsert ${ticker}:`, err);
						});
				}
			}
		}
		console.log(`Upserted ${ticker} into financial_data table`);
	}

	async upsertIntoKeyMetrics(db: D1Database, ticker: string, data: StockDetailsSchemaType) {
		for (let [metricCategory, metricDataList] of Object.entries(data.keyMetrics)) {
			for (let metricItem of metricDataList) {
				await db
					.prepare(
						`
							INSERT OR REPLACE INTO key_metrics (
							company_id, metric_category, display_name, metric_key, value
							) VALUES (?, ?, ?, ?, ?)
						`
					)
					.bind(data.companyProfile.isInId, snakeCase(metricCategory), metricItem.displayName, metricItem.key, metricItem.value)
					.run()
					.catch((err) => {
						console.error(`Failed to upsert ${ticker}:`, err);
					});
			}
		}
		console.log(`Upserted ${ticker} into key_metrics table`);
	}

	async fetchTickerList(): Promise<TickerSymbol[]> {
		const tickerListUrl = await this.ctx.storage.get<string>(SymbolProcessorState.TICKER_LIST_URL);
		const rejectedPromise = Promise.reject('Unable to fetch and initialize ticketList');
		if (!tickerListUrl) {
			console.error('❌ Unable to get ticker list URL');
			return rejectedPromise;
		}
		console.log(`Fetching ticker list from ${tickerListUrl}`);
		const assetResponse = await env.ASSETS.fetch(new Request(tickerListUrl));
		if (assetResponse.ok) {
			return await assetResponse.json<TickerSymbol[]>();
		} else {
			console.error('❌ Unable to fetch and initialize ticketList JSON');
			return rejectedPromise;
		}
	}

	async getNextSymbol(): Promise<string | null> {
		const keys = await this.ctx.storage.get<string[]>(SymbolProcessorState.TO_FETCH_SYMBOLS);
		if (keys && keys.length) return keys[0];
		return null;
	}

	async moveSymbolsAfterFetch(symbol: string, successFlag = true) {
		const pendingSymbols = ((await this.ctx.storage.get<string[]>(SymbolProcessorState.TO_FETCH_SYMBOLS)) || []).filter(
			(s) => s !== symbol
		);
		const fetchedSymbols = [...((await this.ctx.storage.get<string[]>(SymbolProcessorState.FETCHED_SYMBOLS)) || []), symbol];
		const failedSymbols = [...((await this.ctx.storage.get<string[]>(SymbolProcessorState.FAILED_SYMBOLS)) || []), symbol];
		const { isFailedAndTickerListDone, isFailedAndMoreTickersLeft, isSuccessAndTickerListDone, isSuccessAndMoreTickersLeft } = {
			isFailedAndTickerListDone: !successFlag && !pendingSymbols.length,
			isFailedAndMoreTickersLeft: !successFlag && pendingSymbols.length,
			isSuccessAndTickerListDone: successFlag && !pendingSymbols.length,
			isSuccessAndMoreTickersLeft: successFlag && pendingSymbols.length,
		};

		console.log(`Moving ${symbol}. Status is ${successFlag ? 'SUCCESS' : 'FAILED'}`);
		if (isFailedAndMoreTickersLeft) {
			await this.ctx.storage.put(SymbolProcessorState.TO_FETCH_SYMBOLS, pendingSymbols);
			await this.ctx.storage.put(SymbolProcessorState.FAILED_SYMBOLS, failedSymbols);
			console.log(`Moved ${symbol} from TO_FETCH_SYMBOLS to FAILED_SYMBOLS`);
		} else if (isSuccessAndMoreTickersLeft) {
			await this.ctx.storage.put(SymbolProcessorState.TO_FETCH_SYMBOLS, pendingSymbols);
			await this.ctx.storage.put(SymbolProcessorState.FETCHED_SYMBOLS, fetchedSymbols);
			console.log(`Moved ${symbol} from TO_FETCH_SYMBOLS to FETCHED_SYMBOLS`);
		} else {
			// All tickers are done, move all symbols back to TO_FETCH_SYMBOLS list despite failure or success
			console.log(`TO_FETCH_SYMBOLS list empty currently. Setting Intialization flag as false to restart the processor state`);
			this.setStateForReinitialization();
		}
		console.log(`TO_FETCH_SYMBOLS length: ${pendingSymbols.length}`);
		console.log(`FETCHED_SYMBOLS length: ${fetchedSymbols.length}`);
		console.log(`FAILED_SYMBOLS length: ${failedSymbols.length}`);
	}

	async upsertStockDetails(symbol: string, data: StockDetailsSchemaType) {
		console.log(`Attempting to insert data for ${symbol} into D1 Database`);
		await this.upsertIntoCompanies(env.SymbolsDB, symbol, data);
		await this.upsertIntoPeerCompanies(env.SymbolsDB, symbol, data);
		await this.upsertIntoFinancialData(env.SymbolsDB, symbol, data);
		await this.upsertIntoKeyMetrics(env.SymbolsDB, symbol, data);
	}

	async fetchStockDetailsData(symbol: string): Promise<StockDetailsSchemaType> {
		console.log(`Fetching data for ${symbol} from IndianAPI`);
		const params = { name: symbol };
		const url = new URL(INDIAN_API_STOCK_ENDPOINT, INDIAN_API_BASE_URL);
		Object.entries(params).forEach(([key, value]) => {
			url.searchParams.append(key, value);
		});
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'X-Api-Key': env.INDIANAPI_API_KEY,
			},
		});
		const data = await response.json<StockDetailsSchemaType>();
		console.log(`Fetched Data for ${symbol} with {company_id: ${data.companyProfile.isInId}`);
		return data;
	}

	async validateStockDataWithZod(data: any) {
		console.log(`Validating data with Zod`);
		const parsed: StockDetailsSchemaType = StockDetailsSchema.parse(data);
		console.log(`Data for company_id: ${data.companyProfile.isInId} is valid.`);
		return parsed;
	}

	async processNextSymbol() {
		let isSymbolProcessed = false;
		await this.initializeSymbols();
		const symbol = await this.getNextSymbol();
		if (!symbol) {
			console.log('❌ Something wrong. No symbols to process');
			return;
		}
		try {
			const data: StockDetailsSchemaType = await this.fetchStockDetailsData(symbol).then((data) => this.validateStockDataWithZod(data));
			await this.upsertStockDetails(symbol, data);
			isSymbolProcessed = true;
			console.log(`✅ Processed ${symbol}.`);
		} catch (error) {
			if (error instanceof ZodError) {
				console.error(`❌ Validation error for ${symbol}:`);
				console.error(z.prettifyError(error));
			} else {
				console.error(`❌ Failed to process ${symbol}:`, error);
			}
		} finally {
			await this.moveSymbolsAfterFetch(symbol, isSymbolProcessed);
			const count = await this.ctx.storage.get<number>(SymbolProcessorState.COUNT);
			console.log(`Processed ${count} symbols so far.`);
			if (env.MAX_SYMBOLS_TO_FETCH === count) {
				console.log(`Reached max symbols to fetch.\nNot scheduling alarm based execution.`);
			} else {
				this.ctx.storage.put(SymbolProcessorState.COUNT, (count ?? 0) + 1);
				this.ctx.storage.setAlarm(new Date(Date.now() + 5 * 60 * 1000));
				console.log(`Next alarm in 5 minutes.`);
			}
		}
	}

	async setRequestUrl(request: Request) {
		await this.ctx.storage.put(SymbolProcessorState.TICKER_LIST_URL, new URL(TICKER_LIST_URL, request.url).toString());
	}

	async alarm() {
		await this.processNextSymbol();
	}

	async deleteAll() {
		await this.ctx.storage.deleteAll();
		await this.ctx.storage.deleteAlarm();
	}
}

export default {
	async fetch(request: Request, env: Env) {
		const id = env.SYMBOL_PROCESSOR.idFromName('main');
		const stub = env.SYMBOL_PROCESSOR.get(id);
		const url = new URL(request.url);

		//Resetting the Durable Object State
		if (url.pathname === '/reset') {
			await stub.deleteAll();
			return new Response('Data reset', { status: 200 });
		}

		await stub.setRequestUrl(request);
		await stub.processNextSymbol();
		return new Response('Processor started', { status: 200 });
	},
};
