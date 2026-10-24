# RCB Admin UI APIs Automation

Production read-only API smoke automation based on the supplied Postman collection. Every request is inventoried; write operations and missing prerequisites are explicitly skipped. Original source files remain unchanged.

## Run

Requires Node.js 22 or later.

```powershell
npm ci
npm run prepare
npm test
```

For the expanded rerun authorized in this session, use `npm run test:complete`. It attempts all 128 non-mutating APIs, including role switching and requests with absent fixtures. The 91 production-changing requests have an EXCLUDED remark per user instruction. There is no skip or blocker reclassification for attempted requests: assertion, HTTP, transport, and script failures remain FAIL. Eight read-only setup requests discover existing player, chat, bank, and deposit fixtures before the main run. Bank history can use the documented player filter if an account fixture is unavailable. Existing records are used for reads only; no IDs are fabricated.

The expanded run archives prior evidence and writes artifacts to `reports/runs/<execution timestamp>/`. `reports/LATEST-REPORTS.txt` lists the newest artifacts, so an older PDF open in the IDE cannot prevent report generation. Failed results include complete redacted request headers and body, response status and headers, and response body without truncation. The run's `bug-report.html` is the standalone failed API register and `bug-report.json` contains structured evidence. Fixture and request-validation failures are distinguished from potential API defects. The suite does not establish full functional correctness without an approved API specification and scenario data.

The default private environment is `environments/live.private.json`, copied from the original supplied environment. This file is ignored by Git. To use a different environment, copy a template to an ignored `environments/*.private.json` file and set `$env:RCB_ENVIRONMENT` to that path. Credentials never belong in source control. Login can end the same admin's existing UI session, as documented by the supplied collection. Subadmin role switching is excluded.

The runner always forces `allow_writes=false`. It does not execute transfers, payouts, result declarations, broadcasts, account changes, or password disclosure. Full write workflow validation requires an isolated environment and dedicated fixtures with cleanup; it is not claimed by this suite.

## Layout

- `collections/`: named Postman collection with original request assertions and dependency extraction.
- `environments/`: sanitized LIVE and local test templates; test ports are placeholders, not verified deployments.
- `config/endpoint-inventory.json`: all request IDs, folders, methods, and resolved LIVE URLs.
- `scripts/`: preparation, Newman execution, and report generation.
- `reports/`: execution JSON, searchable HTML, Word, PDF, and bug/blocker JSON. Treat these as confidential.

## Assertions and evidence

Runs the original request tests plus HTTP server-error checks, a 10 second response-time threshold, JSON parsing where advertised, and business success checks supporting `1`, boolean `true`, and documented empty-data messages. Empty-data passes do not certify populated-data behavior. This is smoke coverage; no API specification or approved schemas were supplied. Binary endpoints retain original status checks. Saved collection examples are never counted as execution results.

Each report includes all endpoints, production bases, timestamps, assertion outcomes, skips, and findings. JUnit XML and endpoint CSV support CI ingestion. Error responses are redacted and truncated at 8000 characters. Personal data is not retained from successful response bodies. Findings are potential defects pending triage; network, credentials, and fixture issues are blockers. No separate PROD host is invented.

Exit code is nonzero on failures, blockers, or a fatal runner error. Skipped coverage must be reviewed before release approval. Run `npm run report` to regenerate reports from the last execution. Reports and local credentials are ignored by Git.

## Dependency maintenance

Newman includes legacy transitive dependencies. Review `npm audit` before CI adoption, pin dependencies using the lockfile, and run the runner in an isolated CI job. Never disable TLS certificate validation. On corporate Windows networks, use `NODE_USE_SYSTEM_CA=1` where supported to trust managed certificates.
