"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, ReactNode } from "react"

export default function Providers({ children }: { children: ReactNode }) {
  // Criamos o QueryClient dentro de um state para garantir que o Next.js
  // não recrie o cliente a cada renderização no lado do servidor.
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Configuramos um tempo de stale padrão se desejar
        staleTime: 60 * 1000, 
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}