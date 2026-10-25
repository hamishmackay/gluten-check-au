# Automatic product-page research

Implementation is on `feature/page-evidence-research`; not production-complete.
See `worker/README.md` for architecture, supported sources, testing and limitations.
The four acceptance barcodes are in `tests/live.mjs`. That check intentionally fails
when discovery, identity or fetched declaration extraction is incomplete.
Production promotion requires all four real responses and rendered evidence to pass.
