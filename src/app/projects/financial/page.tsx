// "use client";

// import { useState, useEffect, useMemo } from "react";
// import { formatMoney } from "@/lib/format";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Progress } from "@/components/ui/progress";
// import Link from "next/link";
// import SearchInput from "@/components/SearchInput";
// import QuerySelect from "@/components/QuerySelect";
// import PaginationControls from "@/components/PaginationControls";
// import { useSearchParams } from "next/navigation";

// interface Project {
//   id: string;
//   projectId: string;
//   name: string;
//   clientName: string;
//   contractValue: number;
//   costToDate: number;
//   receivedAmount: number;
//   invoicedAmount: number;
//   pendingRecovery: number;
//   grossMargin: number;
//   marginPercent: number;
//   status: string;
//   expenseCount: number;
//   lastExpenseDate: string | null;
// }

// export default function ProjectFinancialPage() {
//   const [projects, setProjects] = useState<Project[]>([]);
//   const [loading, setLoading] = useState(true);
//   const searchParams = useSearchParams();
//   const search = (searchParams.get("search") || "").trim().toLowerCase();
//   const status = (searchParams.get("status") || "").trim();
//   const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
//   const take = 10;

//   useEffect(() => {
//     const fetchProjectFinancials = async () => {
//       try {
//         const res = await fetch('/api/projects/financial');
//         const data = await res.json();
//         if (data.success) {
//           setProjects(data.projects);
//         }
//       } catch (error) {
//         console.error('Failed to fetch project financials:', error);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchProjectFinancials();
//   }, []);

//   const totalContractValue = projects.reduce((sum, p) => sum + Number(p.contractValue), 0);
//   const totalCostToDate = projects.reduce((sum, p) => sum + Number(p.costToDate), 0);
//   const totalReceived = projects.reduce((sum, p) => sum + Number(p.receivedAmount), 0);
//   const totalPendingRecovery = projects.reduce((sum, p) => sum + Number(p.pendingRecovery), 0);
//   const totalGrossMargin = projects.reduce((sum, p) => sum + Number(p.grossMargin), 0);

//   const statusOptions = useMemo(() => {
//     const uniqueStatuses = Array.from(new Set(projects.map((p) => p.status).filter(Boolean)));
//     return uniqueStatuses.sort().map((value) => ({ label: value, value }));
//   }, [projects]);

//   const filteredProjects = useMemo(() => {
//     return projects.filter((project) => {
//       if (status && project.status !== status) return false;
//       if (!search) return true;
//       const haystack = [
//         project.name,
//         project.projectId,
//         project.clientName,
//         project.status,
//       ]
//         .filter(Boolean)
//         .join(" ")
//         .toLowerCase();
//       return haystack.includes(search);
//     });
//   }, [projects, search, status]);

//   const totalPages = Math.max(1, Math.ceil(filteredProjects.length / take));
//   const pageStart = (page - 1) * take;
//   const pageProjects = filteredProjects.slice(pageStart, pageStart + take);

//   if (loading) {
//     return (
//       <div className="rounded-xl border bg-card p-8 shadow-sm">
//         <h1 className="text-2xl font-semibold">Project Financials</h1>
//         <p className="mt-2 text-muted-foreground">Loading...</p>
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="rounded-xl border bg-card p-8 shadow-sm">
//         <div className="flex flex-wrap items-center justify-between gap-3">
//           <div>
//             <h1 className="text-2xl font-semibold">Project Financial Dashboard</h1>
//             <p className="mt-2 text-muted-foreground">
//               Budget vs actual costs and profitability analysis
//             </p>
//           </div>
//           <div className="flex flex-wrap items-center gap-2">
//             <div className="min-w-[220px]">
//               <SearchInput placeholder="Search projects..." />
//             </div>
//             <QuerySelect
//               param="status"
//               placeholder="All statuses"
//               options={statusOptions}
//             />
//             <Link href="/projects">
//               <Button variant="outline">View All Projects</Button>
//             </Link>
//           </div>
//         </div>
//       </div>

//       {/* Summary Cards */}
//       <div className="grid gap-6 md:grid-cols-4">
//         <Card>
//           <CardHeader>
//             <CardTitle>Total Contract Value</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <p className="text-2xl font-bold text-green-600">
//               {formatMoney(totalContractValue)}
//             </p>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader>
//             <CardTitle>Total Costs</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <p className="text-2xl font-bold text-red-600">
//               {formatMoney(totalCostToDate)}
//             </p>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader>
//             <CardTitle>Total Received</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <p className="text-2xl font-bold text-blue-600">
//               {formatMoney(totalReceived)}
//             </p>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader>
//             <CardTitle>Pending Recovery</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <p className={`text-2xl font-bold ${totalPendingRecovery > 0 ? 'text-amber-600' : 'text-foreground'}`}>
//               {formatMoney(totalPendingRecovery)}
//             </p>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader>
//             <CardTitle>Gross Margin</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <p className={`text-2xl font-bold ${totalGrossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
//               {formatMoney(totalGrossMargin)}
//             </p>
//             <p className="text-sm text-muted-foreground">
//               {totalContractValue > 0 ?
//                 `${((totalGrossMargin / totalContractValue) * 100).toFixed(1)}% margin` :
//                 'No contract values set'
//               }
//             </p>
//           </CardContent>
//         </Card>
//       </div>

//       {/* Project Details */}
//       <div className="space-y-4">
//         {pageProjects.map((project) => {
//           const costPercentage = project.contractValue > 0
//             ? Math.min((project.costToDate / project.contractValue) * 100, 100)
//             : 0;
//           const isOverBudget = project.contractValue > 0 && project.costToDate > project.contractValue;
//           const recoveryPercent = project.invoicedAmount > 0
//             ? Math.min((project.receivedAmount / project.invoicedAmount) * 100, 100)
//             : 0;

//           return (
//             <Card key={project.id} className={isOverBudget ? 'border-red-200' : ''}>
//               <CardHeader>
//                 <div className="flex items-center justify-between">
//                   <div>
//                     <CardTitle className="text-lg">{project.name}</CardTitle>
//                     <p className="text-sm text-muted-foreground">
//                       {project.projectId} • {project.clientName || "Unknown client"} • {project.status}
//                     </p>
//                   </div>
//                   <div className="text-right">
//                     <div className="text-sm text-muted-foreground">
//                       {project.expenseCount} expenses
//                       {project.lastExpenseDate && (
//                         <> • Last: {new Date(project.lastExpenseDate).toLocaleDateString()}</>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               </CardHeader>
//               <CardContent className="space-y-4">
//                 {/* Budget vs Actual */}
//                 <div className="space-y-2">
//                   <div className="flex justify-between text-sm">
//                     <span>Budget Progress</span>
//                     <span>{formatMoney(project.costToDate)} / {formatMoney(project.contractValue)}</span>
//                   </div>
//                   {project.contractValue > 0 ? (
//                     <Progress
//                       value={costPercentage}
//                       className={isOverBudget ? 'bg-red-100' : ''}
//                     />
//                   ) : (
//                     <div className="bg-gray-100 h-2 rounded">
//                       <div className="text-xs text-center text-muted-foreground pt-0.5">
//                         No budget set
//                       </div>
//                     </div>
//                   )}
//                   <div className="flex justify-between text-xs text-muted-foreground">
//                     <span>{costPercentage.toFixed(1)}% spent</span>
//                     {isOverBudget && (
//                       <span className="text-red-600 font-medium">Over Budget!</span>
//                     )}
//                   </div>
//                 </div>

//                 {/* Financial Metrics */}
//                 <div className="grid gap-4 md:grid-cols-4 text-sm">
//                   <div>
//                     <p className="text-muted-foreground">Contract Value</p>
//                     <p className="font-semibold text-green-600">
//                       {formatMoney(project.contractValue)}
//                     </p>
//                   </div>
//                   <div>
//                     <p className="text-muted-foreground">Actual Costs</p>
//                     <p className="font-semibold text-red-600">
//                       {formatMoney(project.costToDate)}
//                     </p>
//                   </div>
//                   <div>
//                     <p className="text-muted-foreground">Received</p>
//                     <p className="font-semibold text-blue-600">
//                       {formatMoney(project.receivedAmount)}
//                     </p>
//                     <p className="text-xs text-muted-foreground">
//                       Pending: {formatMoney(project.pendingRecovery)}
//                     </p>
//                   </div>
//                   <div>
//                     <p className="text-muted-foreground">Gross Margin</p>
//                     <p className={`font-semibold ${project.grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
//                       {formatMoney(project.grossMargin)}
//                     </p>
//                     <p className="text-xs text-muted-foreground">
//                       {project.marginPercent.toFixed(1)}%
//                     </p>
//                   </div>
//                 </div>

//                 <div className="space-y-2">
//                   <div className="flex justify-between text-sm">
//                     <span>Recovery Progress</span>
//                     <span>{formatMoney(project.receivedAmount)} / {formatMoney(project.invoicedAmount)}</span>
//                   </div>
//                   {project.invoicedAmount > 0 ? (
//                     <Progress value={recoveryPercent} />
//                   ) : (
//                     <div className="bg-gray-100 h-2 rounded">
//                       <div className="text-xs text-center text-muted-foreground pt-0.5">
//                         No invoices yet
//                       </div>
//                     </div>
//                   )}
//                   <div className="flex justify-between text-xs text-muted-foreground">
//                     <span>{recoveryPercent.toFixed(1)}% recovered</span>
//                     {project.pendingRecovery > 0 && (
//                       <span className="text-amber-600 font-medium">Pending recovery</span>
//                     )}
//                   </div>
//                 </div>

//                 <div className="flex gap-2 pt-2">
//                   <Link href={`/expenses/by-project?project=${encodeURIComponent(project.projectId)}`}>
//                     <Button variant="outline" size="sm">View Expenses</Button>
//                   </Link>
//                   <Link href={`/projects/${project.id}`}>
//                     <Button variant="outline" size="sm">Project Details</Button>
//                   </Link>
//                 </div>
//               </CardContent>
//             </Card>
//           );
//         })}
//       </div>

//       {filteredProjects.length === 0 && (
//         <Card>
//           <CardContent className="py-12 text-center">
//             <p className="text-muted-foreground">No projects found with financial data.</p>
//           </CardContent>
//         </Card>
//       )}

//       {totalPages > 1 && (
//         <div className="rounded-xl border bg-card p-6 shadow-sm">
//           <PaginationControls totalPages={totalPages} currentPage={page} />
//         </div>
//       )}
//     </div>
//   );
// }

import { Suspense } from 'react';
import FinancialClient from './FinancialClient';

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FinancialClient />
    </Suspense>
  );
}