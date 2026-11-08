import csv
import tempfile
import unittest
from pathlib import Path
from train_reviewed_model import train, partition

class ReviewedTests(unittest.TestCase):
    def test_full_training_on_synthetic_fixture(self):
        # Test-only labels exercise the pipeline; this is not human-reviewed training data.
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'pairs.csv'
            with path.open('w', newline='') as file:
                writer = csv.DictWriter(file, fieldnames=['candidate_id','job_id','resume_text','job_description','label','reviewer_id'])
                writer.writeheader()
                for c in range(30):
                    for j in range(30):
                        writer.writerow({'candidate_id': f'c{c}', 'job_id': f'j{j}', 'resume_text': f'{"Python developer" if c % 2 else "Sales manager"} resume {c}', 'job_description': f'{"Python developer" if j % 2 else "Sales manager"} job {j}', 'label': int(c % 2 == j % 2), 'reviewer_id':'TEST_ONLY'})
            result = train(path, {'source':'synthetic unit fixture','label_method':'human_independent','training_rights_confirmed':True})
            self.assertEqual(result['schema'], 'applyflow-reviewed-v1')
            self.assertTrue(all(n > 0 for n in result['rows'].values()))
            self.assertEqual(len(result['weights']), 6)
            self.assertGreater(result['test_metrics']['f1'], .8)

    def test_rights_and_independent_labels_required(self):
        with self.assertRaises(ValueError):
            train(Path('missing.csv'), {'label_method': 'synthetic'})

    def test_text_duplicates_stay_in_same_partition(self):
        self.assertEqual(partition('Python developer'), partition(' PYTHON   developer '))

    def test_unreviewed_or_single_class_data_cannot_train(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'pairs.csv'
            path.write_text('candidate_id,job_id,resume_text,job_description,label,reviewer_id\nc1,j1,Python developer,Python developer,1,reviewer\n')
            with self.assertRaisesRegex(ValueError, 'both positive and negative'):
                train(path, {'source':'test','label_method':'human_independent','training_rights_confirmed':True})

if __name__ == '__main__':
    unittest.main()
