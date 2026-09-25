# Test fixtures

- `tum-info-courses.sample.json`: a small, unmodified excerpt (7 records) of the public TUM Info API
  (`api/courses.json` from github.com/mcmikecreations/tum_info, GPL-3.0). It includes a regular
  exam, a pass/fail exam (7.0/8.0 codes), a retake and a suffixed module code. Remove it together
  with the importer if the data may not be used.
- `tumonline-exam-statistics.en.html`: a TUMonline "exam statistics" page (English UI, 2026),
  trimmed (styles/scripts/navigation removed) and anonymised (the profile name is replaced with
  "Max Mustermann"). The statistics block and Plotly chart markup are unchanged.
