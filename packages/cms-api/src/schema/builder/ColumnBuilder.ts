import FieldBuilder from "./FieldBuilder"


class ColumnBuilder<O extends PartialColumnOptions<never> = PartialColumnOptions<never>> implements FieldBuilder<O>
{
  private options: O

  constructor(options: O)
  {
    this.options = options
  }

  public columnName(columnName: string): ColumnBuilder<O>
  {
    return new ColumnBuilder<O>({...(this.options as object), columnName} as O)
  }

  public type(type: string): ColumnBuilder<O & PartialColumnOptions<'type'>>
  {
    return new ColumnBuilder<O & PartialColumnOptions<'type'>>({...(this.options as object), type: type} as O & PartialColumnOptions<'type'>)
  }

  public nullable(): ColumnBuilder<O>
  {
    return new ColumnBuilder<O>({...(this.options as object), nullable: true} as O)
  }

  public notNull(): ColumnBuilder<O>
  {
    return new ColumnBuilder<O>({...(this.options as object), nullable: false} as O)
  }

  public unique(): ColumnBuilder<O>
  {
    return new ColumnBuilder<O>({...(this.options as object), unique: true} as O)
  }

  public primary(): ColumnBuilder<O>
  {
    return new ColumnBuilder<O>({...(this.options as object), primary: true} as O)
  }

  getOption(): O
  {
    return this.options
  }
}

namespace ColumnBuilder
{
  export type Options = {
    type: string
    columnName?: string
    unique?: boolean
    nullable?: boolean
    primary?: boolean
  }
}

type PartialColumnOptions<K extends keyof ColumnBuilder.Options> = Partial<ColumnBuilder.Options> & Pick<ColumnBuilder.Options, K>

export default ColumnBuilder
