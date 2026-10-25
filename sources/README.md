# Sources

The plan rules in `rules.js` and the right response for every test line in `eval/golden.js` come from these documents. Copies are kept here so the demo can be checked even if a link moves; each one matches the file at its original address (checksums below, retrieved 2026-10-25).

| File | What it is | Original | SHA-256 |
|---|---|---|---|
| `2026-summary-of-benefits-H6622-026.pdf` | 2026 Summary of Benefits, a Medicare Advantage HMO-POS plan (24 pages) | https://assets.humana.com/is/content/humana/H6622026000SB26pdf | `56c9882f3fb7bab379cdb18711ccffce4c9c8767ada6151bd887c3a3f69e3df6` |
| `2026-evidence-of-coverage-H6622-026.pdf` | 2026 Evidence of Coverage for the same plan (184 pages) | https://assets.humana.com/is/content/humana/H6622026000EOC26pdf | `94b582a35121399a8902e7584f5bbdefa0661959f3ae9fdb79bef9c92d08b9bb` |
| `42-cfr-422-561-grievance.md` | Federal definition of a grievance (excerpt) | https://www.law.cornell.edu/cfr/text/42/422.561 | n/a |

Page numbers cited across the site are PDF page numbers. The documents are public plan materials, reproduced here for reference only. CureCue is not affiliated with or endorsed by any health plan. Members, providers, calls and records in the demo are fictional.

To check a copy: `shasum -a 256 sources/*.pdf`, then download the original and compare.
