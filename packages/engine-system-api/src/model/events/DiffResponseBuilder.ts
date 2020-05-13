import { AnyEvent, EventType } from '@contember/engine-common'
import { Event as ApiEvent, EventType as ApiEventType } from '../../schema'
import { assertNever } from '../../utils'
import { EventPermission } from './EventsPermissionsVerifier'
import { EventWithMeta } from './DiffBuilder'

export class DiffResponseBuilder {
	public buildResponse(events: EventWithMeta[]): ApiEvent[] {
		const apiEventTypeMapping = {
			[EventType.create]: ApiEventType.Create,
			[EventType.update]: ApiEventType.Update,
			[EventType.delete]: ApiEventType.Delete,
			[EventType.runMigration]: ApiEventType.RunMigration,
		}

		return events.map(it => ({
			createdAt: it.createdAt,
			allowed: it.permission === EventPermission.canApply,
			dependencies: it.dependencies,
			id: it.id,
			type: apiEventTypeMapping[it.type],
			description: this.formatDescription(it),
		}))
	}

	private formatDescription(event: EventWithMeta): string {
		if (event.permission === EventPermission.forbidden) {
			return 'Forbidden'
		}

		switch (event.type) {
			case EventType.create:
				return `Creating ${event.tableName}#${event.rowId}`
			case EventType.update:
				return `Updating ${event.tableName}#${event.rowId}`
			case EventType.delete:
				return `Deleting ${event.tableName}#${event.rowId}`
			default:
				return assertNever(event)
		}
	}
}
