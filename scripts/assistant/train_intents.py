#!/usr/bin/env python3
"""Train and validate the local FZAC intent classifier with no external dependencies."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
CORPUS_PATH = ROOT / "data" / "assistant" / "intents.es-AR.json"
MODEL_PATH = ROOT / "lib" / "assistant" / "generated" / "intent-model.json"
STOP_WORDS = {
    "a", "al", "con", "de", "del", "el", "en", "es", "la", "las", "lo", "los",
    "me", "mi", "para", "por", "que", "se", "te", "un", "una", "y",
}


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.lower())
    return "".join(char for char in decomposed if unicodedata.category(char) != "Mn")


def tokenize(value: str) -> list[str]:
    cleaned = re.sub(r"[^a-z0-9+\s]", " ", normalize(value))
    return [token for token in cleaned.split() if len(token) > 1 and token not in STOP_WORDS]


def load_corpus() -> dict[str, Any]:
    with CORPUS_PATH.open("r", encoding="utf-8") as source:
        corpus = json.load(source)

    intents = corpus.get("intents", [])
    samples = corpus.get("samples", [])
    if corpus.get("schema_version") != 1 or not isinstance(intents, list) or not isinstance(samples, list):
        raise ValueError("Invalid assistant corpus schema.")

    known_intents = set(intents)
    counts = Counter(sample.get("intent") for sample in samples)
    unknown = sorted(set(counts) - known_intents)
    duplicates = len(samples) - len({(sample.get("intent"), normalize(str(sample.get("text", "")))) for sample in samples})
    if unknown:
        raise ValueError(f"Unknown intents in corpus: {', '.join(unknown)}")
    if duplicates:
        raise ValueError(f"Corpus contains {duplicates} duplicated samples.")
    underrepresented = [intent for intent in intents if counts[intent] < 6]
    if underrepresented:
        raise ValueError(f"Intents need at least 6 samples: {', '.join(underrepresented)}")
    if any(not tokenize(str(sample.get("text", ""))) for sample in samples):
        raise ValueError("Every training sample must contain useful tokens.")
    return corpus


def train(corpus: dict[str, Any]) -> dict[str, Any]:
    intents: list[str] = corpus["intents"]
    vocabulary: set[str] = set()
    intent_documents: Counter[str] = Counter()
    token_counts: dict[str, Counter[str]] = defaultdict(Counter)
    total_tokens: Counter[str] = Counter()

    for sample in corpus["samples"]:
        intent = sample["intent"]
        tokens = tokenize(sample["text"])
        intent_documents[intent] += 1
        token_counts[intent].update(tokens)
        total_tokens[intent] += len(tokens)
        vocabulary.update(tokens)

    corpus_bytes = json.dumps(corpus, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return {
        "schema_version": 1,
        "engine": "FZAC_NAIVE_BAYES_V1",
        "locale": corpus["locale"],
        "corpus_sha256": hashlib.sha256(corpus_bytes).hexdigest(),
        "intents": intents,
        "total_documents": len(corpus["samples"]),
        "vocabulary": sorted(vocabulary),
        "intent_documents": {intent: intent_documents[intent] for intent in intents},
        "total_tokens": {intent: total_tokens[intent] for intent in intents},
        "token_counts": {
            intent: dict(sorted(token_counts[intent].items())) for intent in intents
        },
    }


def classify(model: dict[str, Any], text: str) -> tuple[str, float]:
    tokens = tokenize(text)
    vocabulary_size = max(len(model["vocabulary"]), 1)
    scores: list[tuple[str, float]] = []

    for intent in model["intents"]:
        prior = model["intent_documents"][intent] / model["total_documents"]
        counts = model["token_counts"][intent]
        total = model["total_tokens"][intent]
        score = math.log(prior)
        for token in tokens:
            score += math.log((counts.get(token, 0) + 1) / (total + vocabulary_size))
        scores.append((intent, score))

    scores.sort(key=lambda item: item[1], reverse=True)
    margin = scores[0][1] - scores[1][1] if len(scores) > 1 else 0.0
    confidence = 1 / (1 + math.exp(-margin))
    return scores[0][0], confidence


def evaluate(corpus: dict[str, Any], model: dict[str, Any]) -> None:
    failures: list[str] = []
    for case in corpus.get("evaluation_cases", []):
        predicted, confidence = classify(model, case["text"])
        if predicted != case["intent"]:
            failures.append(
                f"{case['text']!r}: expected={case['intent']} predicted={predicted} confidence={confidence:.3f}"
            )
    if failures:
        raise ValueError("Intent regression failures:\n- " + "\n- ".join(failures))


def serialize(model: dict[str, Any]) -> str:
    return json.dumps(model, ensure_ascii=False, indent=2, sort_keys=False) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Train the FZAC local intent model.")
    parser.add_argument("--check", action="store_true", help="Fail if the generated model is stale.")
    args = parser.parse_args()

    try:
        corpus = load_corpus()
        model = train(corpus)
        evaluate(corpus, model)
        expected = serialize(model)

        if args.check:
            current = MODEL_PATH.read_text(encoding="utf-8") if MODEL_PATH.exists() else ""
            if current != expected:
                print("Generated assistant model is stale. Run corepack pnpm run assistant:train.", file=sys.stderr)
                return 1
        else:
            MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
            MODEL_PATH.write_text(expected, encoding="utf-8", newline="\n")

        print(
            json.dumps(
                {
                    "ok": True,
                    "engine": model["engine"],
                    "documents": model["total_documents"],
                    "intents": len(model["intents"]),
                    "evaluation_cases": len(corpus.get("evaluation_cases", [])),
                    "vocabulary": len(model["vocabulary"]),
                    "mode": "check" if args.check else "train",
                },
                separators=(",", ":"),
            )
        )
        return 0
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        print(f"Assistant training failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
