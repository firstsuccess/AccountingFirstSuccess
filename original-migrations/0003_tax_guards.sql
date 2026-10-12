CREATE TRIGGER tax_codes_no_delete BEFORE DELETE ON tax_codes BEGIN SELECT RAISE(ABORT, 'physical_delete_forbidden'); END;
--> statement-breakpoint
CREATE TRIGGER tax_codes_rate_immutable BEFORE UPDATE ON tax_codes WHEN json_extract(OLD.data,'$.tax_rate') != json_extract(NEW.data,'$.tax_rate') OR json_extract(OLD.data,'$.tax_type') != json_extract(NEW.data,'$.tax_type') OR OLD.code != NEW.code BEGIN SELECT RAISE(ABORT,'tax_rate_immutable'); END;
