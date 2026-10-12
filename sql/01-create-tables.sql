-- SQL Server 2022/2025. Run in a NEW empty MonjaAccounting database.
SET XACT_ABORT ON;
GO

CREATE TABLE dbo.[companies] (
  [id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL PRIMARY KEY,
  [owner] nvarchar(256) COLLATE Latin1_General_100_BIN2 NOT NULL,
  [version] int NOT NULL CHECK ([version] >= 0),
  [data] nvarchar(max) NOT NULL CHECK (ISJSON([data])=1)
);
GO

CREATE INDEX idx_companies_owner ON dbo.[companies](owner);
GO

CREATE TRIGGER dbo.companies_no_delete ON dbo.[companies] INSTEAD OF DELETE AS BEGIN THROW 51000, 'physical_delete_forbidden', 1; END;
GO

CREATE TABLE dbo.[accounts] (
  [id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL PRIMARY KEY,
  [company_id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL REFERENCES dbo.companies(id),
  [code] nvarchar(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
  [data] nvarchar(max) NOT NULL CHECK (ISJSON([data])=1),
  CONSTRAINT uq_accounts_company UNIQUE(company_id,[code])
);
GO

CREATE INDEX idx_accounts_company ON dbo.[accounts](company_id);
GO

CREATE TRIGGER dbo.accounts_no_delete ON dbo.[accounts] INSTEAD OF DELETE AS BEGIN THROW 51000, 'physical_delete_forbidden', 1; END;
GO

CREATE TABLE dbo.[years] (
  [id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL PRIMARY KEY,
  [company_id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL REFERENCES dbo.companies(id),
  [data] nvarchar(max) NOT NULL CHECK (ISJSON([data])=1)
);
GO

CREATE INDEX idx_years_company ON dbo.[years](company_id);
GO

CREATE TRIGGER dbo.years_no_delete ON dbo.[years] INSTEAD OF DELETE AS BEGIN THROW 51000, 'physical_delete_forbidden', 1; END;
GO

CREATE TABLE dbo.[periods] (
  [id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL PRIMARY KEY,
  [company_id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL REFERENCES dbo.companies(id),
  [data] nvarchar(max) NOT NULL CHECK (ISJSON([data])=1)
);
GO

CREATE INDEX idx_periods_company ON dbo.[periods](company_id);
GO

CREATE TRIGGER dbo.periods_no_delete ON dbo.[periods] INSTEAD OF DELETE AS BEGIN THROW 51000, 'physical_delete_forbidden', 1; END;
GO

CREATE TABLE dbo.[subaccounts] (
  [id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL PRIMARY KEY,
  [company_id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL REFERENCES dbo.companies(id),
  [data] nvarchar(max) NOT NULL CHECK (ISJSON([data])=1)
);
GO

CREATE INDEX idx_subaccounts_company ON dbo.[subaccounts](company_id);
GO

CREATE TRIGGER dbo.subaccounts_no_delete ON dbo.[subaccounts] INSTEAD OF DELETE AS BEGIN THROW 51000, 'physical_delete_forbidden', 1; END;
GO

CREATE TABLE dbo.[journals] (
  [id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL PRIMARY KEY,
  [company_id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL REFERENCES dbo.companies(id),
  [number] nvarchar(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
  [data] nvarchar(max) NOT NULL CHECK (ISJSON([data])=1),
  CONSTRAINT uq_journals_company UNIQUE(company_id,[number])
);
GO

CREATE INDEX idx_journals_company ON dbo.[journals](company_id);
GO

CREATE TRIGGER dbo.journals_no_delete ON dbo.[journals] INSTEAD OF DELETE AS BEGIN THROW 51000, 'physical_delete_forbidden', 1; END;
GO

CREATE TABLE dbo.[lines] (
  [id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL PRIMARY KEY,
  [company_id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL REFERENCES dbo.companies(id),
  [journal_id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL REFERENCES dbo.journals(id),
  [data] nvarchar(max) NOT NULL CHECK (ISJSON([data])=1)
);
GO

CREATE INDEX idx_lines_company ON dbo.[lines](company_id);
GO

CREATE TRIGGER dbo.lines_no_delete ON dbo.[lines] INSTEAD OF DELETE AS BEGIN THROW 51000, 'physical_delete_forbidden', 1; END;
GO

CREATE TABLE dbo.[audit] (
  [id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL PRIMARY KEY,
  [company_id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL REFERENCES dbo.companies(id),
  [data] nvarchar(max) NOT NULL CHECK (ISJSON([data])=1)
);
GO

CREATE INDEX idx_audit_company ON dbo.[audit](company_id);
GO

CREATE TRIGGER dbo.audit_no_delete ON dbo.[audit] INSTEAD OF DELETE AS BEGIN THROW 51000, 'physical_delete_forbidden', 1; END;
GO

CREATE TABLE dbo.[tax_codes] (
  [id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL PRIMARY KEY,
  [company_id] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL REFERENCES dbo.companies(id),
  [code] nvarchar(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
  [data] nvarchar(max) NOT NULL CHECK (ISJSON([data])=1),
  CONSTRAINT uq_tax_codes_company UNIQUE(company_id,[code])
);
GO

CREATE INDEX idx_tax_codes_company ON dbo.[tax_codes](company_id);
GO

CREATE TRIGGER dbo.tax_codes_no_delete ON dbo.[tax_codes] INSTEAD OF DELETE AS BEGIN THROW 51000, 'physical_delete_forbidden', 1; END;
GO

CREATE TRIGGER dbo.lines_immutable ON dbo.[lines] INSTEAD OF UPDATE AS BEGIN THROW 51001, 'immutable_record', 1; END;
GO

CREATE TRIGGER dbo.audit_immutable ON dbo.[audit] INSTEAD OF UPDATE AS BEGIN THROW 51001, 'immutable_record', 1; END;
GO

CREATE TRIGGER dbo.companies_version_guard ON dbo.companies AFTER UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF UPDATE(id) THROW 51002, 'immutable_id', 1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON i.id=d.id WHERE i.version<>d.version+1 OR i.owner<>d.owner)
 THROW 51003, 'stale_version', 1;
END;
GO
CREATE TRIGGER dbo.tax_codes_rate_immutable ON dbo.tax_codes AFTER UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF UPDATE(id) THROW 51002, 'immutable_id', 1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON i.id=d.id WHERE
  ISNULL(JSON_VALUE(i.data,'$.tax_rate'),'__NULL__')<>ISNULL(JSON_VALUE(d.data,'$.tax_rate'),'__NULL__') OR
  ISNULL(JSON_VALUE(i.data,'$.tax_type'),'__NULL__')<>ISNULL(JSON_VALUE(d.data,'$.tax_type'),'__NULL__') OR i.code<>d.code)
 THROW 51004, 'tax_rate_immutable', 1;
END;
GO
CREATE INDEX idx_lines_journal ON dbo.lines(journal_id);
GO
