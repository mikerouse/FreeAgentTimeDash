# Client Configuration Feature Plan

## Overview
Enable users to configure each of the 3 timer clocks to track time for specific FreeAgent projects and tasks, creating a seamless time tracking to billing workflow.

## User Story
> "As a freelancer/agency, I want to assign each timer clock to a specific client project and task so that when I track time, it automatically creates timeslips in FreeAgent for billing."

## Feature Requirements

### Core Functionality
1. **Project Selection:** Choose FreeAgent project for each timer
2. **Task Selection:** Choose specific task within the project
3. **Visual Mapping:** Clear indication of which timer maps to which client
4. **Automatic Sync:** Timer stops create FreeAgent timeslips automatically
5. **Configuration Persistence:** Settings saved across browser sessions

### UI Components Needed

#### 1. Configuration Modal/Settings
- **Trigger:** "⚙️ Configure" button in popup
- **Layout:** 3 configuration panels (one per timer)
- **Per Timer:**
  - Client/Project dropdown (grouped by contact_name)
  - Task dropdown (filtered by selected project)
  - Color theme selector
  - Display name customization

#### 2. Enhanced Timer Display
- **Client Name:** Show project contact_name instead of "Client 1"
- **Project Badge:** Small indicator showing project name
- **Task Context:** Optional task name display
- **Status Indicators:** Visual feedback for sync status

#### 3. Sync Status UI
- **Success Indicators:** ✅ when timeslip created successfully
- **Error Handling:** ⚠️ with retry options when sync fails
- **Offline Queue:** Queue timeslips when offline, sync when online

## Technical Implementation

### 1. Data Structure Extensions

```javascript
// Enhanced client configuration
this.clients = {
    1: {
        name: 'Acme Corp', // From project.contact_name
        color: '#FF5722',
        project: {
            url: 'https://api.freeagent.com/v2/projects/123',
            name: 'Website Redesign',
            contact_name: 'Acme Corp'
        },
        task: {
            url: 'https://api.freeagent.com/v2/tasks/456',
            name: 'Frontend Development',
            is_billable: true,
            billing_rate: '75.0'
        }
    },
    // ... timers 2 and 3
};

// Current user context (needed for timeslips)
this.currentUser = {
    url: 'https://api.freeagent.com/v2/users/789',
    name: 'John Doe'
};
```

### 2. API Integration Points

#### Project Loading
```javascript
async loadProjects() {
    const auth = new FreeAgentAuth();
    const response = await auth.apiRequest('/projects?view=active&nested=true');
    const projects = await response.json();
    // Group by contact_name for UI
    return this.groupProjectsByContact(projects.projects);
}
```

#### Task Loading
```javascript
async loadTasksForProject(projectUrl) {
    const auth = new FreeAgentAuth();
    const response = await auth.apiRequest(`/tasks?project=${projectUrl}&view=active`);
    const tasks = await response.json();
    return tasks.tasks;
}
```

#### Current User
```javascript
async getCurrentUser() {
    const auth = new FreeAgentAuth();
    const response = await auth.apiRequest('/users/me');
    return await response.json();
}
```

#### Timeslip Creation
```javascript
async createTimeslip(timerId, elapsedMs) {
    const client = this.clients[timerId];
    const hours = elapsedMs / (1000 * 60 * 60);
    
    const timeslipData = {
        timeslip: {
            task: client.task.url,
            user: this.currentUser.url,
            project: client.project.url,
            dated_on: new Date().toISOString().split('T')[0],
            hours: Math.round(hours * 100) / 100, // Round to 2 decimals
            comment: `Auto-tracked via Timer ${timerId}: ${client.name}`
        }
    };
    
    const auth = new FreeAgentAuth();
    const response = await auth.apiRequest('/timeslips', {
        method: 'POST',
        body: JSON.stringify(timeslipData)
    });
    
    return await response.json();
}
```

### 3. Configuration UI Flow

#### Settings Modal Structure
```html
<div id="config-modal" class="modal">
    <div class="modal-content">
        <h3>Configure Timer Clients</h3>
        
        <!-- Timer 1 Configuration -->
        <div class="timer-config">
            <h4>Timer 1</h4>
            <select id="project-1" class="project-select">
                <option value="">Select Project...</option>
                <optgroup label="Acme Corp">
                    <option value="url1">Website Redesign</option>
                    <option value="url2">Mobile App</option>
                </optgroup>
            </select>
            
            <select id="task-1" class="task-select" disabled>
                <option value="">Select Task...</option>
            </select>
            
            <div class="color-picker">
                <input type="color" id="color-1" value="#FF5722">
            </div>
        </div>
        
        <!-- Repeat for Timer 2 & 3 -->
    </div>
</div>
```

### 4. File Structure Changes

```
├── popup.html              # Add config button
├── popup.js                # Enhanced client management
├── background.js           # Updated sync logic
├── auth.js                 # Existing auth service
├── config.js               # New: Configuration management
├── config.html             # New: Configuration modal
├── freeagent-api.js        # New: API wrapper service
└── styles/
    └── config.css          # New: Configuration UI styles
```

## Implementation Phases

### Phase 1: Basic Configuration (MVP)
1. ✅ Create knowledge base files (completed)
2. 🔄 Add configuration modal to popup
3. 🔄 Implement project/task selection dropdowns
4. 🔄 Save configuration to Chrome storage
5. 🔄 Update timer display with project names

### Phase 2: Automatic Sync
1. 🔄 Integrate timeslip creation on timer stop
2. 🔄 Add current user detection
3. 🔄 Implement error handling and retry logic
4. 🔄 Add sync status indicators

### Phase 3: Enhanced UX
1. 🔄 Offline queue for sync when disconnected
2. 🔄 Bulk operations (multiple timers → multiple timeslips)
3. 🔄 Time editing and adjustment UI
4. 🔄 Detailed sync history and logs

### Phase 4: Advanced Features
1. 🔄 Default task creation for projects
2. 🔄 Time budget tracking and warnings
3. 🔄 Reporting and analytics integration
4. 🔄 Keyboard shortcuts for project switching

## Success Metrics
- **Configuration Complete:** All 3 timers have valid project/task assignments
- **Sync Success Rate:** >95% of timer stops create timeslips successfully
- **User Adoption:** Settings saved and reused across sessions
- **Error Recovery:** Failed syncs can be retried and resolved

## Next Steps
1. Start with Phase 1: Create configuration modal
2. Implement project dropdown population
3. Add task selection based on project choice
4. Test with real FreeAgent data
5. Iterate based on usability feedback