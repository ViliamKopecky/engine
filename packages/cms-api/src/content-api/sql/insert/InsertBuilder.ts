import { resolveValue } from '../utils'
import { Input } from 'cms-common'
import KnexWrapper from '../../../core/knex/KnexWrapper'
import { Value } from "../../../core/knex/types";
import QueryBuilder from "../../../core/knex/QueryBuilder";

type ColumnValue = {
	value: PromiseLike<Input.ColumnValue>
	columnName: string
	columnType: string
}

export default class InsertBuilder {
	private rowData: ColumnValue[] = []

	private insertPromise: Promise<Input.PrimaryValue>

	constructor(
		private readonly tableName: string,
		private readonly primaryColumn: string,
		private readonly db: KnexWrapper,
		private readonly whereCallback: QueryBuilder.Callback,
		firer: PromiseLike<void>
	) {
		this.insertPromise = this.createInsertPromise(firer)
	}

	public addColumnData(columnName: string, value: Input.ColumnValueLike, columnType: string) {
		this.rowData.push({columnName, value: resolveValue(value), columnType})
	}

	public async insertRow(): Promise<Input.PrimaryValue> {
		return this.insertPromise
	}

	private async createInsertPromise(firer: PromiseLike<void>): Promise<Input.PrimaryValue> {
		await firer
		const qb = this.db.queryBuilder()
		const resolvedValues = await Promise.all(this.rowData.map(it => it.value))
		const resolvedData = this.rowData.map((it, index) => ({...it, value: resolvedValues[index]}))
		qb.with('root_', qb => {
			resolvedData.forEach(value => qb.selectValue(value.value as Value, value.columnType, value.columnName))
		})
		const returning = await qb.insertFrom(this.tableName, resolvedData.map(it => it.columnName), qb => {
			qb.from('root_')
			this.whereCallback(qb)
			resolvedData.forEach(value => qb.select(['root_', value.columnName]))
		}, this.primaryColumn)

		return returning[0]
	}
}
