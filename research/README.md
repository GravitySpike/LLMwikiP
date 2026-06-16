# Gap Research Loop

This folder stores lightweight state for the scheduled wiki growth loop.

- `queue/`: research plans for unresolved knowledge gaps
- `last-run.json`: latest non-dry-run loop summary

Run:

```sh
npm run loop:gaps
```

The default interval is 12 hours. Web intake is disabled by default and can be enabled with `ENABLE_WEB_RESEARCH=1`.
