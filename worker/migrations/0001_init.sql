-- 每日排行（运气榜）数据表。每天以 UTC 日期分桶，天然按天重置。
CREATE TABLE IF NOT EXISTS daily_seeds (
  player_id TEXT NOT NULL,
  date TEXT NOT NULL,
  seed INTEGER NOT NULL,
  issued_at TEXT NOT NULL,
  PRIMARY KEY (player_id, date)
);

CREATE TABLE IF NOT EXISTS daily_scores (
  date TEXT NOT NULL,
  player_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  rarity_id TEXT NOT NULL,
  generator_version INTEGER NOT NULL,
  scoring_version INTEGER NOT NULL,
  submitted_at TEXT NOT NULL,
  PRIMARY KEY (date, player_id)
);

-- 榜单排序键：分数高者在前，同分先提交者在前。
CREATE INDEX IF NOT EXISTS daily_scores_rank ON daily_scores (date, score DESC, submitted_at ASC);
