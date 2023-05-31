import { MigrationBuilder } from '@contember/database-migrations'
import { Input, Model, Schema, Value } from '@contember/schema'
import {
	SchemaUpdater,
	updateAcl,
	updateAclEveryEntity,
	updateAclEveryPredicate,
	updateAclEveryRole,
	updateAclFieldPermissions,
	updateEntity,
	updateEveryEntity,
	updateEveryField,
	updateModel,
	updateSchema,
} from '../utils/schemaUpdateUtils'
import {
	createModificationType,
	ModificationHandler,
	ModificationHandlerCreateSqlOptions,
	ModificationHandlerOptions,
} from '../ModificationHandler'
import { acceptFieldVisitor, PredicateDefinitionProcessor } from '@contember/schema-utils'
import {
	VERSION_ACL_PATCH,
	VERSION_UPDATE_CONSTRAINT_FIELDS,
	VERSION_UPDATE_INDEX_FIELDS,
} from '../ModificationVersions'
import { changeValue } from '../utils/valueUtils'
import { updateColumnNameModification } from '../columns'
import { NoopModification } from '../NoopModification'

export class UpdateFieldNameModificationHandler implements ModificationHandler<UpdateFieldNameModificationData> {
	private renameColumnSubModification: ModificationHandler<any> = new NoopModification()

	constructor(
		private readonly data: UpdateFieldNameModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {
		if (this.data.columnName) {
			this.renameColumnSubModification = updateColumnNameModification.createHandler({
				entityName: this.data.entityName,
				columnName: this.data.columnName,
				fieldName: this.data.fieldName,
			}, this.schema, this.options)
		}
	}

	public createSql(builder: MigrationBuilder, options: ModificationHandlerCreateSqlOptions): void {
		const entity = this.schema.model.entities[this.data.entityName]
		if (entity.view) {
			return
		}
		this.renameColumnSubModification.createSql(builder, options)
	}

	public getSchemaUpdater(): SchemaUpdater {
		const updateConstraintFields =
			this.options.formatVersion >= VERSION_UPDATE_CONSTRAINT_FIELDS
				? updateEntity(this.data.entityName, ({ entity }) => {
					return {
						...entity,
						unique: entity.unique.map(unique => ({
							...unique,
							fields: unique.fields.map(changeValue(this.data.fieldName, this.data.newFieldName)),
						})),
					}
				  })
				: undefined
		const updateIndexFields =
			this.options.formatVersion >= VERSION_UPDATE_INDEX_FIELDS
				? updateEntity(this.data.entityName, ({ entity }) => {
					return {
						...entity,
						indexes: entity.indexes.map(unique => ({
							...unique,
							fields: unique.fields.map(changeValue(this.data.fieldName, this.data.newFieldName)),
						})),
					}
				})
				: undefined
		const updateRelationReferences = updateEveryEntity(
			updateEveryField(({ field, entity }) => {
				const isUpdatedRelation = (entity: Model.Entity, relation: Model.AnyRelation | null) => {
					return entity.name === this.data.entityName && relation && relation.name === this.data.fieldName
				}

				return acceptFieldVisitor<Model.AnyField>(this.schema.model, entity, field, {
					visitColumn: ({ column }) => column,
					visitManyHasOne: ({ targetEntity, relation, targetRelation }) => {
						return isUpdatedRelation(targetEntity, targetRelation)
							? { ...relation, inversedBy: this.data.newFieldName }
							: relation
					},
					visitOneHasMany: ({ relation, targetEntity, targetRelation }) => {
						return isUpdatedRelation(targetEntity, targetRelation)
							? { ...relation, ownedBy: this.data.newFieldName }
							: relation
					},
					visitOneHasOneOwning: ({ relation, targetEntity, targetRelation }) => {
						return isUpdatedRelation(targetEntity, targetRelation)
							? { ...relation, inversedBy: this.data.newFieldName }
							: relation
					},
					visitOneHasOneInverse: ({ relation, targetEntity, targetRelation }) => {
						return isUpdatedRelation(targetEntity, targetRelation)
							? { ...relation, ownedBy: this.data.newFieldName }
							: relation
					},
					visitManyHasManyOwning: ({ relation, targetEntity, targetRelation }) => {
						return isUpdatedRelation(targetEntity, targetRelation)
							? { ...relation, inversedBy: this.data.newFieldName }
							: relation
					},
					visitManyHasManyInverse: ({ relation, targetEntity, targetRelation }) => {
						return isUpdatedRelation(targetEntity, targetRelation)
							? { ...relation, ownedBy: this.data.newFieldName }
							: relation
					},
				})
			}),
		)
		const updateFieldName = updateEntity(this.data.entityName, ({ entity }) => {
			const { [this.data.fieldName]: updated, ...fields } = entity.fields
			return {
				...entity,
				fields: {
					...fields,
					[this.data.newFieldName]: { ...updated, name: this.data.newFieldName },
				},
			}
		})
		const updateAclOp =
			this.options.formatVersion >= VERSION_ACL_PATCH
				? updateAcl(
					updateAclEveryRole(
						updateAclEveryEntity(
							updateAclFieldPermissions((permissions, entityName) => {
								if (entityName !== this.data.entityName) {
									return permissions
								}
								if (!permissions[this.data.fieldName]) {
									return permissions
								}
								const { [this.data.fieldName]: field, ...other } = permissions
								return {
									[this.data.newFieldName]: field,
									...other,
								}
							}),
							updateAclEveryPredicate(({ predicate, entityName, schema }) => {
								const processor = new PredicateDefinitionProcessor(schema.model)
								const currentEntity = schema.model.entities[entityName]
								return processor.process<Input.Condition<Value.FieldValue<never>> | string, never>(
									currentEntity,
									predicate,
									{
										handleColumn: ctx =>
											ctx.entity.name === this.data.entityName && ctx.column.name === this.data.fieldName
												? [this.data.newFieldName, ctx.value]
												: ctx.value,
										handleRelation: ctx =>
											ctx.entity.name === this.data.entityName && ctx.relation.name === this.data.fieldName
												? [this.data.newFieldName, ctx.value]
												: ctx.value,
									},
								)
							}),
						),
					),
				  )
				: undefined
		return updateSchema(
			updateAclOp,
			this.renameColumnSubModification.getSchemaUpdater(),
			updateModel(
				updateConstraintFields,
				updateIndexFields,
				updateRelationReferences,
				updateFieldName,
			),
		)
	}

	describe() {
		return { message: `Change field name ${this.data.entityName}.${this.data.fieldName} to ${this.data.newFieldName}` }
	}
}

export interface UpdateFieldNameModificationData {
	entityName: string
	fieldName: string
	newFieldName: string
	columnName?: string
}

export const updateFieldNameModification = createModificationType({
	id: 'updateFieldName',
	handler: UpdateFieldNameModificationHandler,
})
