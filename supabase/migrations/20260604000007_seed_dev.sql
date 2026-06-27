-- ============================================================
-- Dev seed — one active WNBA season + default prizes
-- ============================================================

-- League is stored uppercase to match the poller's LEAGUE constant ('WNBA')
-- and the league written onto games/standings rows. Guarded so re-running the
-- seed can't create a second active season for the same league.
INSERT INTO seasons (league, name, watch_party_goal, is_active)
SELECT 'WNBA', '2025 WNBA Season', 8, true
WHERE NOT EXISTS (
  SELECT 1 FROM seasons WHERE league = 'WNBA' AND is_active
);

-- Default prizes (admin-editable after deploy)
INSERT INTO prizes (season_id, category, rank, title, value_label, description, sort_order)
SELECT id, 'season', 1, '1st Place',  '$250 Food & Drink Credit',
  'The Pick''em champion of the season.', 1
FROM seasons WHERE is_active LIMIT 1;

INSERT INTO prizes (season_id, category, rank, title, value_label, description, sort_order)
SELECT id, 'season', 2, '2nd Place', '$150 Food & Drink Credit',
  'Runner-up.', 2
FROM seasons WHERE is_active LIMIT 1;

INSERT INTO prizes (season_id, category, rank, title, value_label, description, sort_order)
SELECT id, 'season', 3, '3rd Place', '$75 Food & Drink Credit',
  'Third place.', 3
FROM seasons WHERE is_active LIMIT 1;

INSERT INTO prizes (season_id, category, rank, title, value_label, description, sort_order)
SELECT id, 'watch_party', NULL, 'Watch Party Drawing', 'R&T Merch Bundle + VIP Night',
  'Attend 8+ watch parties to qualify for the end-of-season drawing.', 10
FROM seasons WHERE is_active LIMIT 1;

INSERT INTO prizes (season_id, category, rank, title, value_label, description, sort_order)
SELECT id, 'weekly', NULL, 'Top Weekly Picker', 'Bar Tab ($50)',
  'Highest points in the rolling 7-day window wins a bar tab.', 20
FROM seasons WHERE is_active LIMIT 1;
