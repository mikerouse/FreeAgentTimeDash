# FreeAgent Tasks API - Knowledge Reference

## Overview
Tasks in FreeAgent represent specific activities within projects. They provide granular time tracking and can have individual billing rates. Tasks are always associated with a project.

## Key Endpoints

### List All Tasks
```
GET https://api.freeagent.com/v2/tasks
```

**Filters:**
- `?view=all` - Show all tasks (default)
- `?view=active` - Show only active tasks
- `?view=completed` - Show only completed tasks 
- `?view=hidden` - Show only hidden tasks
- `?project=https://api.freeagent.com/v2/projects/:id` - Tasks for specific project
- `?updated_since=YYYY-MM-DD` - Tasks updated since date

**Sort Options:**
- `?sort=name` (default)
- `?sort=project` - Sort by project ID
- `?sort=billing_rate`
- `?sort=created_at`
- `?sort=updated_at`

### Get Single Task
```
GET https://api.freeagent.com/v2/tasks/:id
```

### Create Task
```
POST https://api.freeagent.com/v2/tasks?project=:project_url
```

### Update Task
```
PUT https://api.freeagent.com/v2/tasks/:id
```

### Delete Task
```
DELETE https://api.freeagent.com/v2/tasks/:id
```

## Important Attributes

### Required Attributes
- `name` - Task name (string)

### Key Optional Attributes
- `is_billable` - Boolean, true if charging clients for this task
- `status` - `Active`, `Completed`, or `Hidden`
- `currency` - Currency code (inherited from project if not specified)

### Billing Attributes (Contacts & Projects permission required)
- `billing_rate` - Rate charged for this task
- `billing_period` - `hour` or `day`

### Response-Only Attributes
- `url` - Unique task URI
- `project` - URI of associated project
- `is_deletable` - Whether task can be deleted
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

## Example Response
```json
{
  "tasks": [
    {
      "url": "https://api.freeagent.com/v2/tasks/1",
      "project": "https://api.freeagent.com/v2/projects/1",
      "name": "Sample Task",
      "currency": "GBP",
      "is_billable": true,
      "billing_rate": "75.0",
      "billing_period": "hour",
      "status": "Active",
      "created_at": "2011-08-16T11:06:57Z",
      "updated_at": "2011-08-16T11:06:57Z",
      "is_deletable": true
    }
  ]
}
```

## Time Tracker Integration Notes

### For Task Selection
1. **Fetch Project Tasks:** Use `GET /v2/tasks?project=<project_url>&view=active`
2. **Default Task Creation:** Create a default "General Work" task if none exist
3. **Display with Context:** Show task name with project context
4. **Store Task URL:** Save the full `url` field for timeslip creation

### Task Management UI
- Group tasks by project
- Show billing rates for transparency
- Indicate billable vs non-billable tasks
- Allow quick task creation from timer interface
- Show task status with visual indicators

### Common Task Patterns
- **General/Development** - General project work
- **Meetings** - Client meetings and calls
- **Research** - Investigation and planning
- **Bug Fixes** - Issue resolution
- **Documentation** - Writing documentation
- **Testing** - Quality assurance work

### Task Hierarchy Consideration
Tasks are flat within a project - no sub-tasks or hierarchy. For complex work breakdown:
- Use descriptive task names (e.g., "Frontend Development", "Backend API")
- Create separate tasks for different billing rates
- Use task status to manage workflow

### Essential Fields for Timeslips
- `url` - Required for creating timeslips
- `name` - Display name
- `project` - Associated project URL
- `is_billable` - Affects billing calculations
- `billing_rate` - Overrides project rate if specified
- `billing_period` - Rate calculation period