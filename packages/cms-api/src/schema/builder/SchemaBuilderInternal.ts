import { AnyRelation, Column, Entity, Schema } from "../model"
import EntityBuilder from "./EntityBuilder"
import { SchemaBuilderError } from "./SchemaBuilder"
import { Error } from "tslint/lib/error"
import FieldProcessor from "./internal/FieldProcessor"
import ColumnProcessor from "./internal/ColumnProcessor"
import ManyHasManyProcessor from "./internal/ManyHasManyProcessor"
import OneHasOneProcessor from "./internal/OneHasOneProcessor"
import OneHasManyProcessor from "./internal/OneHasManyProcessor"
import ManyHasOneProcessor from "./internal/ManyHasOneProcessor"
import NamingConventions from "./NamingConventions";
import FieldBuilder from "./FieldBuilder";

export default class SchemaBuilderInternal
{
  private entities: { [name: string]: Entity } = {}

  private fieldOptions: { [entity: string]: FieldBuilder.Map } = {}

  private enums: { [name: string]: string[] } = {}

  private conventions: NamingConventions

  constructor(conventions: NamingConventions)
  {
    this.conventions = conventions
  }

  public addEntity(name: string, options: EntityBuilder.EntityOptions, fieldOptions: FieldBuilder.Map): void
  {
    this.fieldOptions[name] = fieldOptions
    const primaryName = this.getPrimaryFieldName(options, name, fieldOptions)
    if (!fieldOptions[primaryName]) {
      fieldOptions[primaryName] = this.createDefaultPrimary(primaryName)
    }
    const primaryField = fieldOptions[primaryName]
    if (primaryField.type !== FieldBuilder.Type.Column) {
      throw new SchemaBuilderError(`${name}: Primary field must be a column`)
    }

    this.entities[name] = {
      name: name,
      pluralName: options.pluralName || this.conventions.getPlural(name),
      primary: primaryName,
      primaryColumn: primaryField.options.columnName || this.conventions.getColumnName(primaryName),
      unique: this.createUnique(options, fieldOptions),
      fields: {},
      tableName: options.tableName || this.conventions.getTableName(name),
    }
  }

  public addEnum(name: string, values: string[]): void
  {
    this.enums[name] = values
  }

  public createSchema(): Schema
  {
    for (let entityName in this.fieldOptions) {
      let primaryField = this.entities[entityName].primary
      this.processField(entityName, primaryField)
      for (let fieldName in this.fieldOptions[entityName]) {
        if (fieldName === primaryField) {
          continue
        }
        this.processField(entityName, fieldName)
      }
    }

    return {
      enums: this.enums,
      entities: this.entities,
    }
  }

  private processField(entityName: string, fieldName: string): void
  {
    const processor = this.createProcessor(entityName, fieldName)
    processor.process(entityName, fieldName, this.fieldOptions[entityName][fieldName].options, this.registerField.bind(this))
  }

  private createProcessor(entityName: string, fieldName: string): FieldProcessor<any>
  {
    const field: FieldBuilder.Options = this.fieldOptions[entityName][fieldName]

    if (field.type === FieldBuilder.Type.Column) {
      return new ColumnProcessor(this.conventions)
    }
    this.checkTarget(entityName, fieldName, field.options)
    switch (field.type) {
      case FieldBuilder.Type.ManyHasMany:
        return new ManyHasManyProcessor(this.conventions)
      case FieldBuilder.Type.OneHasOne:
        return new OneHasOneProcessor(this.conventions)
      case FieldBuilder.Type.OneHasMany:
        return new OneHasManyProcessor(this.conventions)
      case FieldBuilder.Type.ManyHasOne:
        return new ManyHasOneProcessor(this.conventions)
    }

    throw new Error()
  }


  private checkTarget(entityName: string, fieldName: string, options: { target: string })
  {
    if (!this.entities[options.target]) {
      throw new SchemaBuilderError(`${entityName}::${fieldName}: undefined target entity ${options.target}`)
    }
  }

  private registerField(entityName: string, field: Column | AnyRelation)
  {
    if (!this.entities[entityName]) {
      throw new SchemaBuilderError(`Undefined entity ${entityName}`)
    }
    if (this.entities[entityName].fields[field.name]) {
      throw new SchemaBuilderError(`${entityName}: Field ${field.name} is already defined`)
    }
    this.entities[entityName].fields[field.name] = field
  }


  private getPrimaryFieldName(entityOptions: EntityBuilder.EntityOptions, entityName: string, fields: FieldBuilder.Map)
  {
    let primary: string[] = []
    if (entityOptions.primary) {
      primary.push(entityOptions.primary)
    }
    for (let name in fields) {
      const field: FieldBuilder.Options = fields[name]
      if (field.type !== FieldBuilder.Type.Column) {
        continue
      }
      if (!field.options.primary) {
        continue
      }
      if (!primary.includes(name)) {
        primary.push(name)
      }

    }
    if (primary.length > 1) {
      throw new SchemaBuilderError(`${entityName}: Only single column can be a primary. Found: ${primary.join(', ')}`)
    }
    return primary.length === 1 ? primary[0] : this.conventions.getPrimaryField()
  }

  private createDefaultPrimary(fieldName: string): FieldBuilder.Options
  {
    return {
      type: FieldBuilder.Type.Column,
      options: {
        nullable: false,
        type: "uuid",
        primary: true,
      },
    }
  }

  private createUnique(options: EntityBuilder.EntityOptions, fieldOptions: FieldBuilder.Map): Array<{ fields: string[], name: string }>
  {
    const unique = (options.unique || []).map(it => ({fields: it.fields, name: it.name || it.fields.join('_')}))
    for (let fieldName in fieldOptions) {
      let options = fieldOptions[fieldName]
      if (options.type === FieldBuilder.Type.Column && options.options.unique) {
        unique.push({fields: [fieldName], name: fieldName})
      } else if (options.type === FieldBuilder.Type.OneHasOne) {
        unique.push(({fields: [fieldName], name: fieldName}))
      }
    }
    return unique
  }
}
