BEGIN;

CREATE OR REPLACE FUNCTION protect_released_time_capsule_media()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_id TEXT;
  released BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' AND
      ROW(NEW.moment_id, NEW.state, NEW.pathname, NEW.filename, NEW.content_type, NEW.size_bytes)
      IS NOT DISTINCT FROM
      ROW(OLD.moment_id, OLD.state, OLD.pathname, OLD.filename, OLD.content_type, OLD.size_bytes) THEN
    RETURN NEW;
  END IF;
  FOR target_id IN
    SELECT DISTINCT id FROM (
      SELECT CASE WHEN TG_OP <> 'INSERT' THEN OLD.moment_id END AS id
      UNION ALL
      SELECT CASE WHEN TG_OP <> 'DELETE' THEN NEW.moment_id END AS id
    ) ids WHERE id IS NOT NULL ORDER BY id
  LOOP
    SELECT (s.status = 'active' AND (s.manual_released_at IS NOT NULL OR s.unlock_at <= clock_timestamp()))
      INTO released
      FROM cannot_open_until_settings s
      JOIN moments m ON m.id = s.moment_id AND m.kind = 'cannot-open-until'
      WHERE s.moment_id = target_id FOR UPDATE OF s;
    IF COALESCE(released, FALSE) THEN
      RAISE EXCEPTION 'Released Cannot Open Until media is read-only';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS moment_videos_protect_time_capsule ON moment_videos;
CREATE TRIGGER moment_videos_protect_time_capsule
  BEFORE INSERT OR UPDATE OR DELETE ON moment_videos
  FOR EACH ROW EXECUTE FUNCTION protect_released_time_capsule_media();
DROP TRIGGER IF EXISTS moment_audio_protect_time_capsule ON moment_audio;
CREATE TRIGGER moment_audio_protect_time_capsule
  BEFORE INSERT OR UPDATE OR DELETE ON moment_audio
  FOR EACH ROW EXECUTE FUNCTION protect_released_time_capsule_media();

CREATE OR REPLACE FUNCTION save_cannot_open_until_content(
  p_owner TEXT, p_id TEXT, p_version TEXT, p_title TEXT, p_story TEXT, p_tags TEXT,
  p_message TEXT, p_photo_action TEXT, p_photo_data TEXT, p_photo_name TEXT,
  p_video_action TEXT, p_video_id TEXT, p_audio_action TEXT, p_audio_id TEXT
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  item moments%ROWTYPE;
  settings cannot_open_until_settings%ROWTYPE;
  details JSONB;
  content JSONB;
  video_name TEXT;
  audio_name TEXT;
BEGIN
  SELECT * INTO item FROM moments
    WHERE id = p_id AND user_id = p_owner AND kind = 'cannot-open-until' FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  SELECT * INTO settings FROM cannot_open_until_settings WHERE moment_id = p_id FOR UPDATE;
  IF FOUND AND settings.status = 'active'
      AND (settings.manual_released_at IS NOT NULL OR settings.unlock_at <= clock_timestamp()) THEN
    RETURN 'released';
  END IF;
  IF item.updated_at <> p_version THEN RETURN 'conflict'; END IF;
  IF p_photo_action NOT IN ('keep', 'replace', 'remove')
      OR p_video_action NOT IN ('keep', 'replace', 'remove')
      OR p_audio_action NOT IN ('keep', 'replace', 'remove') THEN
    RETURN 'invalid';
  END IF;
  IF p_video_action = 'replace' THEN
    SELECT filename INTO video_name FROM moment_videos
      WHERE id = p_video_id AND user_id = p_owner AND state = 'ready' AND moment_id IS NULL FOR UPDATE;
    IF NOT FOUND THEN RETURN 'video_unavailable'; END IF;
  END IF;
  IF p_audio_action = 'replace' THEN
    SELECT filename INTO audio_name FROM moment_audio
      WHERE id = p_audio_id AND user_id = p_owner AND state = 'ready' AND moment_id IS NULL FOR UPDATE;
    IF NOT FOUND THEN RETURN 'audio_unavailable'; END IF;
  END IF;
  details := item.details_json::jsonb;
  details := jsonb_set(details, '{writtenMessage}', to_jsonb(p_message), TRUE);
  IF jsonb_typeof(details->'attachmentNames') IS DISTINCT FROM 'object' THEN
    details := jsonb_set(details, '{attachmentNames}', '{}'::jsonb, TRUE);
  END IF;
  content := item.content_json::jsonb - 'written';
  IF p_message <> '' THEN content := content || '"written"'::jsonb; END IF;
  IF p_photo_action <> 'keep' THEN
    details := jsonb_set(details, '{photoData}', to_jsonb(CASE WHEN p_photo_action = 'replace' THEN p_photo_data ELSE '' END), TRUE);
    details := details #- '{attachmentNames,photo}';
    content := content - 'photo';
    IF p_photo_action = 'replace' THEN
      details := jsonb_set(details, '{attachmentNames,photo}', to_jsonb(p_photo_name), TRUE);
      content := content || '"photo"'::jsonb;
    END IF;
  END IF;
  IF p_video_action <> 'keep' THEN
    UPDATE moment_videos SET moment_id = NULL, state = 'deleting'
      WHERE moment_id = p_id AND state = 'attached';
    details := details #- '{attachmentNames,video}';
    content := content - 'video';
    IF p_video_action = 'replace' THEN
      UPDATE moment_videos SET moment_id = p_id, state = 'attached', last_used_at = clock_timestamp()
        WHERE id = p_video_id;
      details := jsonb_set(details, '{attachmentNames,video}', to_jsonb(video_name), TRUE);
      content := content || '"video"'::jsonb;
    END IF;
  END IF;
  IF p_audio_action <> 'keep' THEN
    UPDATE moment_audio SET moment_id = NULL, state = 'deleting'
      WHERE moment_id = p_id AND state = 'attached';
    details := details #- '{attachmentNames,voice}';
    content := content - 'voice';
    IF p_audio_action = 'replace' THEN
      UPDATE moment_audio SET moment_id = p_id, state = 'attached', last_used_at = clock_timestamp()
        WHERE id = p_audio_id;
      details := jsonb_set(details, '{attachmentNames,voice}', to_jsonb(audio_name), TRUE);
      content := content || '"voice"'::jsonb;
    END IF;
  END IF;
  UPDATE moments SET title = p_title, story = p_story, tags = p_tags,
    details_json = details::text, content_json = content::text,
    updated_at = to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    WHERE id = p_id;
  RETURN 'saved';
END;
$$;

INSERT INTO schema_migrations (version) VALUES ('031_cannot_open_until_media')
ON CONFLICT (version) DO NOTHING;
COMMIT;
