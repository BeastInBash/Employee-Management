# Task Tracker API Documentation

## Prisma Schema

```prisma
// This is your Prisma schema file for PostgreSQL

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String    @id @default(uuid())
  email     String    @unique
  password  String
  name      String
  country   String
  members   Member[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Member {
  id        String    @id @default(uuid())
  name      String
  email     String
  role      String
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  tasks     Task[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Task {
  id          String       @id @default(uuid())
  title       String
  description String
  status      TaskStatus
  priority    TaskPriority
  dueDate     DateTime
  memberId    String
  member      Member       @relation(fields: [memberId], references: [id])
  createdAt   DateTime     @default(now())
  completedAt DateTime?
  updatedAt   DateTime     @updatedAt
}

enum TaskStatus {
  todo
  in_progress @map("in-progress")
  review
  completed
}

enum TaskPriority {
  low
  medium
  high
  urgent
}
```

## API Endpoints

### Authentication

#### POST /api/auth/signup

Create a new user account.

```typescript
Request body: {
  email: string
  password: string
  name: string
  country: string
}

Response: {
  user: {
    id: string
    email: string
    name: string
    country: string
  }
  token: string
}
```

#### POST /api/auth/login

Login with existing credentials.

```typescript
Request body: {
  email: string
  password: string
}

Response: {
  user: {
    id: string
    email: string
    name: string
    country: string
  }
  token: string
}
```

### Members

#### GET /api/members

Get all team members for the authenticated user.

```typescript
Headers: {
  Authorization: Bearer <token>
}

Response: {
  members: {
    id: string
    name: string
    email: string
    role: string
    userId: string
    createdAt: Date
  }[]
}
```

#### POST /api/members

Add a new team member.

```typescript
Headers: {
  Authorization: Bearer <token>
}

Request body: {
  name: string
  email: string
  role: string
}

Response: {
  id: string
  name: string
  email: string
  role: string
  userId: string
  createdAt: Date
}
```

### Tasks

#### GET /api/members/:memberId/tasks

Get all tasks for a specific member.

```typescript
Headers: {
  Authorization: Bearer <token>
}

Response: {
  tasks: {
    id: string
    title: string
    description: string
    status: "todo" | "in-progress" | "review" | "completed"
    priority: "low" | "medium" | "high" | "urgent"
    dueDate: Date
    memberId: string
    createdAt: Date
    completedAt: Date | null
  }[]
}
```

#### POST /api/members/:memberId/tasks

Create a new task for a member.

```typescript
Headers: {
  Authorization: Bearer <token>
}

Request body: {
  title: string
  description: string
  status: "todo" | "in-progress" | "review" | "completed"
  priority: "low" | "medium" | "high" | "urgent"
  dueDate: Date
}

Response: {
  id: string
  title: string
  description: string
  status: "todo" | "in-progress" | "review" | "completed"
  priority: "low" | "medium" | "high" | "urgent"
  dueDate: Date
  memberId: string
  createdAt: Date
  completedAt: Date | null
}
```

#### PATCH /api/members/:memberId/tasks/:taskId

Update an existing task.

```typescript
Headers: {
  Authorization: Bearer <token>
}

Request body: {
  title?: string
  description?: string
  status?: "todo" | "in-progress" | "review" | "completed"
  priority?: "low" | "medium" | "high" | "urgent"
  dueDate?: Date
}

Response: {
  id: string
  title: string
  description: string
  status: "todo" | "in-progress" | "review" | "completed"
  priority: "low" | "medium" | "high" | "urgent"
  dueDate: Date
  memberId: string
  createdAt: Date
  completedAt: Date | null
}
```

#### DELETE /api/members/:memberId/tasks/:taskId

Delete a task.

```typescript
Headers: {
  Authorization: Bearer <token>
}

Response: {
  success: true
}
```

## Security Considerations

1. All endpoints except login and signup require JWT authentication
2. Users can only access their own members and tasks
3. Passwords must be hashed before storing in the database
4. Implementation should include proper error handling and validation
5. Task due dates should be validated to ensure they are valid dates

## Additional Notes

1. The schema includes timestamps for auditing (createdAt, updatedAt)
2. Task status and priority are implemented as enums for type safety
3. Relations are properly set up between User -> Member -> Task
4. Tasks now include priority levels (low, medium, high, urgent) and due dates
5. The schema supports the current frontend implementation perfectly
6. All IDs use UUID for better security
7. Due dates can be used to filter and sort tasks by urgency
