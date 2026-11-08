import csv
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import train_match_model as model


class MatchExperimentTests(unittest.TestCase):
    def test_features_capture_word_overlap(self):
        resume = model.tokens('Python React React')
        job = model.tokens('React Python testing')
        values = model.features(resume, job)
        self.assertAlmostEqual(values[1], 2 / 3)
        self.assertEqual(values[2], 1)
        self.assertAlmostEqual(values[3], 3 / (5 * 3) ** 0.5)

    def test_linear_solver(self):
        self.assertEqual(model.solve([[2., 0.], [0., 4.]], [6., 8.]), [3., 2.])

    def test_candidate_and_job_groups_are_disjoint(self):
        def ids(kind, heldout, count):
            return [str(n) for n in range(1000) if model.is_holdout(kind, str(n)) == heldout][:count]
        train_candidates, test_candidates = ids('candidate', False, 2), ids('candidate', True, 1)
        train_jobs, test_jobs = ids('job', False, 2), ids('job', True, 1)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            def write(name, fields, rows):
                with (path / name).open('w', newline='', encoding='utf-8') as file:
                    writer = csv.DictWriter(file, fieldnames=fields)
                    writer.writeheader()
                    writer.writerows(rows)
            write('cv.csv', ['candidate_id', 'resume_text'], [{'candidate_id': c, 'resume_text': 'Python developer'} for c in train_candidates + test_candidates])
            write('job.csv', ['job_id', 'job_description'], [{'job_id': j, 'job_description': 'Python testing'} for j in train_jobs + test_jobs])
            write('matches.csv', ['candidate_id', 'job_id', 'final_score'], [{'candidate_id': c, 'job_id': j, 'final_score': '.6'} for c in train_candidates + test_candidates for j in train_jobs + test_jobs])
            with patch.object(model, 'verify_files'):
                result = model.run(path)
        self.assertEqual(result['rows'], {'train': 4, 'test': 1, 'excluded_cross_split': 4, 'missing_text': 0})
        self.assertEqual(result['identities']['candidate_overlap'], 0)
        self.assertEqual(result['identities']['job_overlap'], 0)
        self.assertIsNone(result['test_metrics']['r2'])


if __name__ == '__main__':
    unittest.main()
