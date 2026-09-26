# Test fixtures

- `tum-info-courses.sample.json`: a small, unmodified excerpt (7 records) of the public TUM Info API
  (`api/courses.json` from github.com/mcmikecreations/tum_info, GPL-3.0). It includes a regular
  exam, a pass/fail exam (7.0/8.0 codes), a retake and a suffixed module code. Remove it together
  with the importer if the data may not be used.
- `tumonline-exam-statistics.en.html`: a TUMonline "exam statistics" page (English UI, 2026),
  trimmed (styles/scripts/navigation removed) and anonymised (the profile name is replaced with
  "Max Mustermann"). The statistics block and Plotly chart markup are unchanged.
- `planner/cit-studienplan-bsc-*.html`: the CIT "Studienplan" pages of B.Sc. Informatik and
  B.Sc. Wirtschaftsinformatik (content area only, fetched 2026-09-25).
- `planner/nat-module-IN0001.json`, `planner/nat-course-950941194.json`: responses of the public
  TUM NAT API (`api.srv.nat.tum.de/api/v1/mhb/module/{code}`, `/course/{id}`), fetched 2026-09-25.
  Staff names and e-mail addresses were removed; the course fixture keeps its first three groups.
- `clubs/tum-club-gallery.page1.html`: first page of the TUM Student Club Gallery
  (https://www.tum.de/en/community/campus-life/student-clubs-gallery), filters, cards and
  pagination only, fetched 2026-09-26.
