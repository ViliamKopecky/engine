import { MigrationBuilder } from '@contember/database-migrations'
import { Model } from '@contember/schema'
import { wrapIdentifier } from '../../utils/dbHelpers'
import { SchemaDatabaseMetadata } from '@contember/schema-utils'

export const addForeignKeyConstraint = ({ builder, entity, relation, targetEntity, recreate = false, databaseMetadata, invalidateDatabaseMetadata }: {
	recreate?: boolean
	builder: MigrationBuilder
	entity: Model.Entity
	targetEntity: Model.Entity
	relation: Model.OneHasOneOwningRelation | Model.ManyHasOneRelation
	databaseMetadata: SchemaDatabaseMetadata
	invalidateDatabaseMetadata: () => void
}) => {
	if (recreate) {
		const fkNames = databaseMetadata.getForeignKeyConstraintNames(
			{
				fromTable: entity.tableName,
				fromColumn: relation.joiningColumn.columnName,
				toTable: targetEntity.tableName,
				toColumn: targetEntity.primaryColumn,
			},
		)
		for (const name of fkNames) {
			builder.sql(`ALTER TABLE ${wrapIdentifier(entity.tableName)} DROP CONSTRAINT ${wrapIdentifier(name)}`)
		}
	}

	const onDelete = ({
		[Model.OnDelete.setNull]: 'SET NULL',
		[Model.OnDelete.cascade]: 'CASCADE',
		[Model.OnDelete.restrict]: 'NO ACTION',
	} as const)[relation.joiningColumn.onDelete]
	builder.sql(`ALTER TABLE ${wrapIdentifier(entity.tableName)}
		ADD FOREIGN KEY (${wrapIdentifier(relation.joiningColumn.columnName)}) 
		REFERENCES ${wrapIdentifier(targetEntity.tableName)}(${wrapIdentifier(targetEntity.primaryColumn)}) ON DELETE ${onDelete} DEFERRABLE INITIALLY IMMEDIATE`)

	invalidateDatabaseMetadata()
}
