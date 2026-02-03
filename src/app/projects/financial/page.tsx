"use client";

import { useState, useEffect } from "react";
import { formatMoney } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

interface Project {
  id: string;
  projectId: string;
  name: string;
  client: string;
  contractValue: number;
  costToDate: number;
  grossMargin: number;
  marginPercent: number;
  status: string;
  expenseCount: number;
  lastExpenseDate: string | null;
}

export default function ProjectFinancialPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjectFinancials = async () => {
      try {
        const res = await fetch('/api/projects/financial');
        const data = await res.json();
        if (data.success) {
          setProjects(data.projects);
        }
      } catch (error) {
        console.error('Failed to fetch project financials:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectFinancials();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Project Financials</h1>
        <p className="mt-2 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const totalContractValue = projects.reduce((sum, p) => sum + Number(p.contractValue), 0);
  const totalCostToDate = projects.reduce((sum, p) => sum + Number(p.costToDate), 0);
  const totalGrossMargin = projects.reduce((sum, p) => sum + Number(p.grossMargin), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Project Financial Dashboard</h1>
            <p className="mt-2 text-muted-foreground">
              Budget vs actual costs and profitability analysis
            </p>
          </div>
          <Link href="/projects">
            <Button variant="outline">View All Projects</Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Contract Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatMoney(totalContractValue)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Total Costs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatMoney(totalCostToDate)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Gross Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalGrossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatMoney(totalGrossMargin)}
            </p>
            <p className="text-sm text-muted-foreground">
              {totalContractValue > 0 ? 
                `${((totalGrossMargin / totalContractValue) * 100).toFixed(1)}% margin` : 
                'No contract values set'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Project Details */}
      <div className="space-y-4">
        {projects.map((project) => {
          const costPercentage = project.contractValue > 0 
            ? Math.min((project.costToDate / project.contractValue) * 100, 100)
            : 0;
          const isOverBudget = project.contractValue > 0 && project.costToDate > project.contractValue;
          
          return (
            <Card key={project.id} className={isOverBudget ? 'border-red-200' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {project.projectId} • {project.client} • {project.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      {project.expenseCount} expenses
                      {project.lastExpenseDate && (
                        <> • Last: {new Date(project.lastExpenseDate).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Budget vs Actual */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Budget Progress</span>
                    <span>{formatMoney(project.costToDate)} / {formatMoney(project.contractValue)}</span>
                  </div>
                  {project.contractValue > 0 ? (
                    <Progress 
                      value={costPercentage} 
                      className={isOverBudget ? 'bg-red-100' : ''}
                    />
                  ) : (
                    <div className="bg-gray-100 h-2 rounded">
                      <div className="text-xs text-center text-muted-foreground pt-0.5">
                        No budget set
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{costPercentage.toFixed(1)}% spent</span>
                    {isOverBudget && (
                      <span className="text-red-600 font-medium">Over Budget!</span>
                    )}
                  </div>
                </div>

                {/* Financial Metrics */}
                <div className="grid gap-4 md:grid-cols-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Contract Value</p>
                    <p className="font-semibold text-green-600">
                      {formatMoney(project.contractValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Actual Costs</p>
                    <p className="font-semibold text-red-600">
                      {formatMoney(project.costToDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gross Margin</p>
                    <p className={`font-semibold ${project.grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatMoney(project.grossMargin)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {project.marginPercent.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Link href={`/expenses/by-project?project=${encodeURIComponent(project.name)}`}>
                    <Button variant="outline" size="sm">View Expenses</Button>
                  </Link>
                  <Link href={`/projects/${project.id}`}>
                    <Button variant="outline" size="sm">Project Details</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {projects.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No projects found with financial data.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}