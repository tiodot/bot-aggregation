import { create } from 'zustand';

const useStore = create((set, get) => ({
  // AI services state
  aiServices: [
    { name: 'Qwen', color: '#89b4fa', status: 'loading', response: '', error: null },
    { name: 'DeepSeek', color: '#cba6f7', status: 'loading', response: '', error: null },
    { name: 'Kimi', color: '#fab387', status: 'loading', response: '', error: null },
  ],

  // Update a specific AI's status
  updateStatus: (name, status) => set((state) => ({
    aiServices: state.aiServices.map((ai) =>
      ai.name === name ? { ...ai, status, error: status === 'error' ? ai.error : null } : ai
    ),
  })),

  // Update a specific AI's response chunk
  updateChunk: (name, chunk) => set((state) => ({
    aiServices: state.aiServices.map((ai) =>
      ai.name === name ? { ...ai, response: chunk } : ai
    ),
  })),

  // Set error for a specific AI
  setError: (name, error) => set((state) => ({
    aiServices: state.aiServices.map((ai) =>
      ai.name === name ? { ...ai, error, status: 'error' } : ai
    ),
  })),

  // Clear all responses (before new query)
  clearResponses: () => set((state) => ({
    aiServices: state.aiServices.map((ai) => ({ ...ai, response: '', error: null })),
  })),
}));

export default useStore;
