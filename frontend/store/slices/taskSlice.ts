import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../lib/api';

interface Task {
  _id: string;
  appointment: any;
  patient: any;
  assignedTo?: any;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdBy: any;
  createdAt: string;
  updatedAt: string;
}

interface TaskState {
  tasks: Task[];
  currentTask: Task | null;
  loading: boolean;
  error: string | null;
  success: string | null;
}

const initialState: TaskState = {
  tasks: [],
  currentTask: null,
  loading: false,
  error: null,
  success: null
};

// Get all tasks
export const getTasks = createAsyncThunk('tasks/getTasks', async (params?: any) => {
  const response = await api.get('/api/tasks', { params });
  return response.data.tasks;
});

// Get single task
export const getTask = createAsyncThunk('tasks/getTask', async (id: string) => {
  const response = await api.get(`/api/tasks/${id}`);
  return response.data.task;
});

// Create task
export const createTask = createAsyncThunk('tasks/createTask', async (taskData: any) => {
  const response = await api.post('/api/tasks', taskData);
  return response.data.task;
});

// Update task
export const updateTask = createAsyncThunk('tasks/updateTask', async ({ id, data }: { id: string; data: any }) => {
  const response = await api.put(`/api/tasks/${id}`, data);
  return response.data.task;
});

// Delete task
export const deleteTask = createAsyncThunk('tasks/deleteTask', async (id: string) => {
  await api.delete(`/api/tasks/${id}`);
  return id;
});

const taskSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    clearTaskError: (state) => {
      state.error = null;
    },
    clearTaskSuccess: (state) => {
      state.success = null;
    }
  },
  extraReducers: (builder) => {
    // Get all tasks
    builder.addCase(getTasks.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(getTasks.fulfilled, (state, action) => {
      state.loading = false;
      state.tasks = action.payload;
    });
    builder.addCase(getTasks.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch tasks';
    });

    // Get single task
    builder.addCase(getTask.fulfilled, (state, action) => {
      state.currentTask = action.payload;
    });

    // Create task
    builder.addCase(createTask.fulfilled, (state, action) => {
      state.tasks.unshift(action.payload);
      state.success = 'Task created successfully';
    });

    // Update task
    builder.addCase(updateTask.fulfilled, (state, action) => {
      const index = state.tasks.findIndex((t) => t._id === action.payload._id);
      if (index !== -1) {
        state.tasks[index] = action.payload;
      }
      if (state.currentTask?._id === action.payload._id) {
        state.currentTask = action.payload;
      }
      state.success = 'Task updated successfully';
    });

    // Delete task
    builder.addCase(deleteTask.fulfilled, (state, action) => {
      state.tasks = state.tasks.filter((t) => t._id !== action.payload);
      state.success = 'Task deleted successfully';
    });
  }
});

export const { clearTaskError, clearTaskSuccess } = taskSlice.actions;
export default taskSlice.reducer;
