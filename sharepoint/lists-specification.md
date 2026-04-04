# HOPE BUILT ADVISORY — Path A: SharePoint Lists Specification
# IDEA Public Schools — F&C Command Center
# Deploy into: IDEA M365 Tenant → SharePoint Site: /sites/facilities-construction
# ============================================================

## DEPLOYMENT ORDER
1. Documents List
2. Meetings List (reference)
3. Approvals List
4. TacticalItems List
5. ActionItems List
6. BODItems List
7. Campuses List (reference)
8. DocumentTypes List (reference)

---

## 1. LIST: Documents
**Internal Name:** FC_Documents
**Template:** Custom List
**Description:** Core approval pipeline — one item per document reviewed at FAC meeting

| Column Name            | Type              | Required | Choices / Notes                                                |
|------------------------|-------------------|----------|----------------------------------------------------------------|
| Title                  | Single line text  | Yes      | Auto-populated: "{CampusName} — {DocType} — {DocNumber}"      |
| FCDate                 | Date              | Yes      | Date of FAC meeting where item was reviewed                   |
| State                  | Choice            | Yes      | TX, FL, OH, IPS_FL, TX_IPS                                    |
| DocNumber              | Number            | No       | Agenda item number within meeting                             |
| CampusName             | Single line text  | Yes      | Free text (also lookup to Campuses list)                      |
| CampusLookup           | Lookup            | No       | → Campuses list                                               |
| DocumentType           | Choice            | Yes      | Task Order, CEA, CO, ASA, Ranking, A101 Contract, Contract    |
|                        |                   |          | Amendment, PSA, Easement, Final Retainage, Monitoring Agmt,  |
|                        |                   |          | Plat Application, Permit/Application, Other                   |
| PresenterName          | Single line text  | Yes      | Free text (PMSI, internal staff name)                         |
| PresenterLookup        | Person or Group   | No       | Internal staff lookup                                         |
| Amount                 | Currency          | No       | Dollar amount (negative = credit to IDEA)                     |
| FundingRequest         | Choice            | No       | New Request, Amount available within budget, Money coming back|
|                        |                   |          | Emergency, Amount available within project budget             |
| FundingSource          | Single line text  | No       | 2025 Bond, Cash, Grant Funds, SHARS, etc.                     |
| Description            | Multiple lines    | Yes      | Full scope description                                        |
| Notes                  | Multiple lines    | No       | Discussion notes from meeting                                 |
| NextSteps              | Multiple lines    | No       | Action items / follow-up                                      |
| AttachmentLink         | Hyperlink         | No       | Link to document in SharePoint weekly folder                  |
| SharePointFolderURL    | Hyperlink         | No       | Link to the weekly docs folder                                |
| GLAccount              | Single line text  | No       | GL account string                                             |
| GLAccountFunded        | Yes/No            | No       |                                                               |
| NotifiedRM             | Yes/No            | No       | Regional manager notified                                     |
| LegalTicketNumber      | Single line text  | No       | e.g. Ticket #1209399                                          |
| PipelineStatus         | Choice (calc)     | Yes      | Pending FC Review, Pending COO, Pending Treasury, Pending     |
|                        |                   |          | Legal, Pending Finance Committee, Pending BOD,                |
|                        |                   |          | Pending Execution, Fully Executed, On Hold, Denied            |
| IsArchived             | Yes/No            | No       | Default: No                                                   |
| IsOnHold               | Yes/No            | No       | Default: No                                                   |
| OnHoldReason           | Multiple lines    | No       |                                                               |
| AdditionalNotes        | Multiple lines    | No       |                                                               |

**Views to create:**
- Active Pipeline (IsArchived=No, IsOnHold=No, grouped by PipelineStatus)
- By State (filter by State, grouped by DocumentType)
- Needs My Action (PipelineStatus=Pending FC Review)
- Waiting on Others (PipelineStatus in [Pending COO, Pending Treasury, Pending Legal])
- Pending BOD (PipelineStatus=Pending BOD, sorted by upcoming BOD date)
- On Hold (IsOnHold=Yes)
- Archived (IsArchived=Yes, sorted by FCDate desc)

---

## 2. LIST: Meetings
**Internal Name:** FC_Meetings
**Template:** Custom List
**Description:** Every FAC, Tactical, and BOD meeting — one item per meeting

