import { create } from 'zustand'

interface ConverterStore {
  input: string
  output: string
  pendingAlgorithm: string | null
  setInput: (v: string) => void
  setOutput: (v: string) => void
  sendToConverter: (v: string, algorithm?: string) => void
  clearPendingAlgorithm: () => void
}

export const useConverterStore = create<ConverterStore>((set) => ({
  input: '',
  output: '',
  pendingAlgorithm: null,
  setInput: (v) => set({ input: v }),
  setOutput: (v) => set({ output: v }),
  sendToConverter: (v, algorithm) => set({ input: v, pendingAlgorithm: algorithm ?? null }),
  clearPendingAlgorithm: () => set({ pendingAlgorithm: null }),
}))
