import { Project, Client, ProjectAssignment, User } from '@prisma/client';

// These types are created because complex objects like Dates and Decimals
// cannot be passed directly from Server Components to Client Components.
// We must serialize them into simple types first.

type SerializableUser = Omit<User, 'createdAt' | 'updatedAt' | 'emailVerified'> & {
  createdAt: string;
  updatedAt: string;
  emailVerified: Date | null; // This can remain as Prisma returns it since it's null
};

type SerializableProjectAssignment = Omit<ProjectAssignment, 'createdAt' | 'user'> & {
  createdAt: string;
  user: SerializableUser;
};

export type SerializableProjectWithDetails = Omit<Project, 'startDate' | 'endDate' | 'createdAt' | 'updatedAt' | 'contractValue' | 'invoicedAmount' | 'receivedAmount' | 'pendingRecovery' | 'costToDate' | 'grossMargin' | 'marginPercent' | 'assignments'> & {
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  contractValue: number;
  invoicedAmount: number;
  receivedAmount: number;
  pendingRecovery: number;
  costToDate: number;
  grossMargin: number;
  marginPercent: number;
  client: Client;
  assignments: SerializableProjectAssignment[];
};
