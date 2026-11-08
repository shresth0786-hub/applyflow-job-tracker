<!-- coderabbit-ai-generated:v1 -->

# Applyflow

A local job search workspace for tracking applications and comparing resume keywords with job descriptions.

## Run

Requires Node.js 20 or newer. Run `npm start`, then open http://localhost:3000. Run `npm test` for the logic tests.

Applications are stored in the current browser's local storage, so they are specific to that browser and can be lost if its site data is cleared. Resume and job description text are processed locally and are not saved by the app.

## Job sites

LinkedIn, Naukri, Indeed and Google Jobs links open searches based on the entered role and location. Glassdoor uses the role, and Wellfound opens its jobs page. Search results and applying are handled by each site. These links do not connect accounts or automatically submit applications.

## Match assistant

The match assistant compares frequent words from the job description with the resume. It is a simple keyword comparison, not a trained model or an evaluation of a person's qualifications. Review missing terms and only add skills that are true. This repository did not contain a model or training data.
