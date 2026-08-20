# Contributing

```bash
npm install --ignore-scripts
npm run verify
```

The project intentionally has no runtime or development dependencies.

Pull requests should:

- include focused tests for parser or policy behavior
- preserve deterministic finding IDs and ordering
- document new configuration fields and rule semantics
- state compatibility impact for report or exit-code changes
- avoid project-specific policy in the generic defaults
- never include private events, credentials, production paths, or proprietary source

New rules should be evidence checks, not attempts to infer whether code is semantically correct.
