# FreeAgent Timeslips API - Knowledge Reference

## Overview
Timeslips in FreeAgent represent logged time entries. They track work done on specific tasks within projects and can be billed to clients. Timeslips are the core entity for time tracking and billing.

## Key Endpoints

### List All Timeslips
```
GET https://api.freeagent.com/v2/timeslips
```

**Filters:**
- `?view=all` - Return all timeslips (default)
- `?view=unbilled` - Return only unbilled timeslips
- `?user=https://api.freeagent.com/v2/users/:id` - Timeslips for specific user
- `?task=https://api.freeagent.com/v2/tasks/:id` - Timeslips for specific task
- `?project=https://api.freeagent.com/v2/projects/:id` - Timeslips for specific project
- `?from_date=YYYY-MM-DD` - Timeslips from date onwards
- `?to_date=YYYY-MM-DD` - Timeslips up to date

**Sort Options:**
- `?sort=dated_on` (default)
- `?sort=created_at`
- `?sort=updated_at`
- Use `-` prefix for descending order

### Get Single Timeslip
```
GET https://api.freeagent.com/v2/timeslips/:id
```

### Create Timeslip
```
POST https://api.freeagent.com/v2/timeslips
```

### Update Timeslip
```
PUT https://api.freeagent.com/v2/timeslips/:id
```

### Delete Timeslip
```
DELETE https://api.freeagent.com/v2/timeslips/:id
```

## Important Attributes

### Required Attributes
- `task` - URI of the task being worked on
- `user` - URI of the user who did the work
- `project` - URI of the project containing the task
- `dated_on` - Date of work in `YYYY-MM-DD` format
- `hours` - Number of hours worked (decimal, e.g., 1.5 for 1:30 hours)

### Optional Attributes
- `comment` - Free-text description of work done
- `billed_on_invoice` - Invoice URI if already billed

### Response-Only Attributes
- `url` - Unique timeslip URI
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

## Example Timeslip Creation
```json
{
  "timeslip": {
    "task": "https://api.freeagent.com/v2/tasks/123",
    "user": "https://api.freeagent.com/v2/users/456",
    "project": "https://api.freeagent.com/v2/projects/789",
    "dated_on": "2025-09-08",
    "hours": 2.5,
    "comment": "Implemented user authentication feature"
  }
}
```

## Example Response
```json
{
  "timeslips": [
    {
      "url": "https://api.freeagent.com/v2/timeslips/1",
      "task": "https://api.freeagent.com/v2/tasks/123",
      "user": "https://api.freeagent.com/v2/users/456", 
      "project": "https://api.freeagent.com/v2/projects/789",
      "dated_on": "2025-09-08",
      "hours": "2.5",
      "comment": "Implemented user authentication feature",
      "billed_on_invoice": null,
      "created_at": "2025-09-08T14:30:00Z",
      "updated_at": "2025-09-08T14:30:00Z"
    }
  ]
}
```

## Time Tracker Integration Notes

### For Timer Sync
1. **Required Data:** Collect task, project, user, date, and hours
2. **User Context:** Get current user from `/v2/users/me`
3. **Automatic Creation:** Create timeslips when timer stops
4. **Batch Creation:** Consider batching multiple timer stops

### Timer to Timeslip Mapping
```javascript
// When timer stops
const timeslipData = {
  task: selectedTask.url,           // From task selection
  user: currentUser.url,            // From /v2/users/me
  project: selectedProject.url,     // From project selection
  dated_on: new Date().toISOString().split('T')[0], // Today
  hours: elapsedTimeMs / (1000 * 60 * 60), // Convert ms to hours
  comment: `Auto-tracked via Timer ${timerId}`
};
```

### Time Format Conversion
- **Timer Storage:** Milliseconds
- **FreeAgent API:** Decimal hours
- **Conversion:** `hours = milliseconds / (1000 * 60 * 60)`
- **Example:** 90 minutes = 5400000ms = 1.5 hours

### Validation Rules
- `hours` must be positive decimal
- `dated_on` must be valid date in YYYY-MM-DD format
- `task`, `user`, `project` must be valid FreeAgent URIs
- `comment` is optional but recommended for clarity

### Error Handling
- **Invalid Task:** Task may be completed/hidden
- **Invalid Project:** Project may be cancelled/hidden
- **Date Restrictions:** Some clients may restrict backdating
- **Permissions:** User must have access to project/task

### Billing Integration
- Timeslips with billable tasks can be added to invoices
- `billed_on_invoice` field tracks billing status
- Use `?view=unbilled` to find unprocessed time entries

### Performance Considerations
- **Pagination:** Large timeslip lists are paginated
- **Date Filtering:** Use date filters for large datasets
- **Caching:** Cache project/task data to reduce API calls
- **Batch Operations:** Group multiple timeslip operations