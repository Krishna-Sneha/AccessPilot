# GitLab roles and permissions

Source: https://docs.gitlab.com/user/permissions/
Additional source: https://docs.gitlab.com/auth/user_permissions/

This is a concise reference for AccessPilot recommendations. GitLab permissions can vary by GitLab.com tier, self-managed configuration, group inheritance, protected branches, and custom roles. Confirm the final decision with the project owner.

## Reporter

Use when someone needs read-oriented access. A Reporter can view project code, create issues, and generate reports. A Reporter cannot push code or manage protected branches.

Typical request language: read code, browse a repository, clone a project, review project activity.

## Developer

Use when someone needs to contribute code. A Developer can push code to non-protected branches, create merge requests, and run CI/CD pipelines. A Developer does not manage project settings.

Typical request language: push code, create commits, create merge requests, work on branches, run pipelines.

## Maintainer

Use when someone needs to manage project delivery or configuration. A Maintainer can manage branches, merge requests, CI/CD settings, and project members. Maintainer is more privileged than Developer.

Typical request language: configure pipelines, manage CI/CD variables, manage protected branches, manage project members, configure project settings.

## Owner

Use for full control of a GitLab group or project. Owner-level capabilities can include managing group membership, creating subgroups, changing visibility, and deleting or transferring resources. Recommend this role only when the request clearly requires group or project ownership responsibilities.

Typical request language: create subgroups, manage group members, change group visibility, transfer or delete a group.

## Guest

Use for limited participation such as viewing and commenting on issues or epics. Guest does not provide normal repository access for private projects.

## Least-privilege guidance

- Read or browse code: Reporter.
- Push code or create merge requests: Developer.
- Configure CI/CD or manage project members: Maintainer.
- Create subgroups or manage group-level membership: Owner.
- Only discuss or view project planning items: Guest.

## Important context

Roles can be inherited from parent groups, and a user may have different roles for different projects. The highest applicable role can determine effective permissions. Protected branches and organization-specific custom roles can change the result.
