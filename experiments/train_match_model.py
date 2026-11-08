#!/usr/bin/env python3
"""Experimental fit of public dataset scores from raw resume/job text.

The exported model is an experiment, not a hiring or application decision tool.
"""
import argparse
import csv
import hashlib
import json
import math
import re
import sys
from collections import Counter
from pathlib import Path

REVISION = '6186dded39f983b96a1a2eb4d1ecf365a90a46f9'
FILES = {
    'cv.csv': '67c81a4761516113dbebcd8c6acc1b692c4b20e54341187ff864d2d637099640',
    'job.csv': '301a382ebec72d574817cc3d4b9ee34cf08e7f8ecdfa3d373142767fe4f9f789',
    'matches.csv': '4ae60b5b134146235148557268c5e04f1fc5e7579b73c4ab59cb01073bce3338',
}
STOP = set('a an and are as at be been being but by can candidate company could experience for from have has in into is it job knowledge of on or our role skills such that the their they this to using we will with work working you your years ability strong including required requirements preferred responsibilities looking team opportunity'.split())
FEATURES = ['intercept', 'job_word_coverage', 'resume_word_coverage', 'term_frequency_cosine', 'log_resume_words', 'log_job_words']
csv.field_size_limit(sys.maxsize)


def verify_files(data_dir):
    for name, expected in FILES.items():
        digest = hashlib.sha256()
        with (data_dir / name).open('rb') as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(chunk)
        if digest.hexdigest() != expected:
            raise ValueError(f'{name} does not match the pinned dataset revision')


def tokens(text):
    words = (word.rstrip('.') for word in re.findall(r'[a-z][a-z0-9+#.\-]{1,}', text.lower()))
    return Counter(word for word in words if len(word) > 2 and word not in STOP)


def features(resume, job):
    overlap = resume.keys() & job.keys()
    dot = sum(resume[word] * job[word] for word in overlap)
    denom = math.sqrt(sum(v * v for v in resume.values()) * sum(v * v for v in job.values()))
    return [1.0, len(overlap) / max(len(job), 1), len(overlap) / max(len(resume), 1), dot / denom if denom else 0.0, math.log1p(sum(resume.values())), math.log1p(sum(job.values()))]


def is_holdout(kind, value):
    # Fixed identity-based assignment prevents resume and job overlap across splits.
    digest = hashlib.sha256(f'applyflow-v1:{kind}:{value}'.encode()).digest()
    return int.from_bytes(digest[:8], 'big') % 5 == 0


def solve(matrix, vector):
    """Solve the small ridge system with partial pivoting."""
    a = [row[:] + [target] for row, target in zip(matrix, vector)]
    n = len(vector)
    for col in range(n):
        pivot = max(range(col, n), key=lambda row: abs(a[row][col]))
        if abs(a[pivot][col]) < 1e-12:
            raise ValueError('singular training matrix')
        a[col], a[pivot] = a[pivot], a[col]
        scale = a[col][col]
        a[col] = [v / scale for v in a[col]]
        for row in range(n):
            if row == col:
                continue
            factor = a[row][col]
            a[row] = [v - factor * base for v, base in zip(a[row], a[col])]
    return [row[-1] for row in a]


def read_texts(path, key, field):
    with path.open(encoding='utf-8', newline='') as source:
        return {row[key]: tokens(row[field]) for row in csv.DictReader(source)}


def run(data_dir):
    verify_files(data_dir)
    resumes = read_texts(data_dir / 'cv.csv', 'candidate_id', 'resume_text')
    jobs = read_texts(data_dir / 'job.csv', 'job_id', 'job_description')
    n_features = len(FEATURES)
    xtx = [[0.0] * n_features for _ in range(n_features)]
    xty = [0.0] * n_features
    heldout = []
    train_count = excluded = missing = 0
    label_sum = 0.0
    train_candidates, train_jobs, test_candidates, test_jobs = set(), set(), set(), set()
    with (data_dir / 'matches.csv').open(encoding='utf-8', newline='') as source:
        for row in csv.DictReader(source):
            candidate, job = row['candidate_id'], row['job_id']
            if candidate not in resumes or job not in jobs:
                missing += 1
                continue
            candidate_test = is_holdout('candidate', candidate)
            job_test = is_holdout('job', job)
            if candidate_test != job_test:
                excluded += 1
                continue
            x = features(resumes[candidate], jobs[job])
            y = float(row['final_score'])
            if not math.isfinite(y):
                raise ValueError('non-finite score')
            if candidate_test:
                heldout.append((x, y))
                test_candidates.add(candidate); test_jobs.add(job)
            else:
                train_count += 1; label_sum += y
                train_candidates.add(candidate); train_jobs.add(job)
                for i in range(n_features):
                    xty[i] += x[i] * y
                    for j in range(n_features):
                        xtx[i][j] += x[i] * x[j]
    if not train_count or not heldout:
        raise ValueError('empty training or test split')
    # A fixed L2 penalty avoids tuning on the test set. Do not penalize intercept.
    for i in range(1, n_features):
        xtx[i][i] += 1.0
    weights = solve(xtx, xty)
    baseline = label_sum / train_count
    actual = [y for _, y in heldout]
    predicted = [sum(a * b for a, b in zip(x, weights)) for x, _ in heldout]
    def metrics(predictions):
        errors = [p - y for p, y in zip(predictions, actual)]
        mse = sum(e * e for e in errors) / len(errors)
        return {'mae': sum(abs(e) for e in errors) / len(errors), 'rmse': math.sqrt(mse)}
    mean_test = sum(actual) / len(actual)
    sst = sum((y - mean_test) ** 2 for y in actual)
    sse = sum((p - y) ** 2 for p, y in zip(predicted, actual))
    return {
        'provenance': {'generated_by': 'CodeRabbit', 'method': 'experiments/train_match_model.py'},
        'dataset': 'nonameee12233/job-resume-matching', 'revision': REVISION,
        'target': 'final_score (dataset modeling signal, not verified job fit)',
        'split': 'SHA-256 identity split: training has neither held-out candidate nor held-out job; test has both; cross-split pairs excluded',
        'rows': {'train': train_count, 'test': len(heldout), 'excluded_cross_split': excluded, 'missing_text': missing},
        'identities': {'train_candidates': len(train_candidates), 'test_candidates': len(test_candidates), 'train_jobs': len(train_jobs), 'test_jobs': len(test_jobs), 'candidate_overlap': len(train_candidates & test_candidates), 'job_overlap': len(train_jobs & test_jobs)},
        'model': {'type': 'ridge_regression', 'penalty': 1.0, 'features': FEATURES, 'weights': weights},
        'test_metrics': {'model': metrics(predicted), 'train_mean_baseline': metrics([baseline] * len(actual)), 'r2': 1 - sse / sst if sst else None},
        'limitations': ['Only positive pairs are present; unrelated pairs are not evaluated.', 'Scores are dataset-generated signals rather than independent human judgments.', 'This is an experimental regression model and must not be treated as a measure of qualifications.']
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', type=Path, required=True, help='Directory containing the three pinned CSV files')
    parser.add_argument('--output', type=Path, required=True, help='Path for model weights and aggregate test results')
    args = parser.parse_args()
    result = run(args.data_dir)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'rows': result['rows'], 'identities': result['identities'], 'test_metrics': result['test_metrics']}, indent=2))


if __name__ == '__main__':
    main()
