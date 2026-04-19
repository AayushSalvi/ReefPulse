from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import IsolationForest


@dataclass
class BaselineScoringResult:
    scores: np.ndarray
    threshold: float
    is_anomaly: np.ndarray


def train_isolation_forest(
    x_train: np.ndarray,
    *,
    contamination: float = 0.05,
    random_state: int = 42,
) -> IsolationForest:
    model = IsolationForest(
        contamination=contamination,
        random_state=random_state,
    )
    model.fit(x_train)
    return model


def score_isolation_forest(
    model: IsolationForest,
    x_values: np.ndarray,
    *,
    threshold_quantile: float = 0.95,
) -> BaselineScoringResult:
    scores = -model.score_samples(x_values)
    threshold = float(np.quantile(scores, threshold_quantile))
    return BaselineScoringResult(
        scores=scores,
        threshold=threshold,
        is_anomaly=scores > threshold,
    )
