/**
 * ReefPulse — Challenges (goal-based activities, badges, cumulative trophies).
 *
 * Route: `/challenges`
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  challenges,
  challengeThemes,
  currentTrophyTier,
  getDemoLeaderboardSlice,
  getDemoTrophyComparison,
  nextTrophyTier,
  trophyTiers
} from "../../data/challengesData";
import { ChallengeCardIcon, TrophyTierIcon } from "./challengeIcons";
import "../explore/workflow.css";
import "./challenges.css";

function agentDebugLog(hypothesisId, location, message, data = {}, runId = "run1") {
  // #region agent log
  fetch("http://127.0.0.1:7299/ingest/b199d9fc-ddef-4145-9d59-b0f1ee99e6b6", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "ddf9dc",
    },
    body: JSON.stringify({
      sessionId: "ddf9dc",
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

function ChallengeCard({ c, onComplete }) {
  return (
    <article className={`ch-card ${c.completed ? "is-complete" : ""}`}>
      <div className="ch-card__banner">
        <span className="ch-card__icon" aria-hidden>
          <ChallengeCardIcon name={c.icon} />
        </span>
        <div className="ch-card__banner-text">
          <h2 className="ch-card__title">{c.title}</h2>
          <p className="ch-card__meta">
            {c.durationDays}-day challenge · {c.theme === "environmental" ? "Ocean care" : c.theme === "discovery" ? "Species" : "Fun"}
          </p>
        </div>
      </div>
      <div className="ch-card__body">
        <p className="ch-card__blurb">{c.blurb}</p>
        <span className="ch-card__badge">Badge: {c.badgeName}</span>
        <div className="ch-card__progress">
          <div className="ch-card__progress-label">
            <span>Progress</span>
            <span>{c.completed ? "Complete" : `${c.progressPct}%`}</span>
          </div>
          <div className="ch-card__progress-bar" role="progressbar" aria-valuenow={c.progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="ch-card__progress-fill" style={{ width: `${c.completed ? 100 : c.progressPct}%` }} />
          </div>
        </div>
        <div className="ch-card__footer">
          <span className="ch-card__points">+{c.points} trophy pts</span>
          <button
            type="button"
            className={`challenges-btn ${c.completed ? "" : "challenges-btn--primary"}`}
            disabled={c.completed}
            onClick={() => onComplete(c.id)}
          >
            {c.completed ? "Completed" : "Complete"}
          </button>
        </div>
      </div>
    </article>
  );
}

function ChallengesPage() {
  const [theme, setTheme] = useState("all");
  const [challengeList, setChallengeList] = useState(() =>
    challenges.map((c) => ({ ...c })),
  );
  const [completionBonusPoints, setCompletionBonusPoints] = useState(0);
  const points = useMemo(
    () =>
      challengeList
        .filter((c) => c.completed)
        .reduce((sum, c) => sum + c.points, 0) + completionBonusPoints,
    [challengeList, completionBonusPoints],
  );
  const tier = useMemo(() => currentTrophyTier(points), [points]);
  const nextTier = useMemo(() => nextTrophyTier(points), [points]);
  const counts = useMemo(() => {
    const completed = challengeList.filter((c) => c.completed).length;
    const inProgress = challengeList.filter(
      (c) => !c.completed && c.progressPct > 0,
    ).length;
    const notStarted = challengeList.filter(
      (c) => !c.completed && c.progressPct === 0,
    ).length;
    return { completed, inProgress, notStarted, total: challengeList.length };
  }, [challengeList]);
  const comparison = useMemo(() => getDemoTrophyComparison(points), [points]);
  const badgesEarned = counts.completed;
  const leaderboardRows = useMemo(
    () => getDemoLeaderboardSlice(points, badgesEarned),
    [points, badgesEarned],
  );

  const nextTierProgressPct = useMemo(() => {
    if (!nextTier) return 100;
    const span = nextTier.minPoints - tier.minPoints;
    if (span <= 0) return 100;
    return Math.min(100, Math.round(((points - tier.minPoints) / span) * 100));
  }, [points, tier, nextTier]);

  const ptsToNextTier = nextTier ? Math.max(0, nextTier.minPoints - points) : 0;

  const filtered = useMemo(() => {
    if (theme === "all") return challengeList;
    return challengeList.filter((c) => c.theme === theme);
  }, [theme, challengeList]);

  const handleComplete = (challengeId) => {
    setChallengeList((prev) =>
      prev.map((c) =>
        c.id === challengeId && !c.completed
          ? { ...c, completed: true, progressPct: 100 }
          : c,
      ),
    );
    setCompletionBonusPoints((prev) => prev + 10);
    // #region agent log
    agentDebugLog(
      "H8",
      "ChallengesPage.jsx:complete",
      "Challenge marked complete and bonus applied",
      {
        challengeId,
        bonusAdded: 10,
      },
    );
    // #endregion
  };

  return (
    <div className="challenges-page wf-page">
      <nav className="rp-breadcrumb challenges-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span className="rp-breadcrumb-sep">/</span>
        <span aria-current="page">Challenges</span>
      </nav>

      <header className="challenges-hero">
        <h1>Challenges</h1>
        <p className="challenges-hero__lead">
          Time-boxed goals for the reef community: protect habitats, discover species, and share outings. Finish a challenge to earn a
          badge and trophy points on your shelf.{" "}
          <Link to="/community" className="challenges-hero__link">
            Community feed →
          </Link>
        </p>
      </header>

      <section className="ch-trophy-banner" aria-label="Your trophies">
        <p className="ch-trophy-banner__kicker">Your trophies</p>
        <div className="ch-trophy-banner__grid">
          <div className="ch-trophy-banner__primary">
            <p className="ch-trophy-banner__score" aria-live="polite">
              <span className="ch-trophy-banner__num">{points.toLocaleString()}</span>
              <span className="ch-trophy-banner__unit">pts</span>
            </p>
            <p className="ch-trophy-banner__tier">
              <span className="ch-trophy-banner__tier-icon" aria-hidden>
                <TrophyTierIcon tierId={tier.id} />
              </span>
              <span className="ch-trophy-banner__tier-text">
                <span className="ch-trophy-banner__tier-label">Current tier</span>
                <span className="ch-trophy-banner__tier-name">{tier.name}</span>
              </span>
            </p>
            <p className="ch-trophy-banner__season">
              {comparison.seasonLabel} · {comparison.cohortSize.toLocaleString()} snorkelers
            </p>
          </div>
          <div className="ch-trophy-banner__aside">
            {nextTier ? (
              <>
                <p className="ch-trophy-banner__next-label">
                  <span className="ch-trophy-banner__next-tier-lockup">
                    <span>Next tier ·</span>
                    <span className="ch-trophy-banner__next-tier-name" aria-hidden>
                      <TrophyTierIcon tierId={nextTier.id} className="ch-icon--sm" />
                      <span>{nextTier.name}</span>
                    </span>
                  </span>
                  <span className="ch-trophy-banner__next-gap">{ptsToNextTier} pts to go</span>
                </p>
                <div
                  className="ch-trophy-banner__bar"
                  role="progressbar"
                  aria-valuenow={nextTierProgressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="ch-trophy-banner__fill" style={{ width: `${nextTierProgressPct}%` }} />
                </div>
              </>
            ) : (
              <p className="ch-trophy-banner__maxed">Top tier on this ladder</p>
            )}
          </div>
        </div>
        <ul className="ch-trophy-banner__stats" aria-label="Trophy summary">
          <li>
            <span className="ch-trophy-banner__stat-num">#{comparison.yourRank.toLocaleString()}</span>
            <span className="ch-trophy-banner__stat-label">Season rank</span>
          </li>
          <li>
            <span className="ch-trophy-banner__stat-num">{comparison.beatPercent}%</span>
            <span className="ch-trophy-banner__stat-label">Beat cohort</span>
          </li>
          <li>
            <span className="ch-trophy-banner__stat-num">{counts.completed}</span>
            <span className="ch-trophy-banner__stat-label">Challenges done</span>
          </li>
          <li>
            <span className="ch-trophy-banner__stat-num">{counts.inProgress}</span>
            <span className="ch-trophy-banner__stat-label">In progress</span>
          </li>
        </ul>
      </section>

      <div className="ch-main-block">
        <p className="ch-main-block__label">Active challenges</p>
        <div className="ch-theme-row" role="tablist" aria-label="Challenge themes">
          {challengeThemes.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={theme === x.id}
              className={`ch-theme-chip ${theme === x.id ? "is-on" : ""}`}
              onClick={() => setTheme(x.id)}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="ch-grid">
          {filtered.map((c) => (
            <ChallengeCard key={c.id} c={c} onComplete={handleComplete} />
          ))}
        </div>
      </div>

      <details className="ch-details">
        <summary className="ch-details__summary">Tiers, cohort stats &amp; sample leaderboard</summary>
        <div className="ch-details__body">
          <div className="ch-tiers-inline" aria-label="Tier ladder">
            {trophyTiers.map((t) => {
              const unlocked = points >= t.minPoints;
              const active = tier.id === t.id;
              return (
                <div
                  key={t.id}
                  className={`ch-tier-chip ${!unlocked ? "is-locked" : ""} ${active ? "is-current" : ""}`}
                  title={`${t.name} · ${t.minPoints}+ pts`}
                >
                  <span className="ch-tier-chip__icon" aria-hidden>
                    <TrophyTierIcon tierId={t.id} className="ch-icon--chip" />
                  </span>
                  <span className="ch-tier-chip__name">{t.name}</span>
                </div>
              );
            })}
          </div>
          <p className="ch-details__cohort">
            Cohort median <strong>{comparison.medianPoints}</strong> pts · average <strong>{comparison.averagePoints}</strong> pts (demo)
          </p>
          <div className="ch-compare__table-wrap ch-compare__table-wrap--nested">
            <table className="ch-compare__table ch-compare__table--compact">
              <caption className="ch-compare__caption">
                Sample peers sorted by points. Your season rank is #{comparison.yourRank.toLocaleString()}.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Snorkeler</th>
                  <th scope="col">Pts</th>
                  <th scope="col">Badges</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardRows.map((row) => (
                  <tr key={row.handle} className={row.isYou ? "is-you" : undefined}>
                    <td>{row.isYou ? <strong>{row.handle}</strong> : row.handle}</td>
                    <td>{row.points.toLocaleString()}</td>
                    <td>{row.badges}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <section className="challenges-cross" aria-label="Community">
        <p>
          Post photos and field notes on <Link to="/community">Community</Link> — completions can appear as highlights on your posts.
        </p>
      </section>

      <div className="wf-page-footer-links challenges-footer-links">
        <Link to="/community">Community</Link>
        <Link to="/explore">Explore</Link>
        <Link to="/dashboard">Dashboard</Link>
      </div>
    </div>
  );
}

export default ChallengesPage;
