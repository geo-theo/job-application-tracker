# job-application-tracker

This job application tracking tool has three components:

1. Online submission form to record information about a given job. It is okay if questions are left blank.
2. Information about a job entered in the form gets saved to a CSV or some type of database (one row for each job record submitted, one column for each question on the form).
3. Use the saved job records to show a personalized job board which I can use to filter through jobs I've saved based on my current priorities, and I can click on the record in order to be sent to their apply page. Clicking on the record also gives the user an option to edit or add more information to a record (by updating the csv/database in the backend).

Each component of the tool should have the features listed below.

1. Questionnaire Form:
   -Make this section occupy the left half of the webpage;
   -There will be a lot of questions to fill in, so it's okay if the user has to scroll through the form (make sure only this section box on the left half of the page is scrolling, we don't want the sections on the right side of the page to scroll when this form is scrolled);
   -When the user enters a link to the job description, allow the user to either copy/paste the job description into a text box
   -Once the user clicks the submit button, save the answers into a csv or database. If a user enters a job description, save each job description as individual txt files in a subfolder (or whatever file format is smaller)
   -Include the following questions that the user can check/select/write-in:
   (a) Job Info
   (a)(i) Link (text entry)
   (a)(ii) Company (text entry backed by `companies.csv`, with an **Edit Company Info** button for company details)
   (a)(iii) Job Title (text entry)
   (a)(iv) Location (multiple choice, select one: "Missoula, MT", "Remote", "Other" (text entry option))
   (a)(v) Pay (multiple choice, select one: "Hourly" or "Salary")(two empty text boxes side-by-side, one for Minimum and one for Maximum, and let user enter the values after selecting "Hourly" or "Salary")(once a min and max value has been entered, automatically calculate and display (and save to csv/database) the midpoint value between the min and max)

(b)Application Details
(b)(i) Priority (multiple choice, select one: "Urgent", "High", "Low")
(b)(ii) Dates (two empty boxes side-by-side with a small expandable calendar for the user to select a date)(first date box should be for "Date Posted")(second date box should be for "Deadline")
(b)(iii) Applied? (date selection box for user to specify apply date, if applicable)

(c) Job Attributes
(c)(i) Favorite this job (checkbox for user to save this record as a favorite job)
(c)(ii) Role (dropdown menu, select multiple:)
(c)(iii) Company classifications such as Industry and Mission are managed once in the company editor and shared by every linked job.
(c)(v) Job Description (two options side-by-side; first option is a button to "Scrape Job Description", second option is an empty text box for user to paste the job description manually in case webscraping is not possible for this job)

2. Database or CSV
   -Save the job info that the user entered in the form, into a csv or other form of database. Each new submission gets a new record row.
   -Save company details in `companies.csv`. Each job row stores `companyId`, which links to the company row's unique `id`.
   -If possible, when a user submits a link to a job, perhaps that link could be used to scrape the job description text from that job posting's webpage? If not possible the user can also paste the job description into a text box. Either way, these job descriptions should be saved as individual txt files (separate from the csv/database) in a subfolder.

3. Personal Job Board
   -Make this section occupy the right half of the webpage.
   -The top of this section should have different filter buttons: Status (filter for Applied, Urgent, High, or Low), Deadline (sort by soonest deadlines), Role (select role attribute(s)).
   -Each job gets its own card row, and clicking on the card lets you edit the record (by opening it in the form section of the left side of the page and allowing users to resubmit the edited form).
   -Show the following information on each job row, ordered left to right in the card (keep as blank space if the record has blank entry for given column): Job Title (and Company in smaller text right below), Location, Pay Range (or avg salary if range not provided), Deadline (or just say "ASAP" in red if no deadline provided), Role (use different colored chips to show the role attribute(s)), and Priority (use green/red/orange/yellow chips to signify Applied/Urgent/High/Low), and a Link button that takes you to the link.

## Implementation notes

This is a static GitHub Pages app, so it cannot write directly back to the GitHub repository without a separate backend service. The app uses browser IndexedDB as the live database, with separate stores for jobs, companies, and job descriptions.

`companies.csv` contains `id`, `createdAt`, `updatedAt`, `name`, `industry`, `sector`, `mission`, `website`, and `rank`. The timestamps are system-managed merge metadata. Company names are unique case-insensitively, custom Industry/Sector entries are stored directly in those columns, and Mission values use the same semicolon-separated convention as other multi-select fields. Company ranks are Favorite, Target, Normal, and Agency.

Data controls in the board let you:

- export jobs to `jobs.csv` and companies to `companies.csv`
- import previously exported job or company CSV files
- export saved job descriptions as individual `.txt` files
- connect a local folder in supported browsers so the app can write `jobs.csv`, `companies.csv`, and `job-descriptions/*.txt`

## Git sync workflow

Use Git as the portable source of truth and the browser database as a local cache:

1. Open the app through GitHub Pages or a local server, not directly from `index.html`, so it can read `db/jobs.csv` and `db/companies.csv`.
2. Click **Connect Folder** and select either the repository folder or its `db` folder. After that, saved jobs are written to `db/jobs.csv`, company records to `db/companies.csv`, and descriptions to `db/job-descriptions/`.
3. Commit and push those changed files.
4. On another device, pull the repo and reload the app. The app imports both CSV files and joins jobs to companies by ID.

