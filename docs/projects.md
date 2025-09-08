# FreeAgent Projects API - Knowledge Reference

## Overview
Projects in FreeAgent represent client work or business initiatives. Each project is linked to a contact (client) and contains tasks for time tracking.

## Key Endpoints

### List All Projects
```
GET https://api.freeagent.com/v2/projects
```

**Filters:**
- `?view=active` - Show only active projects
- `?view=completed` - Show only completed projects
- `?view=cancelled` - Show only cancelled projects
- `?view=hidden` - Show only hidden projects
- `?contact=https://api.freeagent.com/v2/contacts/:id` - Projects for specific contact
- `?nested=true` - Include full contact details in response

**Sort Options:**
- `?sort=name` (default)
- `?sort=contact_name`
- `?sort=created_at`
- `?sort=updated_at`
- Use `-` prefix for descending (e.g., `?sort=-updated_at`)

### Get Single Project
```
GET https://api.freeagent.com/v2/projects/:id
```

### Create Project
```
POST https://api.freeagent.com/v2/projects
```

### Update Project
```
PUT https://api.freeagent.com/v2/projects/:id
```

## Important Attributes

### Required Attributes
- `contact` - URI to the contact (client) billing this project
- `name` - Project name (string)
- `status` - `Active`, `Completed`, `Cancelled`, or `Hidden`
- `currency` - Currency code (e.g., `GBP`, `USD`, `EUR`)
- `budget_units` - `Hours`, `Days`, or `Monetary`

### Key Optional Attributes
- `budget` - Project budget amount
- `normal_billing_rate` - Default billing rate for project
- `billing_period` - `hour` or `day`
- `hours_per_day` - Working hours per day (e.g., `8.0`)
- `starts_on` - Project start date (`YYYY-MM-DD`)
- `ends_on` - Project end date (`YYYY-MM-DD`)
- `is_ir35` - Boolean for IR35 compliance (UK contractors)

### Response-Only Attributes
- `url` - Unique project URI
- `contact_name` - Display name of associated contact
- `is_deletable` - Whether project can be deleted
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

## Example Response
```json
{
  "projects": [
    {
      "url": "https://api.freeagent.com/v2/projects/1",
      "name": "Test Project",
      "contact": "https://api.freeagent.com/v2/contacts/1",
      "contact_name": "Acme Trading",
      "status": "Active",
      "currency": "GBP",
      "budget": 0,
      "budget_units": "Hours",
      "normal_billing_rate": "0.0",
      "billing_period": "hour",
      "hours_per_day": "8.0",
      "created_at": "2011-09-14T16:05:57Z",
      "updated_at": "2011-09-14T16:05:57Z"
    }
  ]
}
```

## Time Tracker Integration Notes

### For Client Configuration
1. **Fetch Active Projects:** Use `GET /v2/projects?view=active` to get list of active projects
2. **Display for Selection:** Show `name` and `contact_name` for user selection
3. **Store Project URL:** Save the full `url` field for timeslip creation
4. **Filter by Client:** Use `?contact=` filter to show projects for specific clients

### Project Selection UI Considerations
- Group projects by `contact_name` (client)
- Show project status with visual indicators
- Display billing information if relevant
- Allow search/filter by project name
- Cache project list but refresh periodically

### Essential Fields for Timeslips
- `url` - Required for creating timeslips
- `name` - Display name
- `contact_name` - Client identification
- `currency` - For billing calculations
- `normal_billing_rate` - Default rate if not overridden by task