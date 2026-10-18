# Jira permissions and roles

Source: https://support.atlassian.com/jira-cloud-administration/docs/types-of-permissions-in-jira/
Additional source: https://support.atlassian.com/jira-cloud-administration/docs/manage-project-role-membership/

This is a concise reference for AccessPilot recommendations. Jira permissions depend on the Jira plan, whether the project is company-managed or team-managed, permission schemes, project roles, and work-item security.

## Viewer or browse access

Use when someone only needs to browse a project and view work items. Browse access is a prerequisite for many other project actions.

Typical request language: view tickets, browse a project, read the backlog, see sprint information.

## User or contributor access

Use when someone needs to create or edit work items and collaborate with a delivery team.

Typical request language: create tickets, edit issues, add comments, update status, work on a sprint board.

## Developer or delivery access

Use when someone needs to work across boards and sprints as part of software delivery. Specific capabilities are controlled by the project permission scheme.

Typical request language: manage sprint work, work across boards, update delivery items, coordinate releases.

## Administrator access

Use only when someone needs to administer a project or configure permissions, workflows, versions, components, or other project settings. This is a privileged role and should require explicit owner approval.

Typical request language: configure workflows, manage project settings, manage versions, edit permission schemes, administer a project.

## Least-privilege guidance

- Read or browse tickets: Viewer.
- Create and update work items: User.
- Work across boards and sprints: Developer or the organization’s delivery role.
- Configure a project or its permissions: Administrator.

## Important context

Jira uses multiple permission layers: global permissions, project or space permission schemes, project roles, and work-item security. The organization’s role names may differ from these demo labels, so AccessPilot should present the recommendation as a starting point for approval.
