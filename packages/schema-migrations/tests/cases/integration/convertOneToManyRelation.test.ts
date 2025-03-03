import { testMigrations } from '../../src/tests'
import { SchemaBuilder } from '@contember/schema-definition'
import { Model } from '@contember/schema'
import { SQL } from '../../src/tags'

testMigrations('convert one has one to many has one relation without inverse side', {
	originalSchema: new SchemaBuilder()
		.entity('Post', entity =>
			entity.oneHasOne('image', rel => rel.target('Image')),
		)
		.entity('Image', e => e.column('url', c => c.type(Model.ColumnType.String)))
		.buildSchema(),
	updatedSchema: new SchemaBuilder()
		.entity('Post', entity =>
			entity.manyHasOne('image', rel => rel.target('Image')),
		)
		.entity('Image', e => e.column('url', c => c.type(Model.ColumnType.String)))
		.buildSchema(),
	diff: [
		{
			modification: 'convertOneToManyRelation',
			entityName: 'Post',
			fieldName: 'image',
		},
	],
	sql: SQL`
		CREATE INDEX ON "post" ("image_id");
		ALTER TABLE "post" DROP CONSTRAINT "uniq_post_image_id";
	`,
})


testMigrations('convert one has one to many has one relation with inverse side', {
	originalSchema: new SchemaBuilder()
		.entity('Post', entity =>
			entity.oneHasOne('image', rel => rel.target('Image').inversedBy('post')),
		)
		.entity('Image', e => e.column('url', c => c.type(Model.ColumnType.String)))
		.buildSchema(),
	updatedSchema: new SchemaBuilder()
		.entity('Post', entity =>
			entity.manyHasOne('image', rel => rel.target('Image').inversedBy('posts')),
		)
		.entity('Image', e => e.column('url', c => c.type(Model.ColumnType.String)))
		.buildSchema(),
	diff: [
		{
			modification: 'convertOneToManyRelation',
			entityName: 'Post',
			fieldName: 'image',
			newInverseSideFieldName: 'posts',
		},
	],
	sql: SQL`
	CREATE INDEX ON "post" ("image_id"); 
	ALTER TABLE "post" DROP CONSTRAINT "uniq_post_image_id";
`,
})

