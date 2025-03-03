import {
	AddProjectMemberCommand,
	MembershipUpdateInput,
	RemoveProjectMemberCommand,
	RemoveProjectMemberResponse,
	UpdateProjectMemberCommand,
	UpdateProjectMemberResponse,
} from '../commands'
import { ProjectMembershipByIdentityQuery, ProjectMembersQuery } from '../queries'
import { AddProjectMemberErrorCode, ProjectMembersInput } from '../../schema'
import { AccessVerifier, PermissionActions, TenantRole } from '../authorization'
import { indexListBy, notEmpty } from '../../utils/array'
import { createSetMembershipVariables } from './membershipUtils'
import { Acl, ProjectRole } from '@contember/schema'
import { Response } from '../utils/Response'
import { DatabaseContext } from '../utils'

export class ProjectMemberManager {
	async addProjectMember(
		dbContext: DatabaseContext,
		projectId: string,
		identityId: string,
		memberships: readonly Acl.Membership[],
	): Promise<AddProjectMemberResponse> {
		return await dbContext.transaction(async db => {
			return await db.commandBus.execute(
				new AddProjectMemberCommand(projectId, identityId, createSetMembershipVariables(memberships)),
			)
		})
	}

	async updateProjectMember(
		dbContext: DatabaseContext,
		projectId: string,
		identityId: string,
		memberships: readonly MembershipUpdateInput[],
	): Promise<UpdateProjectMemberResponse> {
		return await dbContext.transaction(
			async db => await db.commandBus.execute(new UpdateProjectMemberCommand(projectId, identityId, memberships)),
		)
	}

	async removeProjectMember(dbContext: DatabaseContext, projectId: string, identityId: string): Promise<RemoveProjectMemberResponse> {
		return await dbContext.transaction(
			async db => await db.commandBus.execute(new RemoveProjectMemberCommand(projectId, identityId)),
		)
	}

	async getAllProjectMemberships(
		dbContext: DatabaseContext,
		project: { id: string } | { slug: string },
		identity: { id: string; roles?: readonly string[] },
		verifier: AccessVerifier | undefined,
	): Promise<readonly Acl.Membership[]> {
		return [
			...this.getImplicitProjectMemberships(identity),
			...await this.getStoredProjectsMemberships(dbContext, project, identity, verifier),
		]
	}

	async getEffectiveProjectMemberships(
		dbContext: DatabaseContext,
		project: { id: string } | { slug: string },
		identity: { id: string; roles?: readonly string[] },
	): Promise<readonly Acl.Membership[]> {
		const implicit = this.getImplicitProjectMemberships(identity)
		if (implicit.length > 0) {
			return implicit
		}
		return await this.getStoredProjectsMemberships(dbContext, project, identity, undefined)
	}

	async getStoredProjectsMemberships(
		dbContext: DatabaseContext,
		project: { id: string } | { slug: string },
		identity: { id: string },
		verifier: AccessVerifier | undefined,
	): Promise<readonly Acl.Membership[]> {
		const memberships = await dbContext.queryHandler.fetch(
			new ProjectMembershipByIdentityQuery(project, [identity.id]),
		)
		if (verifier === undefined) {
			return memberships
		}
		return await this.filterMemberships(memberships, verifier)
	}

	private getImplicitProjectMemberships(identity: { id: string; roles?: readonly string[] }): readonly Acl.Membership[] {
		if (identity.roles?.includes(TenantRole.SUPER_ADMIN) || identity.roles?.includes(TenantRole.PROJECT_ADMIN)) {
			return [{ role: ProjectRole.ADMIN, variables: [] }]
		}
		return []
	}


	async getProjectMembers(dbContext: DatabaseContext, projectId: string, accessVerifier: AccessVerifier, input: ProjectMembersInput): Promise<GetProjectMembersResponse> {
		return dbContext.transaction(async db => {
			const members = await db.queryHandler.fetch(new ProjectMembersQuery(projectId, input))
			const memberships = await db.queryHandler.fetch(
				new ProjectMembershipByIdentityQuery(
					{ id: projectId },
					members.map(it => it.id),
				),
			)
			const filteredMemberships = await this.filterMemberships(memberships, accessVerifier)
			const byIdentity = indexListBy(filteredMemberships, 'identityId')
			return members
				.map(it => (byIdentity[it.id] ? { identity: it, memberships: byIdentity[it.id] } : null))
				.filter(notEmpty)
		})
	}

	private async filterMemberships<T extends Acl.Membership>(
		memberships: readonly T[],
		verifier: AccessVerifier,
	): Promise<T[]> {
		const filteredMemberships = await Promise.all(
			memberships.map(async membership => {
				if (!(await verifier(PermissionActions.PROJECT_VIEW_MEMBER([{ role: membership.role, variables: [] }])))) {
					return null
				}
				const variables = await Promise.all(
					membership.variables.map(async variable => {
						const values = await this.filterProjectMembershipVariableValues(membership, variable, verifier)
						return { name: variable.name, values }
					}),
				)
				if (variables.find(it => it.values.length === 0)) {
					return null
				}
				return { ...membership, variables }
			}),
		)
		return filteredMemberships.filter(notEmpty)
	}

	private async filterProjectMembershipVariableValues(
		membership: Acl.Membership,
		variable: Acl.MembershipVariable,
		verifier: AccessVerifier,
	): Promise<Acl.MembershipVariable['values']> {
		const values = await Promise.all(
			variable.values.map(async (value): Promise<string | null> => {
				const subMembership = {
					role: membership.role,
					variables: [
						{
							name: variable.name,
							values: [value],
						},
					],
				}

				if (!(await verifier(PermissionActions.PROJECT_VIEW_MEMBER([subMembership])))) {
					return null
				}
				return value
			}),
		)
		return values.filter(notEmpty)
	}
}

export type AddProjectMemberResponse = Response<null, AddProjectMemberErrorCode>

export type GetProjectMembersResponse = {
	identity: { id: string }
	memberships: readonly Acl.Membership[]
}[]