| Column Name        | Type            | Required | Notes                                           |
|--------------------|-----------------|----------|-------------------------------------------------|
| Title              | Single line     | Yes      | Auto: "FAC Doc Rev — July 15, 2025"             |
| MeetingDate        | Date            | Yes      |                                                 |
| MeetingType        | Choice          | Yes      | FAC Doc Review, Tactical, Board of Directors    |
| State              | Choice          | No       | TX, FL, OH, IPS_FL, TX_IPS                     |
| AgendaGeneratedAt  | Date/Time       | No       |                                                 |
| AgendaSentAt       | Date/Time       | No       |                                                 |
| MinutesLink        | Hyperlink       | No       |                                                 |
| Coordinator        | Person or Group | No       | Default: Vanessa Rangel                         |

---

## 3. LIST: Approvals
**Internal Name:** FC_Approvals
**Template:** Custom List
**Description:** One item per approval stage per document — feeds the pipeline status

| Column Name      | Type            | Required | Notes                                                         |
|------------------|-----------------|----------|---------------------------------------------------------------|
| Title            | Single line     | Yes      | Auto: "{DocumentTitle} — {Stage}"                            |
| Document         | Lookup          | Yes      | → FC_Documents (Title)                                        |
| Stage            | Choice          | Yes      | FC Committee, COO, Treasury/Finance, Legal, Finance Committee |
|                  |                 |          | Board                                                         |
| StageOrder       | Number          | Yes      | 1-6, controls pipeline sequence                              |
| Status           | Choice          | Yes      | Pending, Approved, Approved by Delegation,                   |
|                  |                 |          | Approved — Pending Conditions, Denied, On Hold, Not Required  |
| IsRequired       | Yes/No          | Yes      | Default: Yes                                                  |
| ApproverName     | Single line     | No       | Denormalized for external approvers                          |
| Approver         | Person or Group | No       | Internal approver                                             |
| ApprovedAt       | Date/Time       | No       |                                                               |
| DeniedAt         | Date/Time       | No       |                                                               |
| Notes            | Multiple lines  | No       |                                                               |
| Conditions       | Multiple lines  | No       | e.g. "pending S&S sign-off"                                  |
| TicketNumber     | Single line     | No       | Legal ticket # e.g. Ticket #1209399                          |
| DaysAtStage      | Number (calc)   | No       | =TODAY()-Created (update daily via Flow)                     |
| IsOverdue        | Yes/No (calc)   | No       | Populated by Power Automate daily flow                       |
| NudgeSentAt      | Date/Time       | No       | Last nudge notification sent                                 |

**JSON Column Formatting for Status (conditional color):**
```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "div",
  "style": {
    "padding": "4px 10px",
    "border-radius": "12px",
    "font-weight": "600",
    "font-size": "11px",
    "background-color": {
      "operator": "?",
      "operands": [
        {"operator": "==", "operands": [{"@currentField": ""}, "Approved"]},
        "#E2EFDA",
        {"operator": "?", "operands": [
          {"operator": "==", "operands": [{"@currentField": ""}, "On Hold"]},
          "#FCE4D6",
          {"operator": "?", "operands": [
            {"operator": "==", "operands": [{"@currentField": ""}, "Denied"]},
            "#FFCCCC",
            "#FFF2CC"
          ]}
        ]}
      ]
    }
  },
  "txtContent": "@currentField"
}
```

---

## 4. LIST: TacticalItems
**Internal Name:** FC_TacticalItems
**Template:** Custom List

| Column Name          | Type            | Required | Notes                                     |
|----------------------|-----------------|----------|-------------------------------------------|
| Title                | Single line     | Yes      | Auto: "Agenda #{AgendaNumber} — {Campus}" |
| Meeting              | Lookup          | Yes      | → FC_Meetings                             |
| AgendaNumber         | Number          | No       |                                           |
| State                | Choice          | No       | TX, IPS, OH                               |
| CampusName           | Single line     | Yes      |                                           |
| Subtopic             | Single line     | No       |                                           |
| PresenterName        | Single line     | No       |                                           |
| Presenter            | Person or Group | No       |                                           |
| Description          | Multiple lines  | No       |                                           |
| DiscussionNotes      | Multiple lines  | No       |                                           |
| FCOutcome            | Choice          | No       | Approved, On Hold, Denied, Pending, Info  |
| PromotedToDocument   | Lookup          | No       | → FC_Documents (when item becomes doc)    |
| PromotedAt           | Date/Time       | No       |                                           |

---

## 5. LIST: ActionItems
**Internal Name:** FC_ActionItems
**Template:** Task list (custom)

