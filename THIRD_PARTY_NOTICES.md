# Third-Party Notices

QC Workbench v1.0.0 contains no bundled third-party runtime library code.

The application uses standard browser APIs and system fonts directly. The GitHub Actions workflows reference GitHub-maintained actions under the terms published by those projects.

When adding a package to `dependencies.json`:

1. Add its name, exact version, license, and homepage to this file.
2. Sync and commit the corresponding `dependencies.lock.json` entry.
3. Include every copyright notice and license text required for redistribution.
4. Update both README files when the dependency materially affects privacy, size, or capability.
5. Commit regenerated dependency metadata according to the repository policy.

Do not assume that a package being available from npm makes it compatible with MIT redistribution.
