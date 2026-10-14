-- Additive migration only: JSON data, master records and immutable lines are unchanged.
-- Safe to rerun. No new master or balance table.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.lines','search_account_id') IS NULL
 ALTER TABLE dbo.lines ADD search_account_id AS CONVERT(nvarchar(64),JSON_VALUE([data],'$.account_id'));
IF COL_LENGTH('dbo.lines','subaccount_name') IS NULL
 ALTER TABLE dbo.lines ADD subaccount_name AS CONVERT(nvarchar(300),JSON_VALUE([data],'$.subaccount_name')) COLLATE Latin1_General_100_BIN2;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.lines') AND name='idx_lines_subaccount_search')
 CREATE INDEX idx_lines_subaccount_search ON dbo.lines(company_id,search_account_id,journal_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.lines') AND name='idx_lines_subaccount_name')
 CREATE INDEX idx_lines_subaccount_name ON dbo.lines(company_id,search_account_id,subaccount_name) INCLUDE(journal_id);
COMMIT;
