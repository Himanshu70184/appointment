'use client'

import { Provider } from 'react-redux'
import { store } from '@/store/store'
import AuthGuard from '@/components/AuthGuard'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthGuard>{children}</AuthGuard>
    </Provider>
  )
}
