# Polysaccharide Research Database Website Design

## Goal

Build a polished, standard research website for the polysaccharide dataset in `多糖数据填写所有.xlsx`.
The first version uses only the workbook's `单表导入模板` data as the initial source, imports the records into the site, and provides both a public research database interface and a single-admin editing backend.

## Source Data

- Source workbook: `多糖数据填写所有.xlsx`
- Source sheet: first data sheet, named `单表导入模板` in the workbook
- Current inspected size: 772 records and 42 fields
- Year range observed: 1954 to 2027
- Main source category observed: mostly plant polysaccharides
- Main activity categories observed: antioxidant, immune regulation, hypoglycemic, anti-inflammatory, antitumor, gut microbiota regulation, and other activities

The source Excel file is treated as import input. After import, website edits are stored in the website database and do not directly overwrite the original Excel file.

## First Version Scope

The first version includes:

- Public research homepage
- Searchable polysaccharide database
- Record detail view
- Data dictionary / field explanation page
- Data quality dashboard
- Single-admin login
- Admin record list
- Admin create, edit, and review-status update workflow
- Initial import from `多糖数据填写所有.xlsx`

The first version does not include:

- Multi-user accounts
- Role-based permissions
- Full edit history/audit trail
- Public user submissions
- Automatic DOI or PubMed enrichment through external APIs
- Direct write-back to Excel

These can be added after the first version is stable.

## Information Architecture

### Public Site

1. Home
   - Database title and concise research positioning
   - Total record count
   - Year span
   - Source category summary
   - Activity category summary
   - Evidence level summary
   - Data quality callouts

2. Database
   - Keyword search across standard name, English name, alias, literature title, source species, DOI, activity, mechanism, and conclusion
   - Filters for publication year, source category, activity category, evidence level, structure completeness, and review status
   - Sort options for publication year, standard name, source species, and review status
   - Table/list view with compact research fields

3. Record Detail
   - Identity: standard name, English name, alias
   - Literature: title, journal, year, DOI, PMID, original link
   - Source and preparation: species, source category, extraction part, extraction method, purification method
   - Structure: molecular weight, unit, measurement method, monosaccharide composition, ratio, glycosidic linkage, backbone, branch, branch site, substituent modification, structure completeness
   - Bioactivity: activity category, subtype, evidence level, experiment type, model, object, endpoint, conclusion, pathway, key molecules
   - Data management: review status, recorder, entry date, notes

4. Data Dictionary
   - Explain each standardized field in plain Chinese
   - List controlled vocabulary values from the workbook dictionary where available
   - Clarify which fields are identifiers, literature metadata, source fields, structure fields, activity fields, and quality-control fields

5. Quality Dashboard
   - Missing DOI
   - Missing source species
   - Missing source category
   - Missing molecular weight
   - Missing standardized monosaccharide composition
   - Missing activity category
   - Missing evidence level
   - Missing experiment conclusion
   - Missing or pending review status
   - Publication years later than the current date year, including the observed 2027 values

### Admin Site

1. Login
   - Single administrator account
   - Password stored as a hash, not plain text
   - Login session stored securely by the application

2. Admin Dashboard
   - Total records
   - Pending review count
   - Records needing data-quality attention
   - Quick links to edit records and create new records

3. Record Management
   - Admin list view with search and filters
   - Edit existing record
   - Create new record
   - Update review status
   - Basic validation before save

4. Import Status
   - Show that initial data came from `多糖数据填写所有.xlsx`
   - Show import count and latest import time if available

## Data Model

Use one primary `polysaccharide_records` table for the first version. The table mirrors the 42 workbook fields and adds website management fields.

Core workbook-derived fields:

- upload_id
- standard_name
- english_name
- aliases
- ref_id
- literature_title
- journal
- publication_year
- doi
- pmid
- source_url
- source_species
- source_category
- extraction_part
- extraction_method
- purification_method
- molecular_weight_value
- molecular_weight_unit
- molecular_weight_method
- monosaccharide_original
- monosaccharide_standardized
- monosaccharide_ratio
- glycosidic_linkage
- backbone_description
- branch_description
- branch_site
- substituent_modification
- structure_completeness
- activity_category
- activity_subcategory
- evidence_level
- experiment_type
- experiment_model
- experiment_object
- endpoint
- conclusion
- mechanism_pathway
- key_molecules
- review_status
- recorder
- entry_date
- notes

Website management fields:

- id
- created_at
- updated_at
- data_quality_flags

## Standardization Rules

1. Keep the original field meaning from Excel.
2. Convert empty cells to blank values instead of invented content.
3. Convert publication year to a number when possible.
4. Keep DOI, PMID, source URL, names, species, and literature text as strings.
5. Normalize review status values into a small set:
   - 待审核
   - 已审核
   - 需修改
   - 未标注
6. Preserve original activity labels, but support grouped filtering by the visible `活性大类` field.
7. Preserve original structure completeness labels, while making them filterable.
8. Flag abnormal or incomplete records rather than silently changing them.

## Quality Rules

The website automatically flags records with:

- missing standard name
- missing English name
- missing DOI
- missing source species
- missing source category
- missing molecular weight value
- missing standardized monosaccharide composition
- missing activity category
- missing evidence level
- missing experiment conclusion
- missing review status
- publication year greater than the current year

These flags are shown in the quality dashboard and on admin edit pages.

## Visual Direction

The visual style should feel like a serious research database, not a marketing landing page.

Design principles:

- clean academic interface
- strong search and filtering
- readable dense tables
- restrained color palette with scientific green, blue, and neutral tones
- compact summary cards for metrics
- clear status badges for review and quality flags
- responsive layout for desktop and tablet, with usable mobile browsing

The first screen should immediately signal:

- this is a polysaccharide research database
- the dataset is searchable
- the site contains structured literature, source, structure, and bioactivity information

## Architecture

Use a modern web application with:

- frontend pages for public search and detail views
- backend routes or server actions for admin login and record editing
- persistent database storage for imported and edited records
- import script for the Excel workbook
- environment-based admin credentials or initialization secret

The project should avoid hardcoded real passwords. The first admin credential should be configured locally or through environment variables.

## Validation And Testing

Before calling the first version complete:

- confirm the workbook import produces 772 records
- confirm key fields are visible in the public database
- confirm filters work for source category, activity category, evidence level, structure completeness, review status, and year
- confirm keyword search returns expected records
- confirm record detail pages show literature, source, structure, activity, and management sections
- confirm admin login blocks unauthenticated access
- confirm admin can edit a record and save changes
- confirm admin can create a new record
- confirm quality dashboard flags missing fields and future publication years
- run the site build successfully

## Delivery

The first deliverable is a working local or hosted research website populated from `多糖数据填写所有.xlsx`.
If hosting is enabled, deliver the production website URL. If hosting is not completed in the first pass, deliver the local preview URL and clearly state what remains for publication.
