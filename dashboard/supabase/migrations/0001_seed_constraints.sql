-- Seeders rely on unique constraints for ON CONFLICT upserts.
-- Apply this once if you ran the original schema before these were added.
-- Idempotent — safe to re-run.

alter table marathons
  drop constraint if exists marathons_user_id_race_date_race_name_key;
alter table marathons
  add constraint marathons_user_id_race_date_race_name_key
  unique (user_id, race_date, race_name);

alter table tune_up_races
  drop constraint if exists tune_up_races_user_id_date_label_key;
alter table tune_up_races
  add constraint tune_up_races_user_id_date_label_key
  unique (user_id, date, label);