| Column Name      | Type            | Required | Notes                                              |
|------------------|-----------------|----------|----------------------------------------------------|
| Title            | Single line     | Yes      | Action description                                 |
| Document         | Lookup          | No       | → FC_Documents                                     |
| TacticalItem     | Lookup          | No       | → FC_TacticalItems                                 |
| AssignedTo       | Person or Group | No       |                                                    |
| AssignedToName   | Single line     | No       | For external assignees (PMSI, legal, etc.)         |
| DueDate          | Date            | No       |                                                    |
| Status           | Choice          | Yes      | Open, In Progress, Complete, Cancelled             |
| Priority         | Choice          | Yes      | Urgent, High, Medium, Low                          |
| CompletedAt      | Date/Time       | No       |                                                    |
| DaysOverdue      | Number (calc)   | No       | Updated daily by Flow                              |

---

## 6. LIST: BODItems
**Internal Name:** FC_BODItems
**Template:** Custom List

| Column Name        | Type            | Required | Notes                                            |
|--------------------|-----------------|----------|--------------------------------------------------|
| Title              | Single line     | Yes      | Auto: "{Campus} — {DocType} — {BODDate}"         |
| Document           | Lookup          | Yes      | → FC_Documents                                   |
| BODMeeting         | Lookup          | No       | → FC_Meetings (MeetingType=Board of Directors)   |
| BoardEntity        | Choice          | Yes      | TX Board of Directors, IPS Board of Directors    |
|                    |                 |          | OH Board of Directors                            |
| ItemType           | Choice          | Yes      | Consent Agenda, Action Item, Ratification, Info  |
| PacketSubmitted    | Yes/No          | No       |                                                  |
| PacketSubmittedAt  | Date/Time       | No       |                                                  |
| BoardApproved      | Choice          | No       | Yes, No, Pending                                 |
| ApprovedAt         | Date/Time       | No       |                                                  |
| ResolutionNumber   | Single line     | No       |                                                  |
| BoardNotes         | Multiple lines  | No       |                                                  |

---

## 7. REFERENCE: Campuses
**Internal Name:** FC_Campuses

| Column Name | Type        | Required | Notes              |
|-------------|-------------|----------|--------------------|
| Title       | Single line | Yes      | Campus full name   |
| State       | Choice      | Yes      | TX, FL, OH         |
| Region      | Single line | No       | RGV, San Antonio…  |
| IsActive    | Yes/No      | Yes      | Default: Yes       |

---

## 8. REFERENCE: DocumentTypes
**Internal Name:** FC_DocumentTypes

| Column Name            | Type    | Required | Notes                                    |
|------------------------|---------|----------|------------------------------------------|
| Title                  | Text    | Yes      | Document type name                       |
| Abbreviation           | Text    | No       | CEA, CO, TO, etc.                        |
| RequiresLegal          | Yes/No  | Yes      |                                          |
| RequiresBOD            | Yes/No  | Yes      |                                          |
| BODAmountThreshold     | Number  | No       | Override default $50K if set             |
| RequiresBudgetAmendment| Yes/No  | Yes      |                                          |
| RequiresWetSignature   | Yes/No  | Yes      |                                          |
| ApprovalStages         | Text    | Yes      | Comma-separated: "fc_committee,coo,..."  |
| Notes                  | Text    | No       |                                          |
| IsActive               | Yes/No  | Yes      |                                          |

---

## POWER AUTOMATE FLOWS

### Flow 1: Document Submitted — Auto-Create Approvals
**Trigger:** SharePoint — When item is created in FC_Documents
**Actions:**
1. Get DocumentType from FC_DocumentTypes
2. Parse ApprovalStages column (split by comma)
3. For each stage → Create item in FC_Approvals
4. If RequiresBOD=Yes OR Amount > 50000 → Create item in FC_BODItems
5. Send email to Vanessa: "New document submitted — {Title}"

### Flow 2: Approval Updated — Route to Next Stage
**Trigger:** SharePoint — When item modified in FC_Approvals (Status changes)
**Condition:** Status changed to "Approved" or "Approved by Delegation"
**Actions:**
1. Get next required Approval (StageOrder + 1) for same Document
2. If next stage exists → Send approval request email to approver
   - Email body includes: Document details, Amount, Description, Link to item
   - Include [Approve] and [Deny] buttons (adaptive card or URL action)
3. If no next stage → Update Document PipelineStatus = "Pending Execution"
4. Update Document PipelineStatus based on current state (recalc)

