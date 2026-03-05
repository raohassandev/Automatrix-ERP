# Rollback Communication Template

## 1) Incident Start (Internal)

Subject: `[ERP-PROD] Incident Declared - Rollback Initiated`

Message:
1. Incident ID: `<INCIDENT_ID>`
2. Start time (UTC): `<TIME>`
3. Impact: `<brief impact>`
4. Decision: rollback to known good release
5. Rollback commit: `<ROLLBACK_COMMIT>`
6. DB rollback needed: `YES/NO`
7. Owner approver: `<NAME>`
8. Next update in: `15 minutes`

## 2) User-Facing Notice (Short)

Subject: `AutoMatrix ERP Service Degradation - Recovery In Progress`

Message:
AutoMatrix ERP is currently under recovery due to an operational issue.  
We are performing a controlled rollback to restore stable service.  
Some recent updates may appear delayed during this window.  
Next update at: `<TIME>`.

## 3) Mid-Rollback Update

Subject: `[ERP-PROD] Rollback Progress Update`

Message:
1. Code rollback: `DONE/IN PROGRESS`
2. DB rollback: `DONE/IN PROGRESS/NOT REQUIRED`
3. Health check: `PASS/FAIL`
4. Login check: `PASS/FAIL`
5. ETA to restore service: `<ETA>`

## 4) Recovery Complete

Subject: `AutoMatrix ERP Service Restored`

Message:
Service has been restored successfully.
1. Restore time (UTC): `<TIME>`
2. Rolled back to: `<ROLLBACK_COMMIT>`
3. Data rollback: `YES/NO`
4. User action required: `<if any>`
5. Post-incident report ETA: `<DATE/TIME>`

## 5) Postmortem Placeholder

1. Root cause:
2. Trigger:
3. Detection gap:
4. Fix:
5. Preventive actions:
6. Owners + due dates:

