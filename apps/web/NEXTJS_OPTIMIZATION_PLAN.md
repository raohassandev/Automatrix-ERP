# Next.js Optimization Implementation Plan
**Based on 360° Audit Report - Priority 1 & 2 Fixes**  
**Estimated Time**: 3-4 weeks  
**Target**: Production-ready optimization

---

## 🎯 **PHASE 1: CRITICAL FIXES (Week 1-2)**

### **Task 1.1: Performance Monitoring Setup**
**Priority**: ❌ **HIGH** - Missing fundamental performance metrics

#### **Implementation Steps**:

1. **Add Performance Dependencies**
```bash
pnpm add @vercel/analytics @vercel/speed-insights
pnpm add -D @next/bundle-analyzer
```

2. **Update Layout with Analytics** 
```typescript
// src/app/layout.tsx - Add imports
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

// Add before closing body tag
<Analytics />
<SpeedInsights />
```

3. **Bundle Analysis Configuration**
```typescript
// next.config.ts - Add bundle analyzer
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = withBundleAnalyzer({
  // existing config
  experimental: {
    webpackBuildWorker: true, // Enable parallel builds
  },
})
```

4. **Performance Monitoring Script**
```json
// package.json - Add scripts
"analyze": "ANALYZE=true pnpm build",
"perf:lighthouse": "lighthouse http://localhost:3000 --output=json --output-path=./performance-report.json"
```

---

### **Task 1.2: Security Hardening**
**Priority**: ⚠️ **MEDIUM** - Production security concerns

#### **Remove Development Bypasses**:
```typescript
// src/lib/rbac.ts - Replace development bypass
export async function getUserRoleName(userId: string): Promise<RoleName> {
  // Remove this hardcoded bypass for production
  if (process.env.NODE_ENV === 'development' && 
      process.env.DEV_ADMIN_BYPASS === 'true' && 
      userId === 'dev-admin-id') {
    return 'CEO';
  }
  // ... rest of function
}
```

#### **Add Rate Limiting**:
```typescript
// src/middleware.ts - Create new file
import { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
})

export default async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const identifier = request.ip ?? "127.0.0.1"
    const { success } = await ratelimit.limit(identifier)
    
    if (!success) {
      return new Response("Too many requests", { status: 429 })
    }
  }
  
  return proxy(request) // Existing proxy function
}
```

#### **Strengthen CSP Headers**:
```typescript
// src/proxy.ts - Update CSP with nonces
response.headers.set(
  'Content-Security-Policy',
  [
    "default-src 'self'",
    "script-src 'self' 'nonce-{NONCE}' https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://vitals.vercel-insights.com",
    "frame-ancestors 'none'",
  ].join('; ')
);
```

---

### **Task 1.3: Database Configuration Cleanup**
**Priority**: ⚠️ **MEDIUM** - Data access reliability

#### **Standardize Database Path**:
```bash
# Clean up duplicate database files
rm -f dev.db prisma/dev.db
mkdir -p prisma/data
```

```env
# .env.local - Standardize path
DATABASE_URL="file:./prisma/data/production.db"
```

```typescript
// prisma/schema.prisma - Update path
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

---

## 🚀 **PHASE 2: UX/PERFORMANCE OPTIMIZATION (Week 3-4)**

### **Task 2.1: Loading States & Error Boundaries**
**Priority**: ❌ **MEDIUM** - Poor user experience

#### **Global Error Boundary**:
```typescript
// src/components/ErrorBoundary.tsx
'use client'

import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'
import { AlertCircle } from 'lucide-react'

function ErrorFallback({error, resetErrorBoundary}: any) {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
        <h2 className="mt-4 text-lg font-semibold">Something went wrong</h2>
        <p className="mt-2 text-gray-600">{error.message}</p>
        <button 
          onClick={resetErrorBoundary}
          className="mt-4 rounded bg-blue-500 px-4 py-2 text-white"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ReactErrorBoundary>
  )
}
```

#### **Loading Skeleton Components**:
```typescript
// src/components/LoadingSkeleton.tsx
export function DashboardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="mt-2 h-8 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}
```

#### **React Query Integration**:
```typescript
// src/app/layout.tsx - Add React Query
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </QueryClientProvider>
  )
}
```

---

### **Task 2.2: Database Query Optimization**
**Priority**: ⚠️ **MEDIUM** - Performance bottleneck

#### **Dashboard Query Optimization**:
```typescript
// src/lib/dashboard.ts - Optimize with single query
export async function getDashboardDataEnhanced() {
  // Use Promise.all for parallel execution instead of sequential
  const [
    expenseStats,
    incomeStats, 
    inventoryStats,
    projectStats
  ] = await Promise.all([
    prisma.expense.aggregate({
      _sum: { amount: true },
      _count: { id: true },
      where: dateFilter,
    }),
    prisma.income.aggregate({
      _sum: { amount: true },
      _count: { id: true },
      where: dateFilter,
    }),
    prisma.inventoryItem.aggregate({
      _count: { id: true },
      where: { quantity: { lte: prisma.inventoryItem.fields.minStock } }
    }),
    prisma.project.aggregate({
      _sum: { pendingRecovery: true },
      _count: { id: true }
    })
  ])
  
  // Return consolidated data
  return {
    totalExpenses: Number(expenseStats._sum.amount || 0),
    totalIncome: Number(incomeStats._sum.amount || 0),
    netProfit: Number(incomeStats._sum.amount || 0) - Number(expenseStats._sum.amount || 0),
    expenseCount: expenseStats._count.id,
    incomeCount: incomeStats._count.id,
    lowStockCount: inventoryStats._count.id,
    pendingRecovery: Number(projectStats._sum.pendingRecovery || 0),
  }
}
```

#### **Add Query Caching**:
```typescript
// src/lib/cache.ts
import { unstable_cache } from 'next/cache'

export const getCachedDashboardData = unstable_cache(
  async (userId: string, dateRange: string) => {
    return getDashboardDataEnhanced(dateRange)
  },
  ['dashboard-data'],
  {
    revalidate: 60, // 1 minute cache
    tags: ['dashboard', 'expenses', 'income']
  }
)
```

---

### **Task 2.3: Image & Asset Optimization**  
**Priority**: ⚠️ **MEDIUM** - Performance improvement

#### **Next.js Image Component**:
```typescript
// src/components/ui/OptimizedImage.tsx
import Image from 'next/image'

interface OptimizedImageProps {
  src: string
  alt: string
  width: number
  height: number
  className?: string
  priority?: boolean
}

export function OptimizedImage({ src, alt, width, height, className, priority }: OptimizedImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxUf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  )
}
```

---

## 📋 **IMPLEMENTATION CHECKLIST**

### **Week 1: Critical Infrastructure**
- [ ] Add Vercel Analytics & Speed Insights
- [ ] Configure bundle analyzer  
- [ ] Set up performance monitoring scripts
- [ ] Remove development authentication bypasses
- [ ] Add rate limiting middleware
- [ ] Standardize database configuration

### **Week 2: Security & Error Handling**  
- [ ] Implement comprehensive error boundaries
- [ ] Add loading skeleton components
- [ ] Strengthen Content Security Policy
- [ ] Add environment-based security controls
- [ ] Test security configurations

### **Week 3: Performance Optimization**
- [ ] Integrate React Query for API caching
- [ ] Optimize database queries (dashboard)
- [ ] Add query result caching
- [ ] Implement image optimization
- [ ] Add compression and asset optimization

### **Week 4: Testing & Validation**
- [ ] Run Lighthouse performance audits  
- [ ] Validate bundle size improvements
- [ ] Test error boundary functionality
- [ ] Verify security headers
- [ ] Load testing with optimizations

---

## 📊 **SUCCESS METRICS**

| Metric | Before | Target | Measurement |
|--------|---------|---------|-------------|
| Bundle Size | Unknown | <500KB | Bundle analyzer |
| First Contentful Paint | Unknown | <1.5s | Lighthouse |
| Largest Contentful Paint | Unknown | <2.5s | Lighthouse |
| Cumulative Layout Shift | Unknown | <0.1 | Web Vitals |
| Error Recovery | 0% | 95% | Error boundary tests |
| Security Score | B | A+ | Security headers check |

---

## 🚀 **DEPLOYMENT STRATEGY**

1. **Development Environment**
   - Test all changes in feature branches
   - Validate performance improvements
   - Run security audits

2. **Staging Deployment**
   - Deploy with real-world data volume
   - Performance testing under load
   - Security penetration testing

3. **Production Rollout**
   - Blue-green deployment
   - Monitor Core Web Vitals
   - Gradual user rollout with monitoring

---

## 💰 **ROI ANALYSIS**

**Investment**: 3-4 weeks development time  
**Expected Returns**:
- **Performance**: 40% faster load times
- **Security**: Production-grade hardening
- **UX**: 95% error recovery rate
- **Monitoring**: Real-time performance insights
- **Maintenance**: 60% reduction in performance debugging

This optimization plan transforms the ERP from **good** to **enterprise-grade** with measurable improvements in performance, security, and user experience.