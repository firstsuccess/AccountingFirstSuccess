CREATE TRIGGER companies_no_delete BEFORE DELETE ON companies BEGIN SELECT RAISE(ABORT, 'physical_delete_forbidden'); END;
--> statement-breakpoint
CREATE TRIGGER companies_valid_json BEFORE INSERT ON companies WHEN NOT json_valid(NEW.data) BEGIN SELECT RAISE(ABORT, 'invalid_json'); END;
--> statement-breakpoint
CREATE TRIGGER accounts_no_delete BEFORE DELETE ON accounts BEGIN SELECT RAISE(ABORT, 'physical_delete_forbidden'); END;
--> statement-breakpoint
CREATE INDEX idx_accounts_company ON accounts(company_id);
--> statement-breakpoint
CREATE TRIGGER accounts_valid_json BEFORE INSERT ON accounts WHEN NOT json_valid(NEW.data) BEGIN SELECT RAISE(ABORT, 'invalid_json'); END;
--> statement-breakpoint
CREATE TRIGGER subaccounts_no_delete BEFORE DELETE ON subaccounts BEGIN SELECT RAISE(ABORT, 'physical_delete_forbidden'); END;
--> statement-breakpoint
CREATE INDEX idx_subaccounts_company ON subaccounts(company_id);
--> statement-breakpoint
CREATE TRIGGER subaccounts_valid_json BEFORE INSERT ON subaccounts WHEN NOT json_valid(NEW.data) BEGIN SELECT RAISE(ABORT, 'invalid_json'); END;
--> statement-breakpoint
CREATE TRIGGER years_no_delete BEFORE DELETE ON years BEGIN SELECT RAISE(ABORT, 'physical_delete_forbidden'); END;
--> statement-breakpoint
CREATE INDEX idx_years_company ON years(company_id);
--> statement-breakpoint
CREATE TRIGGER years_valid_json BEFORE INSERT ON years WHEN NOT json_valid(NEW.data) BEGIN SELECT RAISE(ABORT, 'invalid_json'); END;
--> statement-breakpoint
CREATE TRIGGER periods_no_delete BEFORE DELETE ON periods BEGIN SELECT RAISE(ABORT, 'physical_delete_forbidden'); END;
--> statement-breakpoint
CREATE INDEX idx_periods_company ON periods(company_id);
--> statement-breakpoint
CREATE TRIGGER periods_valid_json BEFORE INSERT ON periods WHEN NOT json_valid(NEW.data) BEGIN SELECT RAISE(ABORT, 'invalid_json'); END;
--> statement-breakpoint
CREATE TRIGGER journals_no_delete BEFORE DELETE ON journals BEGIN SELECT RAISE(ABORT, 'physical_delete_forbidden'); END;
--> statement-breakpoint
CREATE INDEX idx_journals_company ON journals(company_id);
--> statement-breakpoint
CREATE TRIGGER journals_valid_json BEFORE INSERT ON journals WHEN NOT json_valid(NEW.data) BEGIN SELECT RAISE(ABORT, 'invalid_json'); END;
--> statement-breakpoint
CREATE TRIGGER lines_no_delete BEFORE DELETE ON lines BEGIN SELECT RAISE(ABORT, 'physical_delete_forbidden'); END;
--> statement-breakpoint
CREATE INDEX idx_lines_company ON lines(company_id);
--> statement-breakpoint
CREATE TRIGGER lines_valid_json BEFORE INSERT ON lines WHEN NOT json_valid(NEW.data) BEGIN SELECT RAISE(ABORT, 'invalid_json'); END;
--> statement-breakpoint
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT, 'physical_delete_forbidden'); END;
--> statement-breakpoint
CREATE INDEX idx_audit_company ON audit(company_id);
--> statement-breakpoint
CREATE TRIGGER audit_valid_json BEFORE INSERT ON audit WHEN NOT json_valid(NEW.data) BEGIN SELECT RAISE(ABORT, 'invalid_json'); END;
--> statement-breakpoint
CREATE TRIGGER lines_immutable BEFORE UPDATE ON lines BEGIN SELECT RAISE(ABORT, 'immutable_record'); END;
--> statement-breakpoint
CREATE TRIGGER audit_immutable BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT, 'immutable_record'); END;
--> statement-breakpoint
CREATE TRIGGER companies_version_guard BEFORE UPDATE ON companies WHEN NEW.version != OLD.version + 1 OR NEW.owner != OLD.owner OR NEW.id != OLD.id BEGIN SELECT RAISE(ABORT, 'stale_version'); END;
--> statement-breakpoint
CREATE INDEX idx_companies_owner ON companies(owner);
--> statement-breakpoint
CREATE INDEX idx_lines_journal ON lines(journal_id);
