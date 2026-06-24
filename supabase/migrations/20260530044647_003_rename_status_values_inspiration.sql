/*
  # Update saved_videos status values to inspiration framing

  The saved_videos table was originally designed around a content workflow
  (idea → drafting → ready_to_record → recorded → posted). The tab is now
  reframed as an inspiration library, so status values are updated to reflect
  how a creator studies saved videos: new → studying → ready_to_adapt → adapted.

  ## Changes
  1. Migrate existing rows: map old values to new ones
     - idea           → new
     - drafting        → studying
     - ready_to_record → ready_to_adapt
     - recorded        → adapted
     - posted          → adapted
     - archived        → archived (unchanged)
  2. Update the column default from 'idea' to 'new'
*/

UPDATE saved_videos
SET status = CASE
  WHEN status = 'idea'            THEN 'new'
  WHEN status = 'drafting'        THEN 'studying'
  WHEN status = 'ready_to_record' THEN 'ready_to_adapt'
  WHEN status IN ('recorded', 'posted') THEN 'adapted'
  ELSE status
END
WHERE status IN ('idea', 'drafting', 'ready_to_record', 'recorded', 'posted');

ALTER TABLE saved_videos ALTER COLUMN status SET DEFAULT 'new';