### Flow 3: Daily Aging Monitor (Scheduled — 8AM weekdays)
**Trigger:** Scheduled — Recurrence daily at 8:00 AM Mon-Fri
**Actions:**
1. Get all FC_Approvals where Status = "Pending"
2. For each: Calculate DaysAtStage = today - Created date
3. Update DaysAtStage column
4. If DaysAtStage > 5 AND IsOverdue = No:
   - Set IsOverdue = Yes
   - Send nudge email to approver
   - CC Vanessa
   - Update NudgeSentAt
5. Update FC_ActionItems DaysOverdue column

### Flow 4: Weekly Agenda Builder (Wednesday 7:00 AM)
**Trigger:** Scheduled — Recurrence every Wednesday at 7:00 AM
**Actions:**
1. Get upcoming Friday's meeting from FC_Meetings
2. Get all FC_Documents where IsArchived=No, IsOnHold=No
3. Group by State (TX, FL, OH)
4. Build HTML email with agenda format
5. Send draft email to Vanessa for review (not direct to full committee)
6. Create FC_Meetings item if it doesn't exist for this Friday

### Flow 5: BOD Packet Builder (21 days before each BOD meeting)
**Trigger:** Scheduled — Daily, checks if any BOD meeting is exactly 21 days out
**Actions:**
1. Find FC_Meetings where MeetingType="Board of Directors" AND MeetingDate = today + 21 days
2. Get all FC_BODItems linked to that meeting (or unassigned + approved)
3. Build digest: campus, doc type, amount, summary for each item
4. Calculate total dollar value
5. Send digest to Vanessa + leadership (COO, CFO)
6. Mark PacketSubmitted = Yes on all included BODItems

---

## SITE STRUCTURE

```
/sites/facilities-construction/
├── Lists/
│   ├── FC_Documents          ← core list
│   ├── FC_Meetings           ← reference
│   ├── FC_Approvals          ← workflow
│   ├── FC_TacticalItems      ← tactical log
│   ├── FC_ActionItems        ← task tracking
│   ├── FC_BODItems           ← board tracking
│   ├── FC_Campuses           ← reference data
│   └── FC_DocumentTypes      ← approval matrix
├── Pages/
│   ├── Dashboard.aspx        ← embedded Power Apps
│   └── Leadership.aspx       ← embedded Power BI
├── Documents/
│   └── {FY25-26}/
│       └── {WeekOf_YYYY-MM-DD}/
│           └── [weekly doc files live here]
└── SiteAssets/
    └── [Power Apps embed assets]
```

---

## POWER APPS — CANVAS APP SCREENS

**App Name:** FC Command Center
**Connection:** SharePoint (all 8 lists above)

### Screen 1: Command Center (Swimlanes)
- 4 galleries arranged horizontally
- Gallery 1: Filter(FC_Documents, PipelineStatus="Pending FC Review")
- Gallery 2: Filter(FC_Documents, PipelineStatus in ["Pending COO","Pending Treasury","Pending Legal"])
- Gallery 3: Filter(FC_BODItems, BoardApproved=Pending, board meeting within 30 days)
- Gallery 4: Filter(FC_Documents, PipelineStatus="Fully Executed", DateDiff(UpdatedAt,Today(),Days)<7)
- Top metric cards: CountIf() formulas for each lane
- "+ Submit" button → navigates to Screen 4 (submission form)

### Screen 2: Document Table
- Sortable, filterable data table
- Search box: Filter by campus name, doc type, ticket number (Search() function)
- Filter chips: State, Status, BOD Required, Legal Required
- Click row → navigates to Screen 3 (document detail)

### Screen 3: Document Detail
- Full document info display
- Approval timeline (vertical stepper from FC_Approvals)
- Action items sub-gallery
- "Update Approval" button → approval form overlay
- "Add Action Item" button

### Screen 4: Submit Document Form
- Smart form with conditional fields
- OnChange(DocumentType): show/hide BOD warning, Legal warning
- OnChange(Amount): if > 50000 → show BOD flag
- Submit → Patch(FC_Documents, ...) + triggers Flow 1

### Screen 5: Leadership Dashboard
- KPI cards using CountIf, Sum from FC_Documents
- Embedded Power BI report (iframe or Power BI tile)
- BOD calendar timeline

### Screen 6: Tactical Meeting Log
- Meeting selector (dropdown from FC_Meetings)
- Tactical items gallery for selected meeting
- "Promote to Document" button → creates FC_Documents record
