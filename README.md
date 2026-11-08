<!-- coderabbit-ai-generated:v1 -->

# Applyflow

A local job search workspace for tracking applications and comparing resume keywords with job descriptions.

## Run

Requires Node.js 20 or newer. Run `npm start`, then open http://localhost:3000. Run `npm test` for the logic tests.

Applications are stored in the current browser's local storage, so they are specific to that browser and can be lost if its site data is cleared. Resume and job description text are processed locally and are not saved by the app.

## Job sites

LinkedIn, Naukri, Indeed and Google Jobs links open searches based on the entered role and location. Glassdoor uses the role, and Wellfound opens its jobs page. Search results and applying are handled by each site. These links do not connect accounts or automatically submit applications.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:fc50da4dad227e39f9fe6b1b0b2804cea53dd4d852cafa63398200b31792bfd8 -->

## Match assistant

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:0505fd211408b7f0fd43b39a0e3e2e42fb4ed03e88c271b2375aeb272eebf376 -->

The match assistant provides keyword feedback and can load a locally hosted model that passes the evaluation checks described below. All resume and job text stays in the browser. Missing, invalid, slow, or unevaluated models fall back to keyword review. Feedback does not evaluate qualifications or predict hiring decisions. Only include experience that is true.

<!-- /coderabbit-ai-generated:v1 -->

## Experimental model training

`experiments/train_match_model.py` trains a small regression model on the public [job-resume-matching dataset](https://huggingface.co/datasets/nonameee12233/job-resume-matching). It predicts that dataset's `final_score` from word overlap and frequency in a resume and job description. This experiment is separate from the app's keyword comparison. The scores are modeling signals, not verified hiring outcomes; the dataset contains positive pairs only and the card's license information is ambiguous. Confirm the source rights before distributing the dataset or derived artifacts.

The identity-based split holds out both candidates and jobs. Pairs with only one held-out identity are excluded. The script checks file hashes and exports aggregate metrics and model coefficients, without copying resumes into the output. Python 3 is the only dependency.

To reproduce, download the three files from the pinned revision into a private directory outside the repository, then run:

```sh
python3 experiments/train_match_model.py --data-dir /path/to/data --output /path/to/match-experiment.json
python3 -m unittest discover -s experiments -v
```

Use these files from revision `6186dded39f983b96a1a2eb4d1ecf365a90a46f9`: `cv.csv`, `job.csv`, and `matches.csv`. The dataset may contain personal information; do not commit the CSVs.

In the recorded run, the model's mean absolute error on 5,195 held-out pairs was 0.0262 versus 0.0270 for the training-mean baseline; R² was 0.079. This small improvement on existing positive pairs does not establish reliable matching of arbitrary resumes to jobs. <!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:7ce1c6c802c7e007f648c9854fc425b01251c45af5ba1a712c4914316eec640a -->

The original regression experiment is not connected to the application.

## Reviewed-data model

A replacement pipeline is ready in `experiments/train_reviewed_model.py`. Real retraining is pending independently reviewed positive and negative data with confirmed training rights. Templates are in `experiments/reviewed-pairs.example.csv` and `experiments/reviewed-data.example.json`.

Each CSV row needs candidate_id, job_id, resume_text, job_description, label (0 for poor match, 1 for good match), and reviewer_id. Have a person assess the actual experience against the role requirements; do not label arbitrary unobserved pairs as negatives. Resolve duplicate pairs and conflicting labels before training. Keep the completed dataset outside the checkout. Fill in source and training_rights_confirmed in metadata only after checking the source permissions. Metadata declarations record the data provider's attestations; the script cannot independently verify them.

```sh
python3 experiments/train_reviewed_model.py --pairs /private/pairs.csv --metadata /private/metadata.json --output /private/matcher.json
```

The pipeline trains logistic regression from text overlap features. Normalized text determines train/validation/test assignments (60/20/20 per entity); only pairs whose resume and job are in the same partition are retained. This prevents exact text duplicates crossing splits, but does not detect near duplicates. The threshold is selected on validation data; the test set is used for final reporting. No applicant IDs, reviewer IDs, or raw text are exported.

Initial engineering requirements: at least 100 test pairs with at least 25 of each class, F1/precision/recall at least 0.75, and F1 at least 0.05 above the training-majority baseline. These defaults require domain review before production and do not guarantee generalization. When `deployable` is true, an operator may place the resulting JSON at `public/models/matcher.json`. The browser independently checks the schema and recorded metrics before enabling feedback. Only install artifacts from a trusted training run. The supplied placeholder leaves model feedback disabled.

```sh
npm test
python3 -m unittest discover -s experiments -v
```

The tests include synthetic fixtures to exercise training and rejection behavior; their results are not evidence of real matching quality.

<!-- /coderabbit-ai-generated:v1 -->


<!-- /coderabbit-ai-generated:v1 -->
