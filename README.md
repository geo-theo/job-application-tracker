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
   (a)(ii) Company (text entry) (also allow user to check a box to save as a favorite target company)
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
(c)(iii) Area of Work (two drop-down menus side-by-side, first one for Industry, and second one for Helping)(Industry dropdown menu, select one: "Geospatial", "Geopolitical Risk", "Intl Development", "Defense & Security", "Local Government", "Outdoors", "Other" (text entry option))(Who is it helping? dropdown menu, select multiple: "Poor", "Rich", "Govt", "Startup", "Environment")
(c)(v) Job Description (two options side-by-side; first option is a button to "Scrape Job Description", second option is an empty text box for user to paste the job description manually in case webscraping is not possible for this job)

2. Database or CSV
   -Save the job info that the user entered in the form, into a csv or other form of database. Each new submission gets a new record row.
   -If possible, when a user submits a link to a job, perhaps that link could be used to scrape the job description text from that job posting's webpage? If not possible the user can also paste the job description into a text box. Either way, these job descriptions should be saved as individual txt files (separate from the csv/database) in a subfolder.

3. Personal Job Board
   -Make this section occupy the right half of the webpage.
   -The top of this section should have different filter buttons: Status (filter for Applied, Urgent, High, or Low), Deadline (sort by soonest deadlines), Role (select role attribute(s)).
   -Each job gets its own card row, and clicking on the card lets you edit the record (by opening it in the form section of the left side of the page and allowing users to resubmit the edited form).
   -Show the following information on each job row, ordered left to right in the card (keep as blank space if the record has blank entry for given column): Job Title (and Company in smaller text right below), Location, Pay Range (or avg salary if range not provided), Deadline (or just say "ASAP" in red if no deadline provided), Role (use different colored chips to show the role attribute(s)), and Priority (use green/red/orange/yellow chips to signify Applied/Urgent/High/Low), and a Link button that takes you to the link.

## Implementation notes

This is a static GitHub Pages app, so it cannot write directly back to the GitHub repository without a separate backend service. The app uses browser IndexedDB as the live database, with one record per saved job and a separate description store for job descriptions.

Data controls in the board let you:

- export all records to `jobs.csv`
- import a previously exported CSV
- export saved job descriptions as individual `.txt` files
- connect a local folder in supported browsers so the app can write `jobs.csv` and `job-descriptions/*.txt`

To deploy, enable GitHub Pages for the repository root. `index.html`, `styles.css`, and `app.js` are the only files needed for the public page.
