const {PrismaClient}=require('./node_modules/@prisma/client'); 
(async()=>{
const p=new PrismaClient(); 
console.log('Expense',await p.expense.count()); 
console.log('Income',await p.income.count()); 
console.log('Project',await p.project.count()); 
console.log('User',await p.user.count()); 
await p.$disconnect();
})();