To deploy, enable GitHub Pages for the repository root. Include `index.html`, `styles.css`, `app.js`, `viz.css`, `viz.js`, `viz-geography.js`, `research.css`, `research.js`, and the `img` directory. No build step or chart CDN is required.

## Research dashboard

Research analyzes the saved market rather than application outcomes. Its default sample includes every job not marked Applied plus anything deliberately kept as a Reference. The Source control can narrow that sample to active prospects or the Reference library, and Job type, Role, and Industry filters apply to every summary and chart on the page.

The description panel reads locally saved job-description text and creates a collective brief plus ranked resume signals for tools and technology, core capabilities, domain knowledge, and qualifications. A separate Frequent words view derives terms directly from the selected descriptions after removing common job-posting language. Percentages show the share of descriptions containing a signal; repeated mentions within one description do not inflate coverage. Selecting a signal opens the matching jobs, while Copy brief copies the current market summary for drafting notes.

The remaining panels quantify roles, industries, advertised salary, company mission tags, and location for the same selected sample. All chart rows open their underlying jobs. The Research dashboard is read-only and performs all text analysis locally in the browser.

## Viz dashboard

All Viz charts analyze applied jobs. References are excluded using the same rule as the board: Future priority or Applied = No. Board filters do not affect Viz. The first summary card is the exception: it shows pending jobs, broken down by priority, including an Unranked count when needed.

The **Exclude job types** checkboxes at the top independently exclude Internships and Part-time jobs from every summary figure, chart, and drill-down, including the pending-jobs card. Both start unchecked. A job with multiple types is excluded if any selected type matches; selections remain in place while navigating within the app. Reference exclusions are counted separately.

The other summary cards show:

- Applications this calendar week, month, quarter, year, and all time. Weeks start Monday; calendar totals run through today in the user's timezone. Missing application dates count only in all time.
- Mean annual pay and the 25th/75th percentiles of job-level pay midpoints, using linear interpolation. Hourly pay is annualized with **average hourly wage × 8 × 21 × 12 = hourly × 2,016**. Missing pay is excluded.
- The proportion of applications tagged Govt or Poor, and this month's share versus the previous full calendar month. Relative change is `(current share − previous share) / previous share × 100`; the percentage-point difference is separate. A zero baseline or a month without applications produces an unavailable relative change rather than an infinite or invented percentage.

- **Application flow:** proportional streams pass through recorded milestones and end in In progress, Accepted, Rejected, or Ghosted. A No response branch above Responded contains only in-progress applications with no recorded milestones. Closed applications never enter that branch. Other skipped milestones are not inferred. Columns follow the form's stage order, not event dates; each application reaches one current outcome.
- **Pay explorer:** group by company-linked industry, role, or normalized location. The dot is the mean of each job's advertised midpoint, and the line spans the lowest to highest advertised pay in that group. A lone bound or saved midpoint can supply a value. Missing, invalid, nonpositive, and unknown-type pay are excluded. Annual salary and hourly pay stay separate by default; Annual equivalent uses the same 2,016-hour formula as the summary and map, including internships and part-time jobs as comparison equivalents. Role groups can overlap; the overall mean counts each job once.
- **Impact:** public purpose means the linked company's Mission includes Govt or Poor, counted once per job. All Mission tags are also shown individually, including Environment and untagged records.
- **Map:** Remote comes first, followed by USA, France, UK, and additional countries recognized in the applications. City lists are filtered to the selected tab. Remote and missing-location applications share one Missoula home-base pin, with separate list entries and counts. Known city/area aliases include DMV, Silicon Valley, Los Angeles, London, Paris, and Amsterdam. New countries are detected from country names/codes in the location; cities without a known coordinate stay in that country's list without guessed pins. Hover or focus a pin for mean annualized pay, pay coverage, and deduplicated role attributes; activate it to see the jobs.
- **Activity:** daily, weekly, or monthly application cohorts, including quiet periods, colored by today's saved outcome. Automatic grouping uses daily bars for short windows, weekly bars for medium windows, and monthly bars for long or all-time views. Very long daily/weekly views are coarsened to keep the chart usable. Metrics show application count and change versus the preceding window of equal length, applications/week, milestone and interview rates, applications awaiting a first reply, mission-driven share, average annualized pay, and median days to the first dated reply. First reply includes recorded milestones or accepted/rejected decisions; undated or negative intervals are excluded. All-time application pace uses the first valid application date through today.

The flow and activity panels have independent calendar filters: Last week/month/quarter/year explicitly mean the last **7/30/90/365 days**, including today. Both also offer All time and an inclusive custom date range. These filters use application dates; outcomes remain the current saved outcomes. Missing or invalid dates are excluded from dated windows and bars, but retained in all-time summary totals.

Chart selections open the underlying job list; selecting a job opens its existing edit form. Controls and SVG marks support keyboard activation. The dashboard uses the connected folder's live records and never modifies job data during analysis.

Run the calculation checks with `node --test tests/viz.test.cjs`.

The bundled country metadata and outlines in `viz-geography.js` are derived from [Natural Earth 1:110m data](https://github.com/nvkelso/natural-earth-vector), which is [public domain](https://www.naturalearthdata.com/about/terms-of-use/). Regenerate them with `node scripts/build-viz-maps.cjs` (Node 18+ and network access); the dashboard itself makes no external map or geocoding requests.
