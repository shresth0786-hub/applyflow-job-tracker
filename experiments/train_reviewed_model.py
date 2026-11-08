"""Train a local text matcher from independently reviewed pairs; export a gated artifact."""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
from train_match_model import FEATURES, features, tokens


def sigmoid(value):
    return 1 / (1 + math.exp(-max(-40, min(40, value))))


def partition(text):
    normalized = ' '.join(text.lower().split())
    bucket = int(hashlib.sha256(normalized.encode()).hexdigest()[:8], 16) % 5
    return 'train' if bucket < 3 else 'validation' if bucket == 3 else 'test'


def metrics(rows, weights, threshold):
    tp = fp = fn = tn = 0
    for x, y in rows:
        predicted = sigmoid(sum(a * b for a, b in zip(x, weights))) >= threshold
        tp += int(predicted and y == 1); fp += int(predicted and y == 0)
        fn += int(not predicted and y == 1); tn += int(not predicted and y == 0)
    return {'f1': 2 * tp / max(2 * tp + fp + fn, 1), 'precision': tp / max(tp + fp, 1),
            'recall': tp / max(tp + fn, 1), 'accuracy': (tp + tn) / max(len(rows), 1),
            'positive': tp + fn, 'negative': tn + fp}


def train(path, metadata):
    if metadata.get('label_method') != 'human_independent' or metadata.get('training_rights_confirmed') is not True or not metadata.get('source'):
        raise ValueError('Metadata must identify the source and attest independent human labels and training rights')
    splits = {name: [] for name in ('train', 'validation', 'test')}
    identities = {'candidate_id': {}, 'job_id': {}}
    pairs = set()
    excluded = 0
    with path.open(encoding='utf-8', newline='') as file:
        reader = csv.DictReader(file)
        required = {'candidate_id', 'job_id', 'resume_text', 'job_description', 'label', 'reviewer_id'}
        if not required <= set(reader.fieldnames or []):
            raise ValueError('CSV missing required columns: ' + ', '.join(sorted(required)))
        for row in reader:
            if any(not row[k].strip() for k in required) or row['label'] not in ('0', '1'):
                raise ValueError('Each pair needs nonempty text, IDs, reviewer_id, and label 0 or 1')
            for key, text_key in [('candidate_id', 'resume_text'), ('job_id', 'job_description')]:
                fingerprint = hashlib.sha256(' '.join(row[text_key].lower().split()).encode()).hexdigest()
                old = identities[key].setdefault(row[key], fingerprint)
                if old != fingerprint:
                    raise ValueError('An identity has inconsistent text')
            pair = (identities['candidate_id'][row['candidate_id']], identities['job_id'][row['job_id']])
            if pair in pairs:
                raise ValueError('Duplicate text pair; deduplicate and resolve labels before training')
            pairs.add(pair)
            group = partition(row['resume_text'])
            if group != partition(row['job_description']):
                excluded += 1
                continue
            x = features(tokens(row['resume_text']), tokens(row['job_description']))
            # Fixed scaling keeps input features bounded without learning from held-out data.
            x[-2:] = [min(v / 10, 1) for v in x[-2:]]
            splits[group].append((x, int(row['label'])))
    if any({y for _, y in rows} != {0, 1} for rows in splits.values()):
        raise ValueError('Each disjoint split must contain both positive and negative reviewed pairs')
    weights = [0.] * len(FEATURES)
    for _ in range(400):
        gradient = [0.] * len(weights)
        for x, y in splits['train']:
            error = sigmoid(sum(a * b for a, b in zip(x, weights))) - y
            for i, value in enumerate(x):
                gradient[i] += error * value
        weights = [w - .5 * (gradient[i] / len(splits['train']) + (.001 * w if i else 0)) for i, w in enumerate(weights)]
    threshold = max([.2, .3, .4, .5, .6, .7, .8], key=lambda t: metrics(splits['validation'], weights, t)['f1'])
    result = metrics(splits['test'], weights, threshold)
    majority = int(sum(y for _, y in splits['train']) >= len(splits['train']) / 2)
    baseline = metrics(splits['test'], [40 if majority else -40] + [0.] * (len(FEATURES) - 1), .5)
    checks = {'test_size': len(splits['test']) >= 100, 'test_class_coverage': min(result['positive'], result['negative']) >= 25,
              'f1': result['f1'] >= .75, 'precision': result['precision'] >= .75, 'recall': result['recall'] >= .75,
              'baseline_improvement': result['f1'] >= baseline['f1'] + .05}
    return {'provenance': {'generated_by': 'CodeRabbit', 'data_sha256': hashlib.sha256(path.read_bytes()).hexdigest()},
            'schema': 'applyflow-reviewed-v1', 'features': FEATURES, 'weights': weights, 'threshold': threshold,
            'deployable': all(checks.values()), 'checks': checks, 'test_metrics': result, 'baseline': baseline,
            'rows': {k: len(v) for k, v in splits.items()}, 'excluded_cross_split': excluded,
            'label_method': metadata['label_method'], 'training_rights_confirmed': True}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pairs', required=True, type=Path)
    parser.add_argument('--metadata', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    result = train(args.pairs, json.loads(args.metadata.read_text()))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'deployable': result['deployable'], 'checks': result['checks'], 'test_metrics': result['test_metrics']}))